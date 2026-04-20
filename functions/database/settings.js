import { db } from "../../database.js";
import { isValidGuildId } from "../../functions/validation.js";
import { log } from "../../bot.js";

const DEFAULT_CONFIGS = {
  limitChar: 4000,
  speakMessage: 0,
  charLimitEnabled: 1,
  generateMessage: 1,
  maxSavedAudios: 50,
  prefix: '$',
  guildSilenceUntil: '0',
  randomEventsEnabled: 1,
  dailyRobberyLimit: 3,
  shopEnabled: 1,
  classesEnabled: 1
};

export function getServerConfig(guildId, key) {
  if (!guildId || !key) {
    return DEFAULT_CONFIGS[key] ?? null;
  }

  try {
    const row = db.queries.getServerConfig.get(guildId);

    if (!row) {
      db.queries.setServerConfig.run(
        guildId,
        DEFAULT_CONFIGS.limitChar,
        DEFAULT_CONFIGS.speakMessage,
        DEFAULT_CONFIGS.charLimitEnabled,
        DEFAULT_CONFIGS.generateMessage,
        DEFAULT_CONFIGS.maxSavedAudios,
        DEFAULT_CONFIGS.prefix,
        DEFAULT_CONFIGS.guildSilenceUntil,
        DEFAULT_CONFIGS.randomEventsEnabled,
        DEFAULT_CONFIGS.dailyRobberyLimit,
        DEFAULT_CONFIGS.shopEnabled,
        DEFAULT_CONFIGS.classesEnabled
      );
      return DEFAULT_CONFIGS[key];
    }

    const value = row[key];
    if (['speakMessage', 'charLimitEnabled', 'generateMessage', 'randomEventsEnabled', 'shopEnabled', 'classesEnabled'].includes(key)) {
      return value === 1;
    }
    return value;
  } catch (err) {
    log(`[getServerConfig] Erro ao buscar ${key}: ${err.message}`, "Database", 31);
    return DEFAULT_CONFIGS[key];
  }
}

// ====================== SET ======================
export function setServerConfig(guildId, key, value) {
  if (!guildId || !key) return;

  try {
    const row = db.queries.getServerConfig.get(guildId) || { ...DEFAULT_CONFIGS, guild_id: guildId };

    const config = { ...row };

    if (['speakMessage', 'charLimitEnabled', 'generateMessage', 'randomEventsEnabled', 'shopEnabled', 'classesEnabled'].includes(key)) {
      config[key] = value ? 1 : 0;
    } else {
      config[key] = value;
    }

    db.queries.setServerConfig.run(
      guildId,
      config.limitChar,
      config.speakMessage,
      config.charLimitEnabled,
      config.generateMessage,
      config.maxSavedAudios,
      config.prefix,
      config.guildSilenceUntil,
      config.randomEventsEnabled,
      config.dailyRobberyLimit,
      config.shopEnabled,
      config.classesEnabled
    );
  } catch (err) {
    log(`[setServerConfig] Erro ao salvar ${key}: ${err.message}`, "Database", 31);
  }
}
export function isGuildAiSilenced(guildId) {
  if (!guildId) return false;
  const until = getServerConfig(guildId, 'guildSilenceUntil');
  const timestamp = parseInt(until, 10) || 0;
  return Date.now() < timestamp;
}

export async function extendGuildAiSilenceMs(guildId, ms) {
  const now = Date.now();
  const cur = parseInt(getServerConfig(guildId, 'guildSilenceUntil'), 10) || 0;
  const base = Math.max(now, cur);
  setServerConfig(guildId, 'guildSilenceUntil', (base + ms).toString());
}

export const getChannels = (guildId) => {
  const row = db.queries.getChannels.get(guildId);
  return row ? JSON.parse(row.channel_id || "[]") : [];
};

export const addChannel = (guildId, channelId) => {
  let channels = getChannels(guildId);
  if (!channels.length) {
    db.prepare("INSERT OR IGNORE INTO bot_channels (guild_id, channel_id) VALUES (?, ?)")
      .run(guildId, "[]");
  }
  if (!channels.includes(channelId)) channels.push(channelId);
  db.prepare("UPDATE bot_channels SET channel_id = ? WHERE guild_id = ?")
    .run(JSON.stringify(channels), guildId);
};

export const removeChannel = (guildId, channelId) => {
  const currentChannels = getChannels(guildId);
  const updated = currentChannels.filter((id) => id !== channelId);
  db.prepare("UPDATE bot_channels SET channel_id = ? WHERE guild_id = ?")
    .run(JSON.stringify(updated), guildId);
};

export const getBotPrefix = (guildId) => {
  return getServerConfig(guildId, 'prefix') || '$';
};
