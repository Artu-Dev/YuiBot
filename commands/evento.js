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

  // Fallback para evitar null/undefined
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

  const embed = new EmbedBuilder()
    .setColor(0xff00ff)
    .setTitle(`Evento de ${dayjs().format('dddd')}`)
    .setDescription(
      event.eventKey !== "normal" 
        ? `**${event.name}**\n${event.description}` 
        : "Nenhum evento especial hoje. Aproveite o dia!"
    );

  await data.reply({ embeds: [embed] });
}