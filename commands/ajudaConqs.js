import { EmbedBuilder } from "discord.js";
import { achievements } from "../functions/achievements.js";

export const name = "ajudaconqs";

export async function run(client, message) {
  const achievementsList = Object.values(achievements)
    .map(a => `• ${a.emoji} **${a.name}** — ${a.description}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setAuthor({
      name: "📘 Lista de conquistas",
      iconURL: message.author.displayAvatarURL()
    })
    .setDescription(`
Aqui estão todas as conquistas mano:

### 🏆 **Conquistas & Requisitos**
${achievementsList}
    `)
    .setFooter({
      text: "Use os comandos com sabedoria 😼"
    });

  return message.reply({ embeds: [embed] });
}

export async function runInteraction(client, interaction) {
  const achievementsList = Object.values(achievements)
    .map(a => `• ${a.emoji} **${a.name}** — ${a.description}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setAuthor({
      name: "📘 Lista de conquistas",
      iconURL: interaction.user.displayAvatarURL()
    })
    .setDescription(`
Aqui estão todas as conquistas mano:

### 🏆 **Conquistas & Requisitos**
${achievementsList}
    `)
    .setFooter({
      text: "Use os comandos com sabedoria 😼"
    });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
