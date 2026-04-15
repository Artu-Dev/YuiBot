import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../database.js";

export const name = "rank";
export const aliases = ["ranking", "placar", "top", "leaderboard"]; 

export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("Mostra o ranking de caracteres do servidor.");

export async function execute(client, data) {
  const guildId = data.guildId;
  
  // Usar LIMIT no SQL para não trazer todos os usuários (mais eficiente)
  const top10 = db.prepare(
    "SELECT * FROM users WHERE guild_id = ? ORDER BY charLeft DESC LIMIT 10"
  ).all(guildId);

  if (!top10 || top10.length === 0) {
    return await data.reply("Nenhum usuário registrado neste servidor ainda.");
  }
  
  const usersData = db.prepare("SELECT COUNT(*) as total FROM users WHERE guild_id = ?").get(guildId);

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
    text: `Top 10 de ${usersData.total} usuário(s)` 
  });

  return await data.reply({ embeds: [embed] });
}