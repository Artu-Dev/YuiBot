import { shouldAnnounceDailyEvent, markDailyEventAsAnnounced } from "../../../database.js";
import { getCurrentDailyEvent } from "../../getTodaysEvent.js";
import { EmbedBuilder } from "discord.js";
import dayjs from "dayjs";
import 'dayjs/locale/pt-br.js';
import { log } from "../../../bot.js";

dayjs.locale('pt-br');

const MESSAGE_EVENT_CACHE = new Map(); 


export async function announceEventIfNeeded(message, guildId) {
  if (!message || !guildId) return;

  try {
    const today = dayjs().format("YYYY-MM-DD");

    const cached = MESSAGE_EVENT_CACHE.get(guildId);
    if (cached === today) {
      return;
    }

    MESSAGE_EVENT_CACHE.set(guildId, today);

    const event = await getCurrentDailyEvent(guildId);
    
    if (!event || event.eventKey === "normal") {
      return;
    }

    const shouldAnnounce = shouldAnnounceDailyEvent(guildId);
    if (!shouldAnnounce) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff00ff)
      .setTitle(`Evento de ${dayjs().format("dddd")}`)
      .setDescription(`**${event.name}**\n${event.description}`);

    const modifiers = [];
    if (event.charMultiplier !== 1.0) {
      modifiers.push(`💰 Chars: **${event.charMultiplier}x**`);
    }
    if (event.casinoMultiplier !== 1.0) {
      modifiers.push(`🎰 Cassino: **${event.casinoMultiplier}x**`);
    }
    if (event.robSuccess !== null) {
      modifiers.push(`🔫 Roubo: **${(event.robSuccess * 100).toFixed(0)}%**`);
    }

    if (modifiers.length > 0) {
      embed.addFields({
        name: "⚙️ Modificadores",
        value: modifiers.join("\n"),
        inline: false,
      });
    }

    embed.setTimestamp();

    await message.channel.send({ embeds: [embed] });

    markDailyEventAsAnnounced(guildId);

  } catch (error) {
    log(`❌ Erro ao anunciar evento no guild ${guildId}: ${error.message}`, "Evento", 31);
  }
}

export function resetMessageEventCache() {
  const size = MESSAGE_EVENT_CACHE.size;
  MESSAGE_EVENT_CACHE.clear();
}
