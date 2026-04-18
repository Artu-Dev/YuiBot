import Database from "better-sqlite3";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { isValidUserId, isValidGuildId, isValidChannelId } from "./functions/validation.js";
import dayjs from "dayjs";
import { log } from "./bot.js";

// ==================== RE-EXPORT ALL DATABASE MODULES ====================
// Users
export {
  getUser,
  deleteUser,
  getOrCreateUser,
  ensureUserExists,
  addUserProperty,
  setUserProperty,
  addUserPropertyByAmount,
  reduceChars,
  getSpendableChars,
  addChars,
  addCharsBulk,
  setCharsBulk,
  getRandomUserId,
  getGuildUsers,
  getPoorestGuildUsers,
} from "./functions/database/users.js";

// Penalties
export {
  getUserPenality,
  setUserPenality,
  removeUserPenality,
} from "./functions/database/penalties.js";

// Achievements
export {
  getAchievements,
  unlockAchievement,
  resetAchievement,
} from "./functions/database/achievements.js";

// Messages
export {
  saveMessageContext,
  getRecentMessages,
  getRecentMessagesArray,
  getLastAuthorMessage,
  getMessageContextByMessageId,
  setMessageImageAnalysis,
  getPreviousMessageAuthor,
} from "./functions/database/messages.js";

// Settings
export {
  getServerConfig,
  setServerConfig,
  isGuildAiSilenced,
  extendGuildAiSilenceMs,
  getChannels,
  addChannel,
  removeChannel,
  getBotPrefix,
} from "./functions/database/settings.js";

// Events
export {
  getDailyEventFromDB,
  saveDailyEvent,
  shouldAnnounceDailyEvent,
  markDailyEventAsAnnounced,
  getHolidaysForYear,
  saveHolidays,
} from "./functions/database/events.js";

// Bank
export {
  depositToBank,
  withdrawFromBank,
  getBankBalance,
  applyDailyBankInterest,
  getCreditInfo,
  addCreditDebt,
  payCredit,
} from "./functions/database/bank.js";

// Words
export {
  getProhibitedWords,
  reloadProhibitedWords,
  getRandomProhibitedWord,
} from "./functions/database/words.js";

// ==================== CORE DATABASE EXPORTS ====================

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

// User schema for dynamic column creation
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

  tiger_pending_double: "INTEGER DEFAULT 0",
  lifetime_tiger_spins: "INTEGER DEFAULT 0",
  tiger_jackpots: "INTEGER DEFAULT 0",
  tiger_plays: "INTEGER DEFAULT 0",
  tiger_losses: "INTEGER DEFAULT 0",
  tiger_wins: "INTEGER DEFAULT 0",

  total_chars_donated: "INTEGER DEFAULT 0",
  user_class: "TEXT DEFAULT 'none'",

  bank_balance: "INTEGER DEFAULT 0",
  last_bank_interest: "TEXT DEFAULT ''",
  credit_limit: "INTEGER DEFAULT 0",
  credit_debt: "INTEGER DEFAULT 0",
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

export const resetUserData = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return false;
  
  try {
    const preserveFields = ["charLeft", "id", "guild_id", "display_name", "user_class"];
    
    const assignments = Object.entries(USERS_SCHEMA)
      .filter(([col]) => !preserveFields.includes(col))
      .map(([col, type]) => {
        const defaultMatch = type.match(/DEFAULT\s+(.+)/i);
        const defaultValue = defaultMatch ? defaultMatch[1].replace(/['"]/g, "") : "NULL";
        return `${col} = ${defaultValue}`;
      })
      .join(",\n            ");
    
    db.transaction(() => {
      db.prepare(`
        UPDATE users 
        SET ${assignments}
        WHERE id = ? AND guild_id = ?
      `).run(userId, guildId);
    })();
    return true;
  } catch (error) {
    return false;
  }
};

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
      hasBeenAnnounced INTEGER DEFAULT 0
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
    reduceCharsAllowNegative: db.prepare(`
      UPDATE users SET charLeft = charLeft - ?, last_message_time = ?
      WHERE id = ? AND guild_id = ?
    `),
    addChars: db.prepare(`
      UPDATE users SET charLeft = charLeft + ? WHERE id = ? AND guild_id = ?
    `),
  };
};