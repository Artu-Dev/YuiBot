import Database from "better-sqlite3";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { isValidUserId, isValidGuildId, isValidChannelId } from "./functions/validation.js";
import dayjs from "dayjs";
import { log } from "./bot.js";

function logInvalidId(userId, guildId, functionName) {
  log(`[${guildId}] ⚠️  Invalid IDs in ${functionName}: userId=${userId}, guildId=${guildId}`, "Database", 31);
}

export const dbBot = new Low(new JSONFile("./data/dbBot.json"), {
  configs: {
    limitChar: 4000,
    maxSavedAudios: 50,
  },
  AiConfig: {
    voiceId: "4tRn1lSkEn13EVTuqb0g",
    textModel: "qwen3.5:cloud",
    groqInvertModel: "llama-3.1-8b-instant",
    visionModel: "qwen3.5:cloud",
    fastModels: "gemini-3-flash-preview",
    voiceModel: "eleven_flash_v2_5",
  },
});

export const db = new Database("./data/data.db");
db.pragma("journal_mode = WAL");

const palavrasDb = new Database("./data/palavras_proibidas.db", { readonly: true });

// ==============================================
// ESQUEMA USERS
// ==============================================

const USERS_SCHEMA = {
  display_name: "TEXT",
  charLeft: `INTEGER DEFAULT 4000`,
  lastDailyBonus: "TEXT DEFAULT ''",

  messages_sent: "INTEGER DEFAULT 0",
  achievements_unlocked: "TEXT DEFAULT '{}'",
  penality: "TEXT",
  penalitySetByAdmin: "INTEGER DEFAULT 0", 
  penalityWord: "TEXT DEFAULT ''",
  slowmodeLastTime: "TEXT DEFAULT ''",
  penalityExpires: "TEXT DEFAULT ''",

  last_message_time: "TEXT",
  mentions_received: "INTEGER DEFAULT 0",
  mentions_sent: "INTEGER DEFAULT 0",
  caps_lock_messages: "INTEGER DEFAULT 0",
  question_marks: "INTEGER DEFAULT 0",
  night_owl_messages: "INTEGER DEFAULT 0",
  morning_messages: "INTEGER DEFAULT 0",
  specific_time_messages: "INTEGER DEFAULT 0",
  long_questions: "INTEGER DEFAULT 0",
  laught_messages: "INTEGER DEFAULT 0",
  swears_count: "INTEGER DEFAULT 0",
  caps_streak: "INTEGER DEFAULT 0",
  suspense_messages: "INTEGER DEFAULT 0",
  textao_messages: "INTEGER DEFAULT 0",
  monologo_streak: "INTEGER DEFAULT 0",
  bot_commands_used: "INTEGER DEFAULT 0",

  bounty_placer: "TEXT",
  total_bounty_value: "INTEGER DEFAULT 0",
  bounties_placed: "INTEGER DEFAULT 0",
  bounties_claimed: "INTEGER DEFAULT 0",
  times_bountied: "INTEGER DEFAULT 0",

  lastRoubo: "TEXT",
  consecutive_robbery_losses: "INTEGER DEFAULT 0",
  total_robberies: "INTEGER DEFAULT 0",
  daily_robberies: "INTEGER DEFAULT 0",

  luck_stat: "INTEGER DEFAULT 0",
  tiger_pending_double: "INTEGER DEFAULT 0",
  lifetime_tiger_spins: "INTEGER DEFAULT 0",
  tiger_jackpots: "INTEGER DEFAULT 0",
  tiger_plays: "INTEGER DEFAULT 0",
  tiger_losses: "INTEGER DEFAULT 0",
  tiger_wins: "INTEGER DEFAULT 0",

  total_chars_donated: "INTEGER DEFAULT 0",
  user_class: "TEXT DEFAULT 'none'",
};

function buildUsersColumnsSQL() {
  return Object.entries(USERS_SCHEMA)
    .map(([col, type]) => `${col} ${type}`)
    .join(",\n      ");
}

