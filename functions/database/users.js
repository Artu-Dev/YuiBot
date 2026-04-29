import { db } from "../../database.js";
import { isValidUserId, isValidGuildId } from "../../functions/validation.js";
import { log } from "../../bot.js";
import { hasEffect, removeEffect } from "../effects.js";

function logInvalidId(userId, guildId, fn) {
  log(`[${guildId}] Invalid IDs in ${fn}: userId=${userId}, guildId=${guildId}`, "Database", 31);
}

let _stmtGetPassive = null;
function stmtGetPassive() {
  if (!_stmtGetPassive) _stmtGetPassive = db.prepare(`
    SELECT user_id FROM active_effects
    WHERE guild_id = ? AND effect = ? AND item_id = ? AND (expires_at IS NULL OR expires_at > ?)
  `);
  return _stmtGetPassive;
}

function getPassiveHolders(guildId, effect, targetUserId) {
  return stmtGetPassive().all(guildId, effect, targetUserId, Date.now());
}

// CRUD basico

export const getUser = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) { logInvalidId(userId, guildId, "getUser"); return null; }
  return db.queries.getUserById.get(userId, guildId);
};

export const deleteUser = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) { logInvalidId(userId, guildId, "deleteUser"); return false; }
  return db.queries.deleteUser.run(userId, guildId).changes > 0;
};

export const getOrCreateUser = (userId, displayName, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) { logInvalidId(userId, guildId, "getOrCreateUser"); return null; }
  const existing = db.queries.getUserById.get(userId, guildId);
  if (existing) return existing;
  db.queries.insertUser.run(userId, displayName ?? null, guildId);
  return db.queries.getUserById.get(userId, guildId);
};

export const addUserProperty = (property, userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return;
  db.prepare(`UPDATE users SET ${property} = ${property} + 1 WHERE id = ? AND guild_id = ?`).run(userId, guildId);
};

export function setUserProperty(prop, userId, guildId, value) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return;
  db.prepare(`UPDATE users SET ${prop} = ? WHERE id = ? AND guild_id = ?`).run(value, userId, guildId);
}

export function addUserPropertyByAmount(prop, userId, guildId, amount) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return;
  db.prepare(`UPDATE users SET ${prop} = ${prop} + ? WHERE id = ? AND guild_id = ?`).run(amount, userId, guildId);
}

// Aplica parasita/safety_net e retorna { charLeft, parasitas[] }
async function _applyReducePassives(userId, guildId, amount, skipPassives) {
  // Safety net — nunca skipado, e pessoal
  const afterReduce = getUser(userId, guildId)?.charLeft ?? 0;
  if (afterReduce <= 0 && hasEffect(userId, guildId, "safety_net")) {
    removeEffect(userId, guildId, "safety_net");
    db.queries.addChars.run(300, userId, guildId);
    try {
      const { client } = await import("../../bot.js");
      client.guilds.cache.get(guildId)?.members.cache.get(userId)
        ?.send("Seu **Seguro Desemprego** foi ativado! Voce recebeu **+300 chars** automaticamente.").catch(() => {});
    } catch {}
  }

  const parasitas = [];
  if (!skipPassives) {
    const holders = getPassiveHolders(guildId, "parasita", userId);
    if (holders.length > 0) {
      const gain = Math.floor(amount / 2);
      if (gain > 0) {
        for (const { user_id } of holders) {
          db.queries.addChars.run(gain, user_id, guildId);
          parasitas.push({ userId: user_id, gain });
        }
      }
    }
  }

  return { charLeft: getUser(userId, guildId)?.charLeft ?? 0, parasitas };
}

// reduceChars padrao — retorna so o numero (compativel com todo o codigo existente)
// skipPassives = true no pix para evitar farming
export const reduceChars = async (userId, guildId, amount, allowCredit = false, skipPassives = false) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return 0;
  const date = new Date().toISOString();
  if (allowCredit && hasEffect(userId, guildId, "credit_card_active")) {
    db.queries.reduceCharsAllowNegative.run(amount, date, userId, guildId);
    const u = getUser(userId, guildId);
    if ((u?.charLeft ?? 0) < -(u?.credit_limit || 0)) removeEffect(userId, guildId, "credit_card_active");
  } else {
    db.queries.reduceChars.run(amount, date, userId, guildId);
  }
  const { charLeft } = await _applyReducePassives(userId, guildId, amount, skipPassives);
  return charLeft;
};

// Versao do roubo — retorna info dos passivos que trigaram para notificacao
export const reduceCharsRob = async (userId, guildId, amount) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return { charLeft: 0, parasitas: [] };
  const date = new Date().toISOString();
  db.queries.reduceChars.run(amount, date, userId, guildId);
  return _applyReducePassives(userId, guildId, amount, false);
};

// addChars padrao — retorna array de sombras que trigaram (vazio se skipPassives)
// skipPassives = true no pix
export const addChars = (userId, guildId, amount, skipPassives = false) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return [];
  db.queries.addChars.run(parseInt(amount), userId, guildId);
  if (skipPassives) return [];
  const sombras = getPassiveHolders(guildId, "sombra", userId);
  if (sombras.length === 0) return [];
  const gain = Math.max(1, Math.floor(parseInt(amount) * 0.05));
  for (const { user_id } of sombras) db.queries.addChars.run(gain, user_id, guildId);
  return sombras.map(({ user_id }) => ({ userId: user_id, gain }));
};

// bulk ops

export const addCharsBulk = (updates) => {
  const runAll = db.transaction((updates) => {
    for (const { userId, guildId, amount } of updates) {
      if (isValidUserId(userId) && isValidGuildId(guildId))
        db.queries.addChars.run(parseInt(amount), userId, guildId);
    }
  });
  runAll(updates);
};

export const setCharsBulk = (updates) => {
  const stmt = db.prepare("UPDATE users SET charLeft = ? WHERE id = ? AND guild_id = ?");
  const runAll = db.transaction((updates) => {
    for (const { userId, guildId, amount } of updates) {
      if (isValidUserId(userId) && isValidGuildId(guildId))
        stmt.run(parseInt(amount), userId, guildId);
    }
  });
  runAll(updates);
};

export const getRandomUserId = (guildId, excludeUserId) => {
  if (!guildId) return null;
  return db.queries.getGuildRandomUser.get(guildId, excludeUserId || "")?.id || null;
};

export const getGuildUsers = (guildId) => {
  if (!guildId) return [];
  return db.queries.getGuildAllUsers.all(guildId);
};

export const getPoorestGuildUsers = (guildId, excludeUserId, limit = 10) => {
  if (!guildId) return [];
  return db.prepare(`
    SELECT id, charLeft, display_name FROM users
    WHERE guild_id = ? AND id != ?
    ORDER BY charLeft ASC LIMIT ?
  `).all(guildId, excludeUserId || "", limit);
};

export async function getSpendableChars(userId, guildId) {
  const user = getUser(userId, guildId);
  if (!user) return 0;
  if (!hasEffect(userId, guildId, "credit_card_active")) return Math.max(0, user.charLeft);
  return user.charLeft + (user.credit_limit || 0);
}