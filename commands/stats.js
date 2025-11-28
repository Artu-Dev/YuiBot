import { EmbedBuilder } from "discord.js";
import { getOrCreateUser } from "../database.js";
import { achievements } from "../functions/achievements.js";
export const name = "stats";

export async function run(client, message) {
  const userId = message.author.id;
  const user = getOrCreateUser(userId);

  if (!user) {
    return message.reply("Você ainda não tem dados registrados!");
  }

  const unlocked = JSON.parse(user.achievements_unlocked || "[]");

  const achievementsPretty = unlocked.length
    ? unlocked
        .map((id) => {
          const ach = Object.values(achievements).find((a) => a.id === id);
          return ach ? `ㅤ•ㅤ${ach.emoji}  ${ach.name}` : `ㅤ•ㅤ🏆  ID ${id}`;
        })
        .join("\n")
    : "_Nenhuma ainda_";

  const embed = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setAuthor({
      name: `${message.author.username} — Estatísticas`,
      iconURL: message.author.displayAvatarURL()
    })
    .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
    .setDescription(`
**Resumo de Atividade**

• Caracteres restantes no mês: **${user.charLeft ?? 0}**
• Mensagens enviadas: **${user.messages_sent ?? 0}**
• Perguntas feitas: **${user.question_marks ?? 0}**
• Mensagens em CAPS: **${user.caps_lock_messages ?? 0}**
• Menções recebidas: **${user.mentions_received ?? 0}**
• Menções enviadas: **${user.mentions_sent ?? 0}**
• Reações recebidas: **${user.reactions_received ?? 0}**

🏆 **Conquistas desbloqueadas:**  
${achievementsPretty}
    `)
    .setFooter({
      text: `ID: ${userId} • Dados atualizados`
    });

  return message.reply({ embeds: [embed] });
}
