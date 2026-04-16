import { shouldAnnounceDailyEvent, markDailyEventAsAnnounced } from "../../../database.js";
import { getCurrentDailyEvent } from "../../getTodaysEvent.js";
import { EmbedBuilder } from "discord.js";
import dayjs from "dayjs";
import 'dayjs/locale/pt-br.js';
import { log } from "../../../bot.js";

dayjs.locale('pt-br');

/**
 * Handler para anúncio de eventos diários
 * Responsabilidades:
 * - Verificar se há evento do dia
 * - Enviar embed com informações do evento
 * - Marcar como anunciado
 */

export async function announceEventIfNeeded(message, guildId) {
  try {
    const event = await getCurrentDailyEvent(guildId);
    if (!event || event.eventKey === "normal") return;

    const shouldAnnounce = shouldAnnounceDailyEvent(guildId);
    if (!shouldAnnounce) return;

    const embed = new EmbedBuilder()
      .setColor(0xff00ff)
      .setTitle(`Evento de ${dayjs().format('dddd')}`)
      .setDescription(`**${event.name}**\n${event.description}`);

    await message.channel.send({ embeds: [embed] });

    markDailyEventAsAnnounced(guildId);
    log(`✅ Evento "${event.name}" anunciado no servidor ${guildId}`, "Evento", 32);

  } catch (error) {
    log(`❌ Erro ao anunciar evento no guild ${guildId}: ${error.message}`, "Evento", 31);
  }
}
