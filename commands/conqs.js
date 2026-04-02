import { EmbedBuilder } from "discord.js";
import { achievements } from "../functions/achievements.js";
import { getOrCreateUser } from "../database.js";

export const name = "conqs";

export async function run(client, message) {
  const mentionedUser = message.mentions.users.first();
  const targetUserId = mentionedUser ? mentionedUser.id : message.author.id;
  const targetUserDiscord = mentionedUser ? mentionedUser : message.author;
  const guildId = message.guild.id;
  const displayName = mentionedUser
    ? message.guild.members.cache.get(mentionedUser.id)?.displayName ||
      mentionedUser.username
    : message.member?.displayName || message.author.username;

  const userData = getOrCreateUser(targetUserId, displayName, guildId);

  function generateMessage(user, discordUser) {
    const unlocked = JSON.parse(user.achievements_unlocked || "{}");

    const achievementsPretty = Object.keys(unlocked).length
  ? Object.keys(unlocked)
      .map((key) => {
        const ach = achievements[key];
        return ach ? `ㅤ•ㅤ${ach.emoji} ${ach.name}` : `ㅤ•ㅤ🏆 ${key}`;
      })
      .join("\n")
  : "_Nenhuma ainda_";

    return new EmbedBuilder()
      .setColor("#8A2BE2")
      .setAuthor({
        name: `${discordUser.displayName} — CONQUISTAS FODAS`,
        iconURL: discordUser.displayAvatarURL(),
      })
      .setThumbnail(discordUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        `
🏆 **Conquistas desbloqueadas:**  
${achievementsPretty}
      `
      )
      .setFooter({
        text: `ID: ${discordUser.id} • Dados atualizados`,
      });
  }

  const embed = generateMessage(userData, targetUserDiscord);
  return message.reply({ embeds: [embed] });
}

export async function runInteraction(client, interaction) {
  const targetUser = interaction.options.getUser("usuário") || interaction.options.getUser("usuario") || interaction.user;
  const guildId = interaction.guildId;
  const displayName = interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username;

  const userData = getOrCreateUser(targetUser.id, displayName, guildId);

  function generateMessage(user, discordUser) {
    const unlocked = JSON.parse(user.achievements_unlocked || "{}");

    const achievementsPretty = Object.keys(unlocked).length
      ? Object.keys(unlocked)
        .map((key) => {
          const ach = achievements[key];
          return ach ? `ㅤ•ㅤ${ach.emoji} ${ach.name}` : `ㅤ•ㅤ🏆 ${key}`;
        })
        .join("\n")
      : "_Nenhuma ainda_";

    return new EmbedBuilder()
      .setColor("#8A2BE2")
      .setAuthor({
        name: `${discordUser.displayName} — CONQUISTAS FODAS`,
        iconURL: discordUser.displayAvatarURL(),
      })
      .setThumbnail(discordUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        `
🏆 **Conquistas desbloqueadas:**
${achievementsPretty}
      `
      )
      .setFooter({
        text: `ID: ${discordUser.id} • Dados atualizados`,
      });
  }

  const embed = generateMessage(userData, targetUser);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

