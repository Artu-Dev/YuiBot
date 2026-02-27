import { EmbedBuilder } from "discord.js";
import { achievements } from "../functions/achievements.js";
import { getOrCreateUser } from "../database.js";

export const name = "stats";

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
        name: `${discordUser.displayName} — Estatísticas`,
        iconURL: discordUser.displayAvatarURL(),
      })
      .setThumbnail(discordUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        `
**📊 Resumo de Atividade de ${user.display_name}**

• **Caracteres restantes no mês:** ${user.charLeft ?? 0}
• **Mensagens enviadas:** ${user.messages_sent ?? 0}
• **Perguntas feitas:** ${user.question_marks ?? 0}
• **Mensagens em CAPS LOCK:** ${user.caps_lock_messages ?? 0}
• **Menções recebidas:** ${user.mentions_received ?? 0}
• **Menções enviadas:** ${user.mentions_sent ?? 0}
• **Mensagens entre 2h e 6h (Coruja Noturna):** ${user.night_owl_messages ?? 0}
• **Mensagens com "bom dia":** ${user.morning_messages ?? 0}
• **Mensagens ignoradas (ninguém respondeu):** ${
          user.messages_without_reply ?? 0
        }
• **Mensagens enviadas às 03:33:** ${user.specific_time_messages ?? 0}
• **Perguntas longas (+100 chars):** ${user.long_questions ?? 0}
• **Mensagens com "kkkkkkkkkkk":** ${user.laught_messages ?? 0}
• **Quantidade de palavroes dita:** ${user.swears_count ?? 0}
• **Comandos do bot usados:** ${user.bot_commands_used ?? 0}
• **Streak de CAPS atual:** ${user.caps_streak ?? 0}
• **Reações recebidas:** ${user.reactions_received ?? 0}

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
