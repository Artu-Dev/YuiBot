import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { achievements } from "../functions/achievmentsData.js";
import { resolveAvatarFromContext } from "../functions/utils.js";

export const name = "ajudaconqs";

export const data = new SlashCommandBuilder()
  .setName("ajudaconqs")
  .setDescription("Mostra a lista de todas as conquistas disponíveis.");

export async function execute(client, data) {
  const achievementsList = Object.values(achievements)
    .map((a) => `• ${a.emoji} **${a.name}** — ${a.description}`)
    .join("\n");

  const iconURL = resolveAvatarFromContext(data) ?? undefined;

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setAuthor({
      name: "📘 Lista de conquistas",
      ...(iconURL ? { iconURL } : {}),
    })
    .setDescription(`
Aqui estão todas as conquistas mano:

### 🏆 **Conquistas & Requisitos**
${achievementsList}
    `)
    .setFooter({
      text: "Use os comandos com sabedoria 😼",
    });

  return data.reply({ embeds: [embed] });
}
