import { SlashCommandBuilder } from "discord.js";
import {
  clearUserPenalities,
  getUserPenalities,
  getOrCreateUser,
} from "../database.js";

export const name = "remove-penality";

export const data = new SlashCommandBuilder()
  .setName("remove-penality")
  .setDescription("Remove a penalidade de um usuário.")
  .addUserOption(option =>
    option.setName("usuário")
      .setDescription("O usuário para remover penalidade")
      .setRequired(false)
  );

function parseArgs(data) {
  if (data.fromInteraction) {
    return {
      targetUser: data.getUser("usuário"),
    };
  }

  return {
    targetUser: data.mentionedUser,
  };
}

export async function execute(client, data) {
  const { userId, username, guildId } = data;
  const { targetUser } = parseArgs(data);
  const isAdmin = data.member?.permissions?.has("Administrator");

  if (!isAdmin) {
    return data.reply({ content: "❌ Apenas administradores podem usar este comando.", ephemeral: true });
  }

  const finalTargetUser = targetUser || { id: userId, username };

  getOrCreateUser(finalTargetUser.id, finalTargetUser.username, guildId);

  const existing = getUserPenalities(finalTargetUser.id, guildId);

  if (existing.length === 0) {
    return data.reply(`${finalTargetUser.username} não possui penalidades.`);
  }

  clearUserPenalities(finalTargetUser.id, guildId);

  return data.reply(
    `✅ A penalidade de **${finalTargetUser.username}** foi removida com sucesso.`
  );
}