function updateUserDb() {
  const requiredColumns = USERS_SCHEMA;
  const existingColumns = db
    .prepare("PRAGMA table_info(users)")
    .all()
    .map((col) => col.name);

  for (const [column, type] of Object.entries(requiredColumns)) {
    if (!existingColumns.includes(column)) {
      log(`➕ Adicionando coluna AUSENTE no BD: ${column}`, "Database", 33);
      db.prepare(`ALTER TABLE users ADD COLUMN ${column} ${type}`).run();

      const defaultValue = type.includes("DEFAULT")
        ? type.match(/DEFAULT\s+(.+)/i)?.[1]?.replace(/['"]/g, "") ?? null
        : null;

      if (defaultValue !== null) {
        const updateStmt = db.prepare(`UPDATE users SET ${column} = ? WHERE ${column} IS NULL`);
        updateStmt.run(defaultValue);
      }
    }
  }
}

export const initializeDbBot = async () => { 
  await dbBot.read();
  await dbBot.write();

  const columnsSQL = buildUsersColumnsSQL();

  // users
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT,
      guild_id TEXT,
      ${columnsSQL},
      PRIMARY KEY (id, guild_id)
    )
  `).run();

  updateUserDb();

  // bot channels
  db.prepare(`
    CREATE TABLE IF NOT EXISTS bot_channels (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT DEFAULT '[]'
    )
  `).run();

  // message context 
  db.prepare(`
    CREATE TABLE IF NOT EXISTS message_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      channel_id TEXT,
      guild_id TEXT,
      author TEXT,
      content TEXT,
      timestamp INTEGER,
      message_id TEXT,
      image_url TEXT,
      image_analysis TEXT
    )
  `).run();

  // server config
  db.prepare(`
    CREATE TABLE IF NOT EXISTS server_configs (
      guild_id TEXT PRIMARY KEY,
      limitChar INTEGER DEFAULT 4000,
      speakMessage INTEGER DEFAULT 0,
      charLimitEnabled INTEGER DEFAULT 1,
      generateMessage INTEGER DEFAULT 1,
      maxSavedAudios INTEGER DEFAULT 50,
      prefix TEXT DEFAULT '$',
      guildSilenceUntil TEXT DEFAULT '0'
    )
  `).run();

  // daily events
  db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_events (
      guildId TEXT PRIMARY KEY,
      date TEXT,
      eventKey TEXT,
      hasBeenAnnounced INTEGER DEFAULT 0,
      charMultiplier REAL DEFAULT 1.0,
      casinoMultiplier REAL DEFAULT 1.0,
      robSuccess REAL,
      name TEXT,
      description TEXT
    )
  `).run();

  // holidays
  db.prepare(`
    CREATE TABLE IF NOT EXISTS holidays_cache (
      date TEXT PRIMARY KEY,
      name TEXT,
      year INTEGER
    )
  `).run();

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_message_context_channel_guild_id 
      ON message_context(channel_id, guild_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_msg_ctx_user_guild_channel_time 
      ON message_context(userId, guild_id, channel_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_users_guild 
      ON users(guild_id);
  `);

  //efeitosa tivos
  db.prepare(`
  CREATE TABLE IF NOT EXISTS active_effects (
    user_id TEXT,
    guild_id TEXT,
    effect TEXT,
    item_id TEXT,
    added_at INTEGER,
    expires_at INTEGER,
    PRIMARY KEY (user_id, guild_id, effect)
  )
  `).run();

  // inventário
  db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
      user_id TEXT,
      guild_id TEXT,
      slot INTEGER CHECK(slot >= 0 AND slot < 3),
      item_id TEXT,
      added_at INTEGER,
      duration INTEGER,
      PRIMARY KEY (user_id, guild_id, slot)
    )
  `).run();

  // loja diária
  db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_shop (
      guild_id TEXT PRIMARY KEY,
      date TEXT,
      items TEXT
    )
  `).run();


 
  // ====================== QUERIES PREPARADAS ======================
  db.queries = {
    addActiveEffect: db.prepare("INSERT OR REPLACE INTO active_effects (user_id, guild_id, effect, item_id, added_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)"),
    getInventory: db.prepare("SELECT * FROM inventory WHERE user_id = ? AND guild_id = ? ORDER BY slot"),
    addInventoryItem: db.prepare("INSERT INTO inventory (user_id, guild_id, slot, item_id, added_at, duration) VALUES (?, ?, ?, ?, ?, ?)"),
    removeInventoryItem: db.prepare("DELETE FROM inventory WHERE user_id = ? AND guild_id = ? AND slot = ?"),
    clearInventorySlot: db.prepare("UPDATE inventory SET slot = slot - 1 WHERE user_id = ? AND guild_id = ? AND slot > ?"),
    getActiveEffects: db.prepare("SELECT * FROM active_effects WHERE user_id = ? AND guild_id = ?"),
    removeActiveEffect: db.prepare("DELETE FROM active_effects WHERE user_id = ? AND guild_id = ? AND effect = ?"),
    clearExpiredEffects: db.prepare("DELETE FROM active_effects WHERE user_id = ? AND guild_id = ? AND expires_at <= ?"),
    getDailyShop: db.prepare("SELECT * FROM daily_shop WHERE guild_id = ? AND date = ?"),
    setDailyShop: db.prepare("INSERT OR REPLACE INTO daily_shop (guild_id, date, items) VALUES (?, ?, ?)"),
    
    getUserById: db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?"),
    insertUser: db.prepare("INSERT OR IGNORE INTO users (id, display_name, guild_id) VALUES (?, ?, ?)"),
    addUserPenalty: db.prepare("UPDATE users SET penality = ?, penalitySetByAdmin = ? WHERE id = ? AND guild_id = ?"),
    removeUserPenalty: db.prepare("UPDATE users SET penality = NULL, penalitySetByAdmin = 0 WHERE id = ? AND guild_id = ?"),

    getGuildRandomUser: db.prepare("SELECT id FROM users WHERE guild_id = ? AND id != ? ORDER BY RANDOM() LIMIT 1"),
    getGuildAllUsers: db.prepare("SELECT * FROM users WHERE guild_id = ?"),
    getAchievements: db.prepare("SELECT achievements_unlocked FROM users WHERE id = ? AND guild_id = ?"),
    getChannels: db.prepare("SELECT channel_id FROM bot_channels WHERE guild_id = ?"),
    saveMessageContext: db.prepare(`
      INSERT INTO message_context (channel_id, guild_id, author, content, timestamp, userId, message_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getRecentMessages: db.prepare(`
      SELECT author, content, timestamp, message_id, image_url, image_analysis
      FROM message_context
      WHERE channel_id = ? AND guild_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `),
    getRecentMessagesArray: db.prepare(`
      SELECT author, content, timestamp, message_id, image_url, image_analysis
      FROM message_context
      WHERE channel_id = ? AND guild_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `),
    getLastAuthorMessage: db.prepare(`
      SELECT timestamp, content FROM message_context
      WHERE userId = ? AND guild_id = ? AND channel_id = ?
      ORDER BY timestamp DESC LIMIT 1
    `),
    getMessageContextByMessageId: db.prepare(`
      SELECT * FROM message_context WHERE message_id = ? AND guild_id = ? LIMIT 1
    `),
    setMessageImageAnalysis: db.prepare(`
      UPDATE message_context SET image_analysis = ? WHERE message_id = ? AND guild_id = ?
    `),
    getPreviousMessageAuthor: db.prepare(`
      SELECT userId FROM message_context
      WHERE channel_id = ? AND guild_id = ?
      ORDER BY timestamp DESC, id DESC
      LIMIT 1 OFFSET 1
    `),
    getServerConfig: db.prepare("SELECT * FROM server_configs WHERE guild_id = ?"),
    setServerConfig: db.prepare(`
      INSERT OR REPLACE INTO server_configs 
        (guild_id, limitChar, speakMessage, charLimitEnabled, generateMessage, maxSavedAudios, prefix, guildSilenceUntil)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    deleteExcessMessages: db.prepare(`
      DELETE FROM message_context
      WHERE channel_id = ? AND guild_id = ?
        AND id NOT IN (
          SELECT id FROM message_context
          WHERE channel_id = ? AND guild_id = ?
          ORDER BY id DESC LIMIT 100
        )
    `),
    countMessagesInChannel: db.prepare(`
      SELECT COUNT(*) as total FROM message_context WHERE channel_id = ? AND guild_id = ?
    `),
    deleteUser: db.prepare("DELETE FROM users WHERE id = ? AND guild_id = ?"),
    
    reduceChars: db.prepare(`
      UPDATE users SET charLeft = MAX(0, charLeft - ?), last_message_time = ?
      WHERE id = ? AND guild_id = ?
    `),
    addChars: db.prepare(`
      UPDATE users SET charLeft = charLeft + ? WHERE id = ? AND guild_id = ?
    `),
  };
};

// ==============================================
// DAILY EVENTS E HOLIDAYS
// ==============================================

export const getDailyEventFromDB = (guildId) => {
  if (!guildId || !isValidGuildId(guildId)) return null;
  const today = dayjs().format("YYYY-MM-DD");
  return db.prepare("SELECT * FROM daily_events WHERE guildId = ? AND date = ?").get(guildId, today);
};

export const saveDailyEvent = (guildId, eventData) => {
  if (!guildId || !isValidGuildId(guildId)) return;
  const today = dayjs().format("YYYY-MM-DD");
  db.prepare(`
    INSERT OR REPLACE INTO daily_events 
      (guildId, date, eventKey, charMultiplier, casinoMultiplier, robSuccess, name, description, hasBeenAnnounced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    guildId,
    today,
    eventData.eventKey ?? "normal",
    eventData.charMultiplier ?? 1.0,
    eventData.casinoMultiplier ?? 1.0,
    eventData.robSuccess ?? null,
    eventData.name ?? "Dia Normal",
    eventData.description ?? "Tudo normal hoje"
  );
};

export const shouldAnnounceDailyEvent = (guildId) => {
  if (!guildId || !isValidGuildId(guildId)) return false;
  const today = dayjs().format("YYYY-MM-DD");
  const row = db.prepare("SELECT hasBeenAnnounced FROM daily_events WHERE guildId = ? AND date = ?").get(guildId, today);
  return !row || row.hasBeenAnnounced === 0;
};

export const markDailyEventAsAnnounced = (guildId) => {
  if (!guildId || !isValidGuildId(guildId)) return;
  const today = dayjs().format("YYYY-MM-DD");
  db.prepare("INSERT OR REPLACE INTO daily_events (guildId, date, hasBeenAnnounced) VALUES (?, ?, 1)").run(guildId, today);
};

export const getHolidaysForYear = (year) => {
  const rows = db.prepare("SELECT date, name FROM holidays_cache WHERE year = ?").all(year);
  return new Map(rows.map(r => [r.date, r.name]));
};

export const saveHolidays = (holidays, year) => {
  const insert = db.prepare("INSERT OR REPLACE INTO holidays_cache (date, name, year) VALUES (?, ?, ?)");
  const insertAll = db.transaction((holidays) => {
    for (const [date, name] of holidays.entries()) {
      insert.run(date, name, year);
    }
  });
  insertAll(holidays);
};

// ==============================================
// USUÁRIOS
// ==============================================

export const getUser = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "getUser");
    return null;
  }
  return db.queries.getUserById.get(userId, guildId);
};

