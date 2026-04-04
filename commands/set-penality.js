import { SlashCommandBuilder } from "discord.js";
import { addUserPenality, getOrCreateUser, getBotPrefix } from "../database.js";
import { penalities } from "../functions/penalities.js";

export const name = "set-penality";

const EXISTING = penalities.map((p) => p.nome);

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

  const finalPenalty = penalty;

  if (!targetUser || !finalPenalty) {
    const p = getBotPrefix();
    return data.reply(
      `**Slash:** \`/set-penality\` com opções\n**Prefixo:** \`${p}set-penality @usuário <penalidade>\`\nPenalidades válidas: ${EXISTING.join(", ")}`
    );
  }

  const normalizedPenalty = finalPenalty.trim().toLowerCase();
  if (!EXISTING.includes(normalizedPenalty)) {
    return data.reply(
      `Penalidade inválida. Valores possíveis: ${EXISTING.join(", ")}`
    );
  }

  getOrCreateUser(targetUser.id, targetUser.username, guildId);

  const added = addUserPenality(targetUser.id, guildId, normalizedPenalty);
  if (!added) {
    return data.reply(`${targetUser.username} já tem a penalidade: ${normalizedPenalty}.`);
  }

  return data.reply(`Penalidade '${normalizedPenalty}' adicionada a ${targetUser.username}!`);
}


