import { SlashCommandBuilder } from "discord.js";
import { getOrCreateUser, getUserPenality } from "../database.js";

export const name = "penality";

export const data = new SlashCommandBuilder()
  .setName("penality")
  .setDescription("Mostra as penalidades de um usuário.")
  .addUserOption(option =>
    option.setName("usuário")
      .setDescription("O usuário para verificar (opcional, padrão é você mesmo)")
      .setRequired(false)
  );

const formatPenaltyList = (list) =>
  list.length > 0
    ? list.map((pen, idx) => `• ${idx + 1}. ${pen}`).join("\n")
    : "Nenhuma penalidade encontrada.";

function parseArgs(data) {
  if (data.fromInteraction) {
    return {
      mentionedUser: data.getUser("usuário"),
    };
  }

  return {
    mentionedUser: data.mentionedUser,
  };
}

export async function execute(client, data) {
  const { userId, guildId, username } = data;
  const { mentionedUser } = parseArgs(data);

  const targetUser = mentionedUser || { id: userId, username };
  const displayName = targetUser.username;
  getOrCreateUser(targetUser.id, displayName, guildId);

  const penality = getUserPenality(targetUser.id, guildId);

  if (!penality) {
    return data.reply(`${displayName} não tem penalidades.`);
  }

  return data.reply(
    `Penalidades de ${displayName}:\n${formatPenaltyList(penality)}`
  );
}