export const deleteUser = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "deleteUser");
    return false;
  }
  const result = db.queries.deleteUser.run(userId, guildId);
  return result.changes > 0;
};

export const getUserPenality = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "getUserPenality");
    return null;
  }
  const user = getUser(userId, guildId);
  return user?.penality || null;
};

export const setUserPenality = (userId, guildId, penality, penalitySetByAdmin = false) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "setUserPenality");
    return false;
  }
  try {
    db.queries.addUserPenalty.run(penality, penalitySetByAdmin ? 1 : 0, userId, guildId);
    return true;
  } catch (error) {
    log(`❌ Erro ao atualizar penalidade: ${error.message}`, "Database", 31);
    return false;
  }
};

export const removeUserPenality = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "removeUserPenality");
    return false;
  }
  try {
    db.queries.removeUserPenalty.run(userId, guildId);
    return true;
  } catch (error) {
    log(`❌ Erro ao remover penalidade: ${error.message}`, "Database", 31);
    return false;
  }
};

export const getOrCreateUser = (userId, displayName, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "getOrCreateUser");
    return null;
  }

  db.queries.insertUser.run(userId, displayName || "Unknown", guildId);
  return db.queries.getUserById.get(userId, guildId);
};



// ==============================================
// CONTEXTO DE MENSAGENS
// ==============================================

