import { SlashCommandBuilder } from "discord.js";
import { getGuildUsers } from "../database.js";

export const name = "rank";

export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("Mostra o ranking de caracteres do servidor.");

function parseArgs(data) {
  // No args for rank
  return {};
}

export async function execute(client, data) {
  const guildId = data.guildId;
  const usersData = getGuildUsers(guildId);

  if (!usersData || usersData.length === 0) {
    return await data.reply("Nenhum usuário registrado neste servidor ainda.");
  }

  const sortedUsers = usersData.sort((a, b) => b.charLeft - a.charLeft);
  const top10 = sortedUsers.slice(0, 10);

  let rankMessage = "**Rank do servidor**\n\n";
  top10.forEach((user, index) => {
    rankMessage += `**#${index + 1}** - ${user.display_name} » ${user.charLeft} caracteres\n`;
  });

  return await data.reply(rankMessage);
}