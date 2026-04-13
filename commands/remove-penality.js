import { SlashCommandBuilder } from "discord.js";
import {
  removeUserPenality,
  getOrCreateUser,
  getUserPenality,
} from "../database.js";

export const name = "remove-penality";
export const aliases = ["remover-penalidade", "remover-penality", "rm-penality", "rm-penalidade", "rm-p"];

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
  const isAdmin = data.isAdmin();

  if (!isAdmin) {
    return data.reply({ content: "❌ Apenas administradores podem usar este comando.", ephemeral: true });
  }

  const finalTargetUser = targetUser || { id: userId, username };

  getOrCreateUser(finalTargetUser.id, finalTargetUser.username, guildId);

  const penality = getUserPenality(finalTargetUser.id, guildId);

  if (!penality) {
    return data.reply(`${finalTargetUser.username} não possui penalidades.`);
  }

  removeUserPenality(finalTargetUser.id, guildId);

  return data.reply(
    `✅ A penalidade de **${finalTargetUser.username}** foi removida com sucesso.`
  );
}