export function saveMessageContext(channelId, guildId, author, content, userId, messageId = null, imageUrl = null) {
  if (!content && !imageUrl) return;
  if (!isValidChannelId(channelId) || !isValidGuildId(guildId)) return;

  try {
    const timestamp = dayjs().valueOf(); 

    const transaction = db.transaction(() => {
      db.queries.saveMessageContext.run(channelId, guildId, author, content, timestamp, userId, messageId, imageUrl);

      const countRow = db.queries.countMessagesInChannel.get(channelId, guildId);
      if (countRow && countRow.total > 110) {
        db.queries.deleteExcessMessages.run(channelId, guildId, channelId, guildId);
      }
    });
    transaction();
  } catch (error) {
    console.error('[saveMessageContext] Erro ao salvar mensagem:', error);
  }
}

export function getRecentMessages(channelId, guildId, limit = 20) {
  try {
    const rows = db.queries.getRecentMessages.all(channelId, guildId, limit);
    return rows
      .reverse()
      .map((row) => {
        const date = new Date(row.timestamp);
        const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        let messageLine = `[${time}] ${row.author}: ${row.content}`;
        if (row.image_analysis) {
          messageLine += ` [IMAGEM DESCRITA: ${row.image_analysis}]`;
        }
        return messageLine;
      })
      .join("\n");
  } catch (error) {
    log('Erro ao buscar mensagens:' + error, "getRecentMessages", 31);
    return '';
  }
}

