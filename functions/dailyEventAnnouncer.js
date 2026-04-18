
import { EmbedBuilder } from "discord.js";
import { getCurrentDailyEvent, generateAndCacheDailyEvent } from "./getTodaysEvent.js";
import { shouldAnnounceDailyEvent, markDailyEventAsAnnounced } from "../database.js";
import { log } from "../bot.js";

const ANNOUNCEMENT_CACHE = new Map(); 

// =============== ANÚNCIO POR SERVIDOR ===============
export async function announceDailyEventInGuild(guild) {
  if (!guild || !guild.id) return false;

  const guildId = guild.id;

  if (ANNOUNCEMENT_CACHE.has(guildId)) {
    return false;
  }

  try {
    const eventKey = await generateAndCacheDailyEvent(guildId);
    
    const event = await getCurrentDailyEvent(guildId);

    if (!event || event.eventKey === "normal") {
      ANNOUNCEMENT_CACHE.set(guildId, true);
      return false;
    }

    const channels = guild.channels.cache.filter(
      (ch) =>
        ch.isTextBased() &&
        ch.permissionsFor(guild.members.me).has("SendMessages")
    );

    if (channels.size === 0) {
      log(
        `Nenhum canal com permissão em ${guild.name} para anúncio de evento`,
        "DailyAnnouncer",
        33
      );
      ANNOUNCEMENT_CACHE.set(guildId, true);
      return false;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff00ff)
      .setTitle(`Evento de Hoje`)
      .setDescription(`**${event.name}**\n${event.description}`)
      .addFields([
        {
          name: "⚙️ Modificadores",
          value:
            `Chars: **${event.charMultiplier}x** ${
              event.casinoMultiplier !== 1.0
                ? `| Cassino: **${event.casinoMultiplier}x**`
                : ""
            }`.trim(),
          inline: true,
        },
      ])
      .setTimestamp();

    const channel = channels.first();
    await channel.send({ embeds: [embed] });

    markDailyEventAsAnnounced(guildId);
    ANNOUNCEMENT_CACHE.set(guildId, true);


    return true;
  } catch (error) {
    log(
      `❌ Erro ao anunciar evento em ${guildId}: ${error.message}`,
      "DailyAnnouncer",
      31
    );
    return false;
  }
}

export async function announceDailyEventForAllGuilds(client) {
  if (!client || !client.guilds || client.guilds.cache.size === 0) {
    return;
  }


  const promises = Array.from(client.guilds.cache.values()).map((guild) =>
    announceDailyEventInGuild(guild).catch((error) => {
      log(
        `Erro ao anunciar em ${guild.name}: ${error.message}`,
        "DailyAnnouncer",
        31
      );
      return false;
    })
  );

  const results = await Promise.allSettled(promises);
  const successful = results.filter((r) => r.status === "fulfilled" && r.value).length;

  log(
    `✅ Anúncio de eventos concluído: ${successful}/${client.guilds.cache.size} servidores`,
    "DailyAnnouncer",
    36
  );
}


export function resetDailyAnnouncementCache() {
  const size = ANNOUNCEMENT_CACHE.size;
  ANNOUNCEMENT_CACHE.clear();
}
