import Database from "better-sqlite3";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import Config from "./config.js";

export const dbBot = new Low(new JSONFile("./data/dbBot.json"), {channels: [],
    configs: {
      limitChar: 2000,
      speakMessage: true,
      generateMessage: true,
      maxSavedAudios: 50,
      prefix: "$"
    },
    AiConfig: {
      voiceId: "4tRn1lSkEn13EVTuqb0g",
      textModel: "gpt-oss:120b-cloud",
      voiceModel: "eleven_flash_v2_5"
    },
});
export const db = new Database("./data/data.db");

const charLimit = Config.CHAR_LIMIT_MONTHLY

export const intializeDbBot = async () => {
  await dbBot.read();
  await dbBot.write();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        charLeft INTEGER,
        messages_sent INTEGER DEFAULT 0,
        mentions_received INTEGER DEFAULT 0,
        mentions_sent INTEGER DEFAULT 0,
        reactions_received INTEGER DEFAULT 0,
        caps_lock_messages INTEGER DEFAULT 0,
        question_marks INTEGER DEFAULT 0,
        last_message_time TEXT,
        talking_to_self INTEGER DEFAULT 0,
        night_owl_messages INTEGER DEFAULT 0,
        achievements_unlocked TEXT DEFAULT '[]'
    )
    `
  ).run();

  db.prepare(`
        CREATE TABLE IF NOT EXISTS talking_to_self (
            user_id TEXT,
            channel_id TEXT,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, channel_id)
        )
  `).run();

  return dbBot;
};

export function getAchievements(userId) {
    const row = db.prepare("SELECT achievements_unlocked FROM users WHERE id = ?").get(userId);
    return row ? JSON.parse(row.achievements_unlocked || "[]") : [];
}

export function unlockAchievement(userId, achievementKey) {
    const current = getAchievements(userId);
    if (current.includes(achievementKey)) {
        return false;
    }

    current.push(achievementKey);

    db.prepare(
        "UPDATE users SET achievements_unlocked = ? WHERE id = ?"
    ).run(JSON.stringify(current), userId);

    return true;
}

export const addUserProperty = (property, userId) => {
  db.prepare(`UPDATE users SET ${property} = ${property} + 1 WHERE id = ?`).run(userId)
}

export function resetUserProperty(prop, userId) {
    db.prepare(`
        UPDATE users SET ${prop} = 0 WHERE id = ?
    `).run(userId);
}

export function setUserProperty(prop, userId, value) {
    db.prepare(`
        UPDATE users SET ${prop} = ? WHERE id = ?
    `).run(value, userId);
}

export const getOrCreateUser = (userId) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!user) {
      db.prepare("INSERT INTO users (id, charLeft) VALUES (?, ?)").run(
        userId,
        charLimit
      );
      return { id: userId, charLeft: charLimit };
    }

    return user;
};

export const reduceChars = (userId, amount) => {
    const user = getOrCreateUser(userId);
    const date = new Date().toISOString();
    const newValue = Math.max(0, user.charLeft - amount);

    db.prepare("UPDATE users SET charLeft = ?,last_message_time = ?  WHERE id = ?").run(
      newValue,
      date,
      userId
    );

    return newValue;
};

export function getTalkingToSelf(userId, channelId) {
    const row = db.prepare(`
        SELECT count 
        FROM talking_to_self
        WHERE user_id = ? AND channel_id = ?
    `).get(userId, channelId);

    return row ? row.count : 0;
}

export function incrementTalkingToSelf(userId, channelId) {
    db.prepare(`
        INSERT INTO talking_to_self (user_id, channel_id, count)
        VALUES (?, ?, 1)
        ON CONFLICT(user_id, channel_id)
        DO UPDATE SET count = count + 1
    `).run(userId, channelId);
}

export function resetTalkingToSelf(userId, channelId) {
    db.prepare(`
        UPDATE talking_to_self
        SET count = 0
        WHERE user_id = ? AND channel_id = ?
    `).run(userId, channelId);
}