export const getRecentMessagesArray = (channelId, guildId, limit = 20) => {
  try {
    const rows = db.queries.getRecentMessagesArray.all(channelId, guildId, limit);
    return rows.reverse();
  } catch (error) {
    console.error('[getRecentMessagesArray] Erro:', error);
    return [];
  }
};

export const getLastAuthorMessage = (channelId, guildId, userId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId) || !isValidChannelId(channelId)) {
    return null;
  }
  try {
    const row = db.queries.getLastAuthorMessage.get(userId, guildId, channelId);
    return row ? row.timestamp : null;
  } catch (error) {
    console.error('[getLastAuthorMessage] Erro:', error);
    return null;
  }
};

export function getMessageContextByMessageId(messageId, guildId) {
  try {
    return db.queries.getMessageContextByMessageId.get(messageId, guildId);
  } catch (error) {
    console.error('[getMessageContextByMessageId] Erro:', error);
    return null;
  }
}

export function setMessageImageAnalysis(messageId, guildId, analysis) {
  try {
    db.queries.setMessageImageAnalysis.run(analysis, messageId, guildId);
  } catch (error) {
    console.error('[setMessageImageAnalysis] Erro:', error);
  }
}

export function getPreviousMessageAuthor(channelId, guildId) {
  if (!isValidChannelId(channelId) || !isValidGuildId(guildId)) {
    return null;
  }
  try {
    const row = db.queries.getPreviousMessageAuthor.get(channelId, guildId);
    return row?.userId ?? null;
  } catch (error) {
    console.error('[getPreviousMessageAuthor] Erro:', error);
    return null;
  }
}

// ==============================================
// SERVER CONFIGS
// ==============================================

const DEFAULT_CONFIGS = {
  limitChar: 4000,
  speakMessage: 0,
  charLimitEnabled: 1,
  generateMessage: 1,
  maxSavedAudios: 50,
  prefix: '$',
  guildSilenceUntil: '0'
};

export function getServerConfig(guildId, key) {
  if (!guildId) return DEFAULT_CONFIGS[key];
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
      DEFAULT_CONFIGS.guildSilenceUntil
    );
    return DEFAULT_CONFIGS[key];
  }
 
  if (key === 'speakMessage' || key === 'charLimitEnabled' || key === 'generateMessage') {
    return row[key] === 1;
  }
  return row[key];
}

export function setServerConfig(guildId, key, value) {
  if (!guildId) return;
  const row = db.queries.getServerConfig.get(guildId);
  const config = row ? { ...row } : { ...DEFAULT_CONFIGS, guild_id: guildId };

  if (key === 'speakMessage' || key === 'charLimitEnabled' || key === 'generateMessage') {
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
    config.guildSilenceUntil
  );
}

// ==============================================
// CONQUISTAS
// ==============================================

