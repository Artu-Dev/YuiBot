import { db } from "../../database.js";
import { isValidUserId, isValidGuildId } from "../../functions/validation.js";
import { log } from "../../bot.js";

function logInvalidId(userId, guildId, functionName) {
  log(`[${guildId}] ⚠️  Invalid IDs in ${functionName}: userId=${userId}, guildId=${guildId}`, "Database", 31);
}

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

export const getOrCreateUser = (userId, displayName, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "getOrCreateUser");
    return null;
  }

  db.queries.insertUser.run(userId, displayName || "Unknown", guildId);
  return db.queries.getUserById.get(userId, guildId);
};

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

export const setCharsBulk = (updates) => {
  const stmt = db.prepare("UPDATE users SET charLeft = ? WHERE id = ? AND guild_id = ?");
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

export const ensureUserExists = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "ensureUserExists");
    return null;
  }
  return getOrCreateUser(userId, "Unknown", guildId);
};

export async function reduceCharsWithCredit(userId, guildId, amount) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return 0;
  
  const { hasEffect, removeEffect } = await import("../effects.js");
  const hasCreditCard = hasEffect(userId, guildId, "credit_card_active");
  
  const date = new Date().toISOString();
  const query = hasCreditCard ? db.queries.reduceCharsAllowNegative : db.queries.reduceChars;
  const result = query.run(amount, date, userId, guildId);
  const user = getUser(userId, guildId);
  const newBalance = user?.charLeft ?? 0;
  
  if (hasCreditCard && newBalance < -(user?.credit_limit || 0)) {
    removeEffect(userId, guildId, 'credit_card_active');
  }
  
  return newBalance;
}

export async function getSpendableChars(userId, guildId) {
  const user = getUser(userId, guildId);
  if (!user) return 0;
  
  const { hasEffect } = await import("../effects.js");
  const hasCreditCard = hasEffect(userId, guildId, "credit_card_active");
  
  if (!hasCreditCard) {
    return Math.max(0, user.charLeft);
  }
  
  return Math.max(0, user.charLeft) + (user.credit_limit || 0);
}
