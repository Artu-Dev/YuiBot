import { getGuildUsers } from "../database.js";

export const name = "rank";

export async function run(client, message) {
  const guildId = message.guild.id;
  const usersData = getGuildUsers(guildId); 

  if (!usersData || usersData.length === 0) {
    return await message.reply("Nenhum usuário registrado neste servidor ainda.");
  }

  const sortedUsers = usersData.sort((a, b) => a.charLeft - b.charLeft);

  const top10 = sortedUsers.slice(0, 10);

  let rankMessage = "**Rank do servidor**\n\n";

  top10.forEach((user, index) => {
    rankMessage += `**#${index + 1}** - ${user.display_name} » ${user.charLeft} caracteres\n`;
  });

  return await message.reply(rankMessage);
}

export async function runInteraction(client, interaction) {
  const guildId = interaction.guildId;
  const usersData = getGuildUsers(guildId);

  if (!usersData || usersData.length === 0) {
    return await interaction.reply({ content: "Nenhum usuário registrado neste servidor ainda.", ephemeral: true });
  }

  const sortedUsers = usersData.sort((a, b) => a.charLeft - b.charLeft);
  const top10 = sortedUsers.slice(0, 10);

  let rankMessage = "**Rank do servidor**\n\n";
  top10.forEach((user, index) => {
    rankMessage += `**#${index + 1}** - ${user.display_name} » ${user.charLeft} caracteres\n`;
  });

  return await interaction.reply({ content: rankMessage, ephemeral: true });
}