export function getAchievements(userId, guildId) {
  const row = db.queries.getAchievements.get(userId, guildId);
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.achievements_unlocked);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

export function unlockAchievement(userId, guildId, achievementKey) {
  return db.transaction(() => {
    const row = db.queries.getAchievements.get(userId, guildId);
    let current = {};
    if (row?.achievements_unlocked) {
      try {
        const parsed = JSON.parse(row.achievements_unlocked);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed;
        }
      } catch {}
    }
    if (current[achievementKey]) return false;
    current[achievementKey] = true;
    db.prepare("UPDATE users SET achievements_unlocked = ? WHERE id = ? AND guild_id = ?")
      .run(JSON.stringify(current), userId, guildId);
    return true;
  })();
}

// ==============================================
// CANAIS
// ==============================================

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

// ==============================================
// PROPRIEDADES DE USUÁRIO
// ==============================================

export const addUserProperty = (property, userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return;
  db.prepare(`UPDATE users SET ${property} = ${property} + 1 WHERE id = ? AND guild_id = ?`)
    .run(userId, guildId);
};

export function setUserProperty(prop, userId, guildId, value) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return;
  db.prepare(`UPDATE users SET ${prop} = ? WHERE id = ? AND guild_id = ?`)
    .run(value, userId, guildId);
}

export function addUserPropertyByAmount(prop, userId, guildId, amount) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return;
  db.prepare(`UPDATE users SET ${prop} = ${prop} + ? WHERE id = ? AND guild_id = ?`)
    .run(amount, userId, guildId);
}

export const reduceChars = (userId, guildId, amount) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return 0;
  const date = new Date().toISOString();
  const result = db.queries.reduceChars.run(amount, date, userId, guildId);
  const user = getUser(userId, guildId);
  return user?.charLeft ?? 0;
};

export const addChars = (userId, guildId, amount) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return;
  db.queries.addChars.run(parseInt(amount), userId, guildId);
};

export const addCharsBulk = (updates) => {
  const stmt = db.queries.addChars;
  const runAll = db.transaction((updates) => {
    for (const { userId, guildId, amount } of updates) {
      if (isValidUserId(userId) && isValidGuildId(guildId)) {
        stmt.run(parseInt(amount), userId, guildId);
      }
    }
  });
  runAll(updates);
};

export const getRandomUserId = (guildId, excludeUserId) => {
  if (!guildId) return null;
  const row = db.queries.getGuildRandomUser.get(guildId, excludeUserId || "");
  return row?.id || null;
};

export const getGuildUsers = (guildId) => {
  if (!guildId) return [];
  return db.queries.getGuildAllUsers.all(guildId);
};

export const getPoorestGuildUsers = (guildId, excludeUserId, limit = 10) => {
  if (!guildId) return [];
  return db.prepare(`
    SELECT id, charLeft, display_name
    FROM users
    WHERE guild_id = ? AND id != ?
    ORDER BY charLeft ASC
    LIMIT ?
  `).all(guildId, excludeUserId || "", limit);
};

export const getBotPrefix = (guildId) => {
  return getServerConfig(guildId, 'prefix') || '$';
};

// ==============================================
// PALAVRAS PROIBIDAS
// ==============================================

let prohibitedWordsCache = null;

function loadProhibitedWordsSet() {
  try {
    const rows = palavrasDb.prepare("SELECT palavra FROM palavras_proibidas").all();
    return new Set(
      rows
        .map((row) => String(row.palavra || "").trim().toLowerCase())
        .filter((word) => word.length > 0)
    );
  } catch (error) {
    log("erro ao carregar palavras proibidas", "Database", 31);
    return new Set(["capeta"]);
  }
}

export function getProhibitedWords() {
  if (!prohibitedWordsCache) {
    prohibitedWordsCache = loadProhibitedWordsSet();
  }
  return prohibitedWordsCache;
}

export function reloadProhibitedWords() {
  prohibitedWordsCache = loadProhibitedWordsSet();
  log("📚 Cache de palavras proibidas recarregado.", "Database", 33);
}

export function getRandomProhibitedWord() {
  const result = palavrasDb.prepare("SELECT palavra FROM palavras_proibidas ORDER BY RANDOM() LIMIT 1").get();
  return result ? result.palavra : "capeta";
}