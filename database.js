import Database from "better-sqlite3";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { isValidUserId, isValidGuildId } from "./functions/validation.js";
import dayjs from "dayjs";

export function getBotPrefix(guildId) {
  return getServerConfig(guildId, 'prefix') || '$';
}

export const dbBot = new Low(new JSONFile("./data/dbBot.json"), {
  channels: [],
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
const palavrasDb = new Database("./data/palavras_proibidas.db", { readonly: true });

const charLimit = dbBot.data?.configs.limitChar;

const USERS_SCHEMA = {
  display_name: "TEXT",
  charLeft: `INTEGER DEFAULT ${charLimit}`,
  lastDailyBonus: "TEXT DEFAULT ''",
  
  messages_sent: "INTEGER DEFAULT 0",
  achievements_unlocked: "TEXT DEFAULT '{}'",
  penality: "TEXT",
  penalitySetByAdmin: "INTENGER DEFAULT 0",
  penalityWord: "TEXT DEFAULT ''",
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
  
  escudo_expiry: "TEXT DEFAULT ''",
  
  last_escudo_shown: "TEXT DEFAULT ''",
  total_chars_donated: "INTEGER DEFAULT 0",
  user_class: "TEXT DEFAULT 'none'",
};

function updateUserDb() {
  const requiredColumns = USERS_SCHEMA;

  const existingColumns = db
    .prepare("PRAGMA table_info(users)")
    .all()
    .map((col) => col.name);

  for (const [column, type] of Object.entries(requiredColumns)) {
    if (!existingColumns.includes(column)) {
      console.log(`➕ Adicionando coluna AUSENTE no BD: ${column}`);
      db.prepare(`ALTER TABLE users ADD COLUMN ${column} ${type}`).run();
    }
  }
}

function buildUsersColumnsSQL() {
  return Object.entries(USERS_SCHEMA)
    .map(([col, type]) => `${col} ${type}`)
    .join(",\n      ");
}

export const intializeDbBot = async () => {
  await dbBot.read();
  await dbBot.write();


  const columnsSQL = buildUsersColumnsSQL();

  db.prepare(
    `
  CREATE TABLE IF NOT EXISTS users (
      id TEXT,
      guild_id TEXT,
      ${columnsSQL},
      PRIMARY KEY (id, guild_id)
  )
  `
  ).run();

  updateUserDb();

  db.prepare(
    `
        CREATE TABLE IF NOT EXISTS bot_channels (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT DEFAULT '[]'
        )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS message_context (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      channel_id TEXT,
      guild_id TEXT,
      author TEXT,
      content TEXT,
      timestamp TEXT,
      message_id TEXT,
      image_url TEXT,
      image_analysis TEXT
    )
  `
  ).run();

  db.prepare(
    `
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
  `
  ).run();


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

  db.prepare(`
    CREATE TABLE IF NOT EXISTS holidays_cache (
      date TEXT PRIMARY KEY,
      name TEXT,
      year INTEGER
    )
  `).run();

  const existingMsgContextColumns = db
    .prepare("PRAGMA table_info(message_context)")
    .all()
    .map((col) => col.name);

  if (!existingMsgContextColumns.includes("message_id")) {
    db.prepare("ALTER TABLE message_context ADD COLUMN message_id TEXT").run();
  }
  if (!existingMsgContextColumns.includes("image_url")) {
    db.prepare("ALTER TABLE message_context ADD COLUMN image_url TEXT").run();
  }
  if (!existingMsgContextColumns.includes("image_analysis")) {
    db.prepare("ALTER TABLE message_context ADD COLUMN image_analysis TEXT").run();
  }

  db.queries = {
    getUserById: db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?"),
    addUserPenalty: db.prepare("UPDATE users SET penality = ?, penalitySetByAdmin = ? WHERE id = ? AND guild_id = ?"),
    removeUserPenalty: db.prepare("UPDATE users SET penality = NULL, penalitySetByAdmin = 0 WHERE id = ? AND guild_id = ?"),
    getEscudoExpiry: db.prepare("SELECT escudo_expiry FROM users WHERE id = ? AND guild_id = ?"),
    getGuildRandomUser: db.prepare("SELECT id FROM users WHERE guild_id = ? AND id != ? ORDER BY RANDOM() LIMIT 1"),
    getGuildAllUsers: db.prepare("SELECT * FROM users WHERE guild_id = ?"),
    getAchievements: db.prepare("SELECT achievements_unlocked FROM users WHERE id = ? AND guild_id = ?"),
    getChannels: db.prepare("SELECT channel_id FROM bot_channels WHERE guild_id = ?"),
    saveMessageContext: db.prepare(
      "INSERT INTO message_context (channel_id, guild_id, author, content, timestamp, userId, message_id, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    getRecentMessages: db.prepare(
      "SELECT author, content, timestamp, message_id, image_url, image_analysis FROM message_context WHERE channel_id = ? AND guild_id = ? ORDER BY timestamp DESC LIMIT ?"
    ),
    getServerConfig: db.prepare("SELECT * FROM server_configs WHERE guild_id = ?"),
    setServerConfig: db.prepare("INSERT OR REPLACE INTO server_configs (guild_id, limitChar, speakMessage, charLimitEnabled, generateMessage, maxSavedAudios, prefix, guildSilenceUntil) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
  };
};

export const getTodayEvent = (guildId) => {
  if (!guildId || !isValidGuildId(guildId)) return null;
  const today = dayjs().format("YYYY-MM-DD");;
  const row = db.prepare("SELECT * FROM daily_events WHERE guildId = ?").get(guildId);
  if (!row || row.date !== today) return null;
  return row;
};

export const setTodayEvent = (guildId, date, eventKey, charMultiplier, casinoMultiplier, robSuccess, name, description) => {
  if (!guildId || !isValidGuildId(guildId)) return null;
  db.prepare(`
    INSERT OR REPLACE INTO daily_events
      (guildId, date, eventKey, charMultiplier, casinoMultiplier, robSuccess, name, description, hasBeenAnnounced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(guildId, date, eventKey, charMultiplier, casinoMultiplier, robSuccess ?? null, name, description);
};

export const checkAnnouncedEvent = (guildId) => {
  if (!guildId || !isValidGuildId(guildId)) return true;
  const today = new Date().toISOString().split("T")[0];
  const row = db.prepare("SELECT hasBeenAnnounced, date FROM daily_events WHERE guildId = ?").get(guildId);
  if (!row || row.date !== today) return true;
  if (row.hasBeenAnnounced === 1) return true;
  db.prepare("UPDATE daily_events SET hasBeenAnnounced = 1 WHERE guildId = ?").run(guildId);
  return false;
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

/// ==============================================
/// USUÁRIOS
/// ==============================================

export const getUser = (userId, guildId) => {
  if (!userId || !guildId || !isValidUserId(userId) || !isValidGuildId(guildId)) {
    console.warn(`⚠️  Invalid IDs provided to getUser: userId=${userId}, guildId=${guildId}`);
    return null;
  }
  return db.queries.getUserById.get(userId, guildId);
};

export const deleteUser = (userId, guildId) => {
  if (!userId || !guildId || !isValidUserId(userId) || !isValidGuildId(guildId)) {
    console.warn(`⚠️  Invalid IDs provided to deleteUser: userId=${userId}, guildId=${guildId}`);
    return false;
  }
  const result = db.prepare("DELETE FROM users WHERE id = ? AND guild_id = ?").run(userId, guildId);
  return result.changes > 0;
}

export const getUserPenality = (userId, guildId) => {
  if (!userId || !guildId || !isValidUserId(userId) || !isValidGuildId(guildId)) {
    console.warn(`⚠️  Invalid IDs provided to getUserPenality: userId=${userId}, guildId=${guildId}`);
    return null;
  }
  const user = getUser(userId, guildId);
  return user?.penality || null;
};

export const setUserPenality = (userId, guildId, penality, penalitySetByAdmin = false) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    console.warn(`⚠️  Invalid IDs in setUserPenality`);
    return false;
  }
  try {
    db.queries.addUserPenalty.run(penality, penalitySetByAdmin ? 1 : 0, userId, guildId);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao atualizar penalidade:`, error);
    return false;
  }
};

export const removeUserPenality = (userId, guildId) => {  
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    console.warn(`⚠️  Invalid IDs in removeUserPenality`);
    return false;
  }
  try {
    db.queries.removeUserPenalty.run(userId, guildId);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao remover penalidade:`, error);
    return false;
  }
};

/// ==============================================
/// SERVER CONFIGS
/// ==============================================

const DEFAULT_CONFIGS = {
  limitChar: 4000,
  speakMessage: false,
  charLimitEnabled: true,
  generateMessage: true,
  maxSavedAudios: 50,
  prefix: '$',
  guildSilenceUntil: '0'
};

export function getServerConfig(guildId, key) {
  if (!guildId) return DEFAULT_CONFIGS[key];
  const row = db.queries.getServerConfig.get(guildId);
  if (!row) {
    db.queries.setServerConfig.run(guildId, DEFAULT_CONFIGS.limitChar, DEFAULT_CONFIGS.speakMessage ? 1 : 0, DEFAULT_CONFIGS.charLimitEnabled ? 1 : 0, DEFAULT_CONFIGS.generateMessage ? 1 : 0, DEFAULT_CONFIGS.maxSavedAudios, DEFAULT_CONFIGS.prefix, DEFAULT_CONFIGS.guildSilenceUntil);
    return DEFAULT_CONFIGS[key];
  }
  if (key === 'speakMessage' || key === 'charLimitEnabled' || key === 'generateMessage') {
    return row[key] === 1;
  }
  if (key === 'guildSilenceUntil') {
    return row[key] || '0';
  }
  return row[key];
}

export function setServerConfig(guildId, key, value) {
  if (!guildId) return; // can't set for null
  const row = db.queries.getServerConfig.get(guildId);
  let insertData;
  if (!row) {
    insertData = { ...DEFAULT_CONFIGS };
  } else {
    insertData = {
      limitChar: row.limitChar,
      speakMessage: row.speakMessage,
      charLimitEnabled: row.charLimitEnabled,
      generateMessage: row.generateMessage,
      maxSavedAudios: row.maxSavedAudios,
      prefix: row.prefix,
      guildSilenceUntil: row.guildSilenceUntil
    };
  }
  insertData[key] = value;
  // convert booleans to int
  if (key === 'speakMessage' || key === 'charLimitEnabled' || key === 'generateMessage') {
    insertData[key] = value ? 1 : 0;
  }
  db.queries.setServerConfig.run(guildId, insertData.limitChar, insertData.speakMessage, insertData.charLimitEnabled, insertData.generateMessage, insertData.maxSavedAudios, insertData.prefix, insertData.guildSilenceUntil);
}

export const getOrCreateUser = (userId, displayName, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    console.error(`❌ Invalid IDs in getOrCreateUser: userId=${userId}, guildId=${guildId}`);
    return null;
  }

  let user = getUser(userId, guildId);
  if (!user) {
    try {
      db.prepare(
        `INSERT INTO users (id, display_name, guild_id) VALUES (?, ?, ?)`
      ).run(userId, displayName || "Unknown", guildId);
      user = getUser(userId, guildId);
    } catch (error) {
      const code = error?.code;
      if (
        code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
        code === "SQLITE_CONSTRAINT_UNIQUE"
      ) {
        user = getUser(userId, guildId);
        if (user) return user;
      }
      console.error(`❌ Erro ao criar usuário:`, error);
      return null;
    }
  }
  return user;
};

/// ==============================================
/// ESCUDO
/// ==============================================

export const hasEscudo = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return false;
  const user = getUser(userId, guildId);
  if (!user?.escudo_expiry) return false;
  return new Date(user.escudo_expiry) > new Date();
};

export const setEscudo = (userId, guildId, hours = 24) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    console.error(`❌ Invalid IDs in setEscudo`);
    return null;
  }
  const expiry = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  try {
    db.prepare("UPDATE users SET escudo_expiry = ? WHERE id = ? AND guild_id = ?")
      .run(expiry, userId, guildId);
    return expiry;
  } catch (error) {
    console.error(`❌ Erro ao definir escudo:`, error);
    return null;
  }
};

export const getEscudoExpiry = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return null;
  const user = getUser(userId, guildId);
  if (!user?.escudo_expiry) return null;
  const d = new Date(user.escudo_expiry);
  return d > new Date() ? d : null;
};

export const getEscudoTimeRemaining = (userId, guildId) => {
  const expiry = getEscudoExpiry(userId, guildId);
  if (!expiry) return null;

  const now = new Date();
  const diffMs = expiry - now;
  if (diffMs <= 0) return null;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

/// ==============================================
/// CONTEXTO DE MENSAGENS
/// ==============================================

export function saveMessageContext(channelId, guildId, author, content, userId, messageId = null, imageUrl = null) {
  if (!content && !imageUrl) return;
  db.prepare(
    `
    INSERT INTO message_context (channel_id, guild_id, author, content, timestamp, userId, message_id, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(channelId, guildId, author, content, new Date().toISOString(), userId, messageId, imageUrl);

  db.prepare(
    `
    DELETE FROM message_context 
    WHERE channel_id = ? AND guild_id = ?
    AND id NOT IN (
      SELECT id FROM message_context
      WHERE channel_id = ? AND guild_id = ?
      ORDER BY id DESC
      LIMIT 100
    )
  `
  ).run(channelId, guildId, channelId, guildId);
}

export function getRecentMessages(channelId, guildId, limit = 20) {
  const rows = db
    .prepare(
      `
    SELECT author, content, timestamp, message_id, image_url, image_analysis
    FROM message_context
    WHERE channel_id = ? AND guild_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
    )
    .all(channelId, guildId, limit);

  return rows
    .reverse()
    .map((row) => {
      const date = new Date(row.timestamp);
      const time = date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      
      let messageLine = `[${time}] ${row.author}: ${row.content}`;
      
      if (row.image_analysis) {
        messageLine += ` [IMAGEM DESCRITA: ${row.image_analysis}]`;
      }
      
      return messageLine;
    })
    .join("\n");
}

export const getRecentMessagesArray = (channelId, guildId, limit = 20) => {
  const rows = db
    .prepare(
      `
    SELECT author, content, timestamp, message_id, image_url, image_analysis
    FROM message_context
    WHERE channel_id = ? AND guild_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
    )
    .all(channelId, guildId, limit);

  return rows.reverse();
};


export function getMessageContextByMessageId(messageId, guildId) {
  return db
    .prepare(`SELECT * FROM message_context WHERE message_id = ? AND guild_id = ? LIMIT 1`)
    .get(messageId, guildId);
}

export function setMessageImageAnalysis(messageId, guildId, analysis) {
  db.prepare(
    `UPDATE message_context SET image_analysis = ? WHERE message_id = ? AND guild_id = ?`
  ).run(analysis, messageId, guildId);
}


export function getLastMessageAuthor(channelId, guildId) {
  const row = db
    .prepare(
      `
    SELECT userId
    FROM message_context
    WHERE channel_id = ? AND guild_id = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT 1 OFFSET 1
  `,
    )
    .get(channelId, guildId);
  return row?.userId ?? null;
}

export function getGuildMembers(guildId, limit = 10) {
  const rows = db
    .prepare(
      `
    SELECT display_name
    FROM users
    WHERE guild_id = ?
    LIMIT ?
  `
    )
    .all(guildId, limit);
  return rows.map((row) => row.display_name);
}

/// ==============================================
/// CONQUISTAS
/// ==============================================

export function getAchievements(userId, guildId) {
  const row = db
    .prepare("SELECT achievements_unlocked FROM users WHERE id = ? AND guild_id = ?")
    .get(userId, guildId);
  if (!row) return {};
  let parsed;
  try {
    parsed = JSON.parse(row.achievements_unlocked);
  } catch (err) {
    parsed = {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    parsed = {};
  }
  return parsed;
}

export function unlockAchievement(userId, guildId, achievementKey) {
  const result = db.transaction(() => {
    const row = db
      .prepare("SELECT achievements_unlocked FROM users WHERE id = ? AND guild_id = ?")
      .get(userId, guildId);

    let current = {};
    if (row && row.achievements_unlocked) {
      try {
        const parsed = JSON.parse(row.achievements_unlocked);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed;
        }
      } catch (e) {}
    }

    if (current[achievementKey]) return false;
    current[achievementKey] = true;
    db.prepare(
      "UPDATE users SET achievements_unlocked = ? WHERE id = ? AND guild_id = ?"
    ).run(JSON.stringify(current), userId, guildId);
    return true;
  })();
  return result;
}

/// ==============================================
/// CANAIS
/// ==============================================

export function isGuildAiSilenced(guildId) {
  if (!guildId) return false;
  const until = Number(getServerConfig(guildId, 'guildSilenceUntil')) || 0;
  return Date.now() < until;
}

export async function extendGuildAiSilenceMs(guildId, ms) {
  const now = Date.now();
  const cur = Number(getServerConfig(guildId, 'guildSilenceUntil')) || 0;
  const base = Math.max(now, cur);
  setServerConfig(guildId, 'guildSilenceUntil', (base + ms).toString());
}

export const getChannels = (guildId) => {
  const row = db
    .prepare("SELECT channel_id FROM bot_channels WHERE guild_id = ?")
    .get(guildId);
  return row ? JSON.parse(row.channel_id || "[]") : [];
};

export const addChannel = (guildId, channelId) => {
  let channels = getChannels(guildId);
  if (!channels.length) {
    db.prepare(
      "INSERT OR IGNORE INTO bot_channels (guild_id, channel_id) VALUES (?, ?)"
    ).run(guildId, "[]");
  }
  if (!channels.includes(channelId)) channels.push(channelId);
  db.prepare("UPDATE bot_channels SET channel_id = ? WHERE guild_id = ?").run(
    JSON.stringify(channels),
    guildId
  );
};

export const removeChannel = (guildId, channelId) => {
  const currentChannels = getChannels(guildId);
  const updated = currentChannels.filter((id) => id !== channelId);
  db.prepare("UPDATE bot_channels SET channel_id = ? WHERE guild_id = ?").run(
    JSON.stringify(updated),
    guildId
  );
};

/// ==============================================
/// PROPRIEDADES USUARIO
/// ==============================================

export const addUserProperty = (property, userId, guildId) => {  
  db.prepare(
    `UPDATE users SET ${property} = ${property} + 1 WHERE id = ? AND guild_id = ?`
  ).run(userId, guildId);
};

export function resetUserProperty(prop, userId, guildId) {
    db.prepare(
    `UPDATE users SET ${prop} = 0 WHERE id = ? AND guild_id = ?`
  ).run(userId, guildId);
}

export function setUserProperty(prop, userId, guildId, value) {
  db.prepare(
    `UPDATE users SET ${prop} = ? WHERE id = ? AND guild_id = ?`
  ).run(value, userId, guildId);
}

export function addUserPropertyByAmount(prop, userId, guildId, amount) {
  db.prepare(
    `UPDATE users SET ${prop} = ${prop} + ? WHERE id = ? AND guild_id = ?`
  ).run(amount, userId, guildId);
}

export const reduceChars = (userId, guildId, amount) => {
  const user = getUser(userId, guildId);
  const date = new Date().toISOString();
  const newValue = parseInt(Math.max(0, user.charLeft - amount));
  db.prepare(
    "UPDATE users SET charLeft = ?, last_message_time = ? WHERE id = ? AND guild_id = ?"
  ).run(newValue, date, userId, guildId);
  return newValue;
};

export const addChars = (userId, guildId, amount) => {
  db.prepare(
    `UPDATE users SET charLeft = charLeft + ? WHERE id = ? AND guild_id = ?`
  ).run(parseInt(amount), userId, guildId);
};

export const addCharsBulk = (updates) => {
  const stmt = db.prepare(
    `UPDATE users SET charLeft = charLeft + ? WHERE id = ? AND guild_id = ?`
  );

  const runAll = db.transaction((updates) => {
    for (const { userId, guildId, amount } of updates) {
      stmt.run(parseInt(amount), userId, guildId);
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
}

export const getPalavrao = (guildId) => {
  const row = dbBot.data?.configs.dailyWord;
  return row || null;
}

function getProhibitedWordsSet() {
  try {
    const rows = palavrasDb
      .prepare("SELECT palavra FROM palavras_proibidas")
      .all();
    const set = new Set(
      rows
        .map((row) => String(row.palavra || "").trim().toLowerCase())
        .filter((word) => word.length > 0)
    );
    return set;
  } catch (error) {
    console.error("❌ Erro ao carregar palavras proibidas:", error);
    return new Set(["capeta"]);
  }
}

// Cache das palavras proibidas em memória (carregado uma vez na inicialização)
let prohibitedWordsCache = null;

export function getProhibitedWords() {
  if (!prohibitedWordsCache) {
    prohibitedWordsCache = getProhibitedWordsSet();
  }
  return prohibitedWordsCache;
}

export function getRandomProhibitedWord() {
  const getRandomPalavraStmt = palavrasDb.prepare("SELECT palavra FROM palavras_proibidas ORDER BY RANDOM() LIMIT 1");
  const result = getRandomPalavraStmt.get();
  return result ? result.palavra : "capeta";
}