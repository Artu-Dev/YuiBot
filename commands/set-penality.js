import { SlashCommandBuilder, ChannelFlags } from "discord.js";
import { getOrCreateUser, getBotPrefix, setUserPenality } from "../database.js";
import { penalities } from "../functions/penalties/penalities.js";

export const name = "set-penality";
export const aliases = ["set-penalidade", "add-penality", "add-penalidade", "add-p", "set-p"];

const penalityNameToKey = Object.entries(penalities).reduce((acc, [key, data]) => {
  acc[data.nome.toLowerCase()] = key;
  return acc;
}, {});

const EXISTING = Object.values(penalities).map((p) => p.nome);

export const data = new SlashCommandBuilder()
  .setName("set-penality")
  .setDescription("Adiciona uma penalidade a um usuário.")
  .addUserOption(option =>
    option.setName("usuário")
      .setDescription("O usuário para aplicar a penalidade")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("penalidade")
      .setDescription("A penalidade a aplicar")
      .addChoices(
        ...EXISTING.map(p => ({ name: p, value: p }))
      )
      .setRequired(true)
  );

function parseArgs(data) {
  if (data.fromInteraction) {
    return {
      targetUser: data.getUser("usuário"),
      penalty: data.getString("penalidade"),
    };
  }

  const args = data.args ?? [];
  const textArgs = args.filter((p) => !/^<@!?\d+>$/.test(String(p)));
  const penalty = textArgs.join(" ").trim().toLowerCase() || null;

  return {
    targetUser: data.mentionedUser,
    penalty,
  };
}

export async function execute(client, data) {
  const { guildId } = data;
  const { targetUser, penalty } = parseArgs(data);
  const isAdmin = data.isAdmin();

  if (!isAdmin) {
    return data.reply({ content: "❌ Apenas administradores podem usar este comando.", flags: ChannelFlags.Ephemeral });
  }

  const finalPenalty = penalty;

  if (!targetUser || !finalPenalty) {
    const p = getBotPrefix();
    return data.reply(
      `**Prefixo:** \`${p}set-penality @usuário <penalidade>\`\nPenalidades válidas: ${EXISTING.join(", ")}`
    );
  }

  const normalizedPenalty = finalPenalty.trim().toLowerCase();
  if (!EXISTING.includes(normalizedPenalty)) {
    return data.reply(
      `Penalidade inválida. Valores possíveis: ${EXISTING.join(", ")}`
    );
  }

  const penaltyKey = penalityNameToKey[normalizedPenalty];

  getOrCreateUser(targetUser.id, targetUser.username, guildId);

  const added = setUserPenality(targetUser.id, guildId, penaltyKey, true);
  if (!added) {
    return data.reply(`${targetUser.username} já tem a penalidade: ${normalizedPenalty}.`);
  }

  return data.reply(`Penalidade '${normalizedPenalty}' adicionada a ${targetUser.username}!`);
}


