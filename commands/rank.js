import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getGuildUsers } from "../database.js";

export const name = "rank";
export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("Mostra o ranking de caracteres do servidor.");

export async function execute(client, data) {
  const guildId = data.guildId;
  const usersData = getGuildUsers(guildId);

  if (!usersData || usersData.length === 0) {
    return await data.reply("Nenhum usuário registrado neste servidor ainda.");
  }

  const sortedUsers = usersData.sort((a, b) => b.charLeft - a.charLeft);
  const top10 = sortedUsers.slice(0, 10);

  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🏆 Rank do Servidor")
    .setDescription("Top 10 usuários com mais caracteres")
    .setTimestamp();

  let description = "";

  top10.forEach((user, index) => {
    const position = index + 1;
    let medal = "";

    if (position === 1) medal = "🥇 ";
    else if (position === 2) medal = "🥈 ";
    else if (position === 3) medal = "🥉 ";

    description += `${medal}**#${position}** ${user.display_name} — **${user.charLeft.toLocaleString()}** chars\n`;
  });

  embed.setDescription(description);

  embed.setFooter({ 
    text: `Total de usuários: ${usersData.length}` 
  });

  return await data.reply({ embeds: [embed] });
}