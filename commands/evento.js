import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getTodaysEvent } from "../functions/getTodaysEvent.js";
import dayjs from "dayjs";

export const name = "evento";


export const data = new SlashCommandBuilder()
  .setName("evento")
  .setDescription("Verifica o evento de hoje.");

export async function execute(client, data) {
    const guildId = data.guildId;
    const event = await getTodaysEvent(guildId);

    const embed = new EmbedBuilder()
      .setColor(0xff00ff)
        .setTitle(`Evento de ${dayjs().format('dddd')}`)
        .setDescription(event && event.key !== "normal" ? `**${event.name}**\n${event.description}` : "Nenhum evento especial hoje. Aproveite o dia!");

    await data.reply({ embeds: [embed] });
}