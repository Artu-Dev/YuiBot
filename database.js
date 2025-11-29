import Database from "better-sqlite3";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

export const dbBot = new Low(new JSONFile("./data/dbBot.json"), {
  channels: [],
  configs: {
    limitChar: 2000,
    speakMessage: true,
    generateMessage: true,
    maxSavedAudios: 50,
    prefix: "$",
  },
  AiConfig: {
    voiceId: "4tRn1lSkEn13EVTuqb0g",
    textModel: "gpt-oss:120b-cloud",
    voiceModel: "eleven_flash_v2_5",
  },
});
export const db = new Database("./data/data.db");
const charLimit = dbBot.data.configs.limitChar;

function updateUserDb() {
  const requiredColumns = {
    display_name: "TEXT",

    charLeft: `INTEGER DEFAULT ${charLimit}`,
    messages_sent: "INTEGER DEFAULT 0",
    mentions_received: "INTEGER DEFAULT 0",
    mentions_sent: "INTEGER DEFAULT 0",
    caps_lock_messages: "INTEGER DEFAULT 0",
    question_marks: "INTEGER DEFAULT 0",
    night_owl_messages: "INTEGER DEFAULT 0",
    last_message_time: "TEXT",
    morning_messages: "INTEGER DEFAULT 0",
    messages_without_reply: "INTEGER DEFAULT 0",
    specific_time_messages: "INTEGER DEFAULT 0",
    long_questions: "INTEGER DEFAULT 0",
    laught_messages: "INTEGER DEFAULT 0",
    porra_count: "INTEGER DEFAULT 0",
    bot_commands_used: "INTEGER DEFAULT 0",
    caps_streak: "INTEGER DEFAULT 0",
    achievements_unlocked: "TEXT DEFAULT '{}'",
  };

  // Obtém as colunas atuais do BD
  const existingColumns = db
    .prepare("PRAGMA table_info(users)")
    .all()
    .map((col) => col.name);

  // Adiciona colunas ausentes
  for (const [column, type] of Object.entries(requiredColumns)) {
    if (!existingColumns.includes(column)) {
      console.log(`➕ Adicionando coluna AUSENTE no BD: ${column}`);
      db.prepare(`ALTER TABLE users ADD COLUMN ${column} ${type}`).run();
    }
  }
}

export const intializeDbBot = async () => {
  await dbBot.read();
  await dbBot.write();

  db.prepare(
    `
  CREATE TABLE IF NOT EXISTS users (
      id TEXT,
      guild_id TEXT,
      display_name TEXT,

      -- Sistema de caracteres
      charLeft INTEGER DEFAULT ${charLimit},

      -- Estatísticas gerais
      messages_sent INTEGER DEFAULT 0,
      mentions_received INTEGER DEFAULT 0,
      mentions_sent INTEGER DEFAULT 0,
      caps_lock_messages INTEGER DEFAULT 0,
      question_marks INTEGER DEFAULT 0,
      night_owl_messages INTEGER DEFAULT 0,
      last_message_time TEXT,
      morning_messages INTEGER DEFAULT 0,
      messages_without_reply INTEGER DEFAULT 0,
      specific_time_messages INTEGER DEFAULT 0,
      long_questions INTEGER DEFAULT 0,
      laught_messages INTEGER DEFAULT 0,
      porra_count INTEGER DEFAULT 0,
      bot_commands_used INTEGER DEFAULT 0,
      caps_streak INTEGER DEFAULT 0,
      achievements_unlocked TEXT DEFAULT '{}',

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
      channel_id TEXT,
      guild_id TEXT,
      author TEXT,
      content TEXT,
      timestamp TEXT
    )
  `
  ).run();
};

/// ==============================================
/// USUÁRIOS
/// ==============================================

const getUser = (userId, guildId) => {
  return db
    .prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?")
    .get(userId, guildId);
};

export const getOrCreateUser = (userId, displayName, guildId) => {
  let user = db
    .prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?")
    .get(userId, guildId);
  if (!user) {
    db.prepare(
      `INSERT INTO users (id, display_name, guild_id) VALUES (?, ?, ?)`
    ).run(userId, displayName, guildId);
    user = db
      .prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?")
      .get(userId, guildId);
  }
  return user;
};

/// ==============================================
/// CONTEXTO DE MENSAGENS
/// ==============================================

export function saveMessageContext(channelId, guildId, author, content) {
  if (!content) return;
  db.prepare(
    `
    INSERT INTO message_context (channel_id, guild_id, author, content, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(channelId, guildId, author, content, new Date().toISOString());

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
    SELECT author, content
    FROM message_context
    WHERE channel_id = ? AND guild_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
    )
    .all(channelId, guildId, limit);

  return rows.map((row) => `${row.author}: ${row.content}`);
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

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
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
        current = JSON.parse(row.achievements_unlocked);
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

  if (!channels.includes(channelId)) {
    channels.push(channelId);
  }

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
    `
        UPDATE users SET ${prop} = 0 WHERE id = ? AND guild_id = ?
    `
  ).run(userId, guildId);
}

export function setUserProperty(prop, userId, guildId, value) {
  db.prepare(
    `
        UPDATE users SET ${prop} = ? WHERE id = ? AND guild_id = ?
    `
  ).run(value, userId, guildId);
}

export const reduceChars = (userId, guildId, amount) => {
  const user = getUser(userId, guildId);
  const date = new Date().toISOString();
  const newValue = Math.max(0, user.charLeft - amount);

  db.prepare(
    "UPDATE users SET charLeft = ?, last_message_time = ? WHERE id = ? AND guild_id = ?"
  ).run(newValue, date, userId, guildId);

  return newValue;
};
