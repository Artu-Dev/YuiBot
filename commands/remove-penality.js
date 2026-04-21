import { SlashCommandBuilder, ChannelFlags } from "discord.js";
import {
  removeUserPenality,
  getOrCreateUser,
  getUserPenality,
} from "../database.js";

export const name = "remove-penalty";
export const aliases = ["remover-penalidade", "remove-penality", "rm-penalty", "rm-penalidade", "rm-p"];

export const data = new SlashCommandBuilder()
  .setName("remove-penalty")
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
    return data.reply({ content: "❌ Apenas administradores podem usar este comando.", flags: ChannelFlags.Ephemeral });
  }

  const finalTargetUser = targetUser || { id: userId, username };

  getOrCreateUser(finalTargetUser.id, finalTargetUser.username, guildId);

  const penalty = getUserPenality(finalTargetUser.id, guildId);

  if (!penalty) {
    return data.reply(`${finalTargetUser.username} não possui penalidades.`);
  }

  removeUserPenality(finalTargetUser.id, guildId);

  return data.reply(
    `✅ A penalidade de **${finalTargetUser.username}** foi removida com sucesso.`
  );
}