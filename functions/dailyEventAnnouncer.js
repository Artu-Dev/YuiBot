import { EmbedBuilder } from "discord.js";
import { getCurrentDailyEvent, generateAndCacheDailyEvent } from "./getTodaysEvent.js";
import { getChannels, markDailyEventAsAnnounced } from "../database.js";
import { log } from "../bot.js";

const ANNOUNCEMENT_CACHE = new Map();

function getEventColor(eventKey) {
  if (eventKey === "halloween") return 0xff6600;
  if (eventKey === "natal") return 0x00cc44;
  if (eventKey?.startsWith("holiday_")) return 0xffd700;
  return 0xff00ff;
}

function buildEventEmbed(event) {
  const modifiers = [];

  if (event.charMultiplier !== 1.0)
    modifiers.push(`💰 Chars: **${event.charMultiplier}x**`);
  if (event.casinoMultiplier !== 1.0)
    modifiers.push(`🎰 Cassino: **${event.casinoMultiplier}x**`);
  if (event.robSuccess !== null)
    modifiers.push(`🔫 Roubo: **${(event.robSuccess * 100).toFixed(0)}%**`);

  const embed = new EmbedBuilder()
    .setColor(getEventColor(event.eventKey))
    .setTitle(`🗓️ Evento de Hoje: ${event.name}`)
    .setDescription(event.description)
    .setTimestamp();

  if (modifiers.length > 0) {
    embed.addFields({
      name: "⚙️ Modificadores",
      value: modifiers.join("\n"),
      inline: false,
    });
  }

  return embed;
}

export async function announceDailyEventInGuild(guild) {
  if (!guild?.id) return false;

  const guildId = guild.id;

  if (ANNOUNCEMENT_CACHE.has(guildId)) return false;

  try {
    await generateAndCacheDailyEvent(guildId);
    const event = await getCurrentDailyEvent(guildId);

    if (!event || event.eventKey === "normal") {
      ANNOUNCEMENT_CACHE.set(guildId, true);
      return false;
    }

    const registeredChannelIds = getChannels(guildId);

    if (!registeredChannelIds || registeredChannelIds.length === 0) {
      log(`Nenhum canal cadastrado em ${guild.name}`, "DailyAnnouncer", 33);
      ANNOUNCEMENT_CACHE.set(guildId, true);
      return false;
    }

    const randomId = registeredChannelIds[Math.floor(Math.random() * registeredChannelIds.length)];
    const channel = guild.channels.cache.get(randomId);

    if (!channel?.isTextBased()) {
      log(`Canal ${randomId} inválido ou não encontrado em ${guild.name}`, "DailyAnnouncer", 33);
      ANNOUNCEMENT_CACHE.set(guildId, true);
      return false;
    }

    const canSend = channel.permissionsFor(guild.members.me)?.has("SendMessages");
    if (!canSend) {
      log(`Sem permissão para enviar em #${channel.name} (${guild.name})`, "DailyAnnouncer", 33);
      ANNOUNCEMENT_CACHE.set(guildId, true);
      return false;
    }

    const embed = buildEventEmbed(event);
    await channel.send({ embeds: [embed] });

    markDailyEventAsAnnounced(guildId);
    ANNOUNCEMENT_CACHE.set(guildId, true);

    log(`📢 Evento "${event.name}" anunciado em #${channel.name} (${guild.name})`, "DailyAnnouncer", 36);
    return true;

  } catch (error) {
    log(`❌ Erro ao anunciar evento em ${guildId}: ${error.message}`, "DailyAnnouncer", 31);
    return false;
  }
}

export async function announceDailyEventForAllGuilds(client) {
  if (!client?.guilds?.cache?.size) return;

  const promises = Array.from(client.guilds.cache.values()).map((guild) =>
    announceDailyEventInGuild(guild).catch((error) => {
      log(`Erro ao anunciar em ${guild.name}: ${error.message}`, "DailyAnnouncer", 31);
      return false;
    })
  );

  const results = await Promise.allSettled(promises);
  const successful = results.filter((r) => r.status === "fulfilled" && r.value).length;

  log(
    `✅ Anúncio concluído: ${successful}/${client.guilds.cache.size} servidores`,
    "DailyAnnouncer",
    36
  );
}

export function resetDailyAnnouncementCache() {
  const size = ANNOUNCEMENT_CACHE.size;
  ANNOUNCEMENT_CACHE.clear();
  log(`🔄 Cache de anúncios resetado (${size} servidores)`, "DailyAnnouncer", 32);
}