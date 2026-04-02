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
    textModel: "gpt-oss:3b-cloud",
    visionModel: "qwen3.5:cloud",
    fastModels: ["gpt-oss:3b-cloud", "gpt-oss:1.3b-cloud", "gpt-oss:7b-cloud"],
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
    swears_count: "INTEGER DEFAULT 0",
    bot_commands_used: "INTEGER DEFAULT 0",
    caps_streak: "INTEGER DEFAULT 0",
    achievements_unlocked: "TEXT DEFAULT '{}'",
    penalities: "TEXT DEFAULT '[]'",
    lastRoubo: "TEXT",
    penalityWord: "TEXT DEFAULT ''",
    timesRoubou: "INTEGER DEFAULT 0",
    otaku_messages: "INTEGER DEFAULT 0",
    gringo_messages: "INTEGER DEFAULT 0",
    suspense_messages: "INTEGER DEFAULT 0",
    textao_messages: "INTEGER DEFAULT 0",
    monologo_streak: "INTEGER DEFAULT 0",
    escudo_expiry: "TEXT DEFAULT ''",
    consecutive_robbery_losses: "INTEGER DEFAULT 0",
    total_robberies: "INTEGER DEFAULT 0",
  };

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

export const intializeDbBot = async () => {
  await dbBot.read();
  await dbBot.write();

  db.prepare(
    `
  CREATE TABLE IF NOT EXISTS users (
      id TEXT,
      guild_id TEXT,
      display_name TEXT,
      charLeft INTEGER DEFAULT ${charLimit},
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
      swears_count INTEGER DEFAULT 0,
      bot_commands_used INTEGER DEFAULT 0,
      caps_streak INTEGER DEFAULT 0,
      achievements_unlocked TEXT DEFAULT '{}',
      penalities TEXT DEFAULT '[]',
      lastRoubo TEXT,
      penalityWord TEXT DEFAULT '',
      timesRoubou INTEGER DEFAULT 0,
      otaku_messages INTEGER DEFAULT 0,
      gringo_messages INTEGER DEFAULT 0,
      suspense_messages INTEGER DEFAULT 0,
      textao_messages INTEGER DEFAULT 0,
      monologo_streak INTEGER DEFAULT 0,
      escudo_expiry TEXT DEFAULT '',
      consecutive_robbery_losses INTEGER DEFAULT 0,
      total_robberies INTEGER DEFAULT 0,
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
};

/// ==============================================
/// USUÁRIOS
/// ==============================================

export const getUser = (userId, guildId) => {
  return db
    .prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?")
    .get(userId, guildId);
};

export const getUserPenalities = (userId, guildId) => {
  const user = getUser(userId, guildId);
  if (!user || !user.penalities) return [];
  try {
    const list = JSON.parse(user.penalities);
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
};

export const setUserPenalities = (userId, guildId, penalities) => {
  let normalized = penalities;
  if (!Array.isArray(normalized)) normalized = [];
  db.prepare("UPDATE users SET penalities = ? WHERE id = ? AND guild_id = ?").run(
    JSON.stringify(normalized),
    userId,
    guildId
  );
};

export const addUserPenality = (userId, guildId, penality) => {
  const current = getUserPenalities(userId, guildId);
  const normalized = penality.trim().toLowerCase();
  if (!normalized) return false;
  if (!current.includes(normalized)) {
    current.push(normalized);
    setUserPenalities(userId, guildId, current);
    return true;
  }
  return false;
};

export const removeUserPenality = (userId, guildId, penality) => {
  const current = getUserPenalities(userId, guildId);
  const normalized = penality.trim().toLowerCase();
  const filtered = current.filter((p) => p !== normalized);
  setUserPenalities(userId, guildId, filtered);
  return current.length !== filtered.length;
};

export const clearUserPenalities = (userId, guildId) => {
  setUserPenalities(userId, guildId, []);
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
/// ESCUDO
/// ==============================================

export const hasEscudo = (userId, guildId) => {
  const user = getUser(userId, guildId);
  if (!user || !user.escudo_expiry) return false;
  return new Date(user.escudo_expiry) > new Date();
};

export const setEscudo = (userId, guildId, hours = 24) => {
  const expiry = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE users SET escudo_expiry = ? WHERE id = ? AND guild_id = ?")
    .run(expiry, userId, guildId);
  return expiry;
};

export const getEscudoExpiry = (userId, guildId) => {
  const user = getUser(userId, guildId);
  if (!user || !user.escudo_expiry) return null;
  const d = new Date(user.escudo_expiry);
  return d > new Date() ? d : null;
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
  const row = db.prepare(`
    SELECT id 
    FROM message_context
    WHERE channel_id = ? AND guild_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(channelId, guildId);
  return row ? row.userId : null;
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
  const newValue = Math.max(0, user.charLeft - amount);
  db.prepare(
    "UPDATE users SET charLeft = ?, last_message_time = ? WHERE id = ? AND guild_id = ?"
  ).run(newValue, date, userId, guildId);
  return newValue;
};

export const addChars = (userId, guildId, amount) => {
  db.prepare(
    `UPDATE users SET charLeft = charLeft + ? WHERE id = ? AND guild_id = ?`
  ).run(amount, userId, guildId);
};

export const getRandomUserId = (guildId, excludeUserId) => {
  const row = db
    .prepare("SELECT id FROM users WHERE guild_id = ? AND id != ? ORDER BY RANDOM() LIMIT 1")
    .get(guildId, excludeUserId);
  return row ? row.id : null;
};

export const getGuildUsers = (guildId) => {
  return db.prepare("SELECT * FROM users WHERE guild_id = ?").all(guildId);
};
