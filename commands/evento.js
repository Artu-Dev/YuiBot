import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getCurrentDailyEvent } from "../functions/getTodaysEvent.js";
import dayjs from "dayjs";

export const name = "evento";
export const aliases = ["event", "eventos"];

export const data = new SlashCommandBuilder()
  .setName("evento")
  .setDescription("Verifica o evento de hoje.");

export async function execute(client, data) {
  const guildId = data.guildId;
  let event = await getCurrentDailyEvent(guildId);

  if (!event || !event.name || !event.description) {
    event = {
      eventKey: "normal",
      name: "Dia Normal",
      description: "Tudo normal hoje",
      charMultiplier: 1.0,
      casinoMultiplier: 1.0,
      robSuccess: null,
    };
  }

  let color = 0x808080;
  if (event.eventKey !== "normal") {
    color = 0xff00ff; 
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Evento de ${dayjs().format("dddd")}`)
    .setDescription(
      event.eventKey !== "normal"
        ? `**${event.name}**\n${event.description}`
        : `Tudo normal hoje! Nenhum evento especial.`
    );

  // Adiciona campos com modificadores se for evento especial
  if (event.eventKey !== "normal") {
    const modifiers = [];

    if (event.charMultiplier !== 1.0) {
      modifiers.push(
        `💰 Chars: **${event.charMultiplier}x**`
      );
    }

    if (event.casinoMultiplier !== 1.0) {
      modifiers.push(
        `🎰 Cassino: **${event.casinoMultiplier}x**`
      );
    }

    if (event.robSuccess !== null) {
      modifiers.push(
        `🔫 Roubo: **${(event.robSuccess * 100).toFixed(0)}%**`
      );
    }

    if (modifiers.length > 0) {
      embed.addFields({
        name: "⚙️ Modificadores",
        value: modifiers.join("\n"),
        inline: false,
      });
    }
  }

  embed.setTimestamp();

  await data.reply({ embeds: [embed] });
}