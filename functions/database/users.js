import { db } from "../../database.js";
import { isValidUserId, isValidGuildId } from "../../functions/validation.js";
import { log } from "../../bot.js";
import { hasEffect, removeEffect } from "../effects.js";

function logInvalidId(userId, guildId, functionName) {
  log(`[${guildId}] ⚠️  Invalid IDs in ${functionName}: userId=${userId}, guildId=${guildId}`, "Database", 31);
}

const stmtGetPassive = db.prepare(`
  SELECT user_id FROM active_effects
  WHERE guild_id = ? AND effect = ? AND item_id = ? AND (expires_at IS NULL OR expires_at > ?)
`);

const stmtRemoveEffect = db.prepare(`
  DELETE FROM active_effects WHERE user_id = ? AND guild_id = ? AND effect = ?
`);

// ─── Cache de guilds com efeitos passivos ativos ──────────────────────────────
// Evita qualquer query ao banco quando não há parasita/sombra/safety_net no servidor.
// Estrutura: Map<guildId, Set<effect>>
// Populado no boot e mantido sincronizado por addPassiveToCache / removePassiveFromCache.
const passiveCache = new Map();

function _cacheKey(guildId, effect) {
  return `${guildId}:${effect}`;
}

export function addPassiveToCache(guildId, effect) {
  if (!passiveCache.has(guildId)) passiveCache.set(guildId, new Set());
  passiveCache.get(guildId).add(effect);
}

export function removePassiveFromCache(guildId, effect) {
  passiveCache.get(guildId)?.delete(effect);
}

function guildHasPassive(guildId, effect) {
  return passiveCache.get(guildId)?.has(effect) ?? false;
}

export function initPassiveCache() {
  const rows = db.prepare(`
    SELECT guild_id, effect FROM active_effects
    WHERE effect IN ('parasita', 'sombra', 'safety_net')
      AND (expires_at IS NULL OR expires_at > ?)
  `).all(Date.now());

  for (const { guild_id, effect } of rows) {
    addPassiveToCache(guild_id, effect);
  }
  log(`Cache de passivos carregado: ${rows.length} efeito(s)`, "Database", 32);
}

// ─── Helpers de passivos ──────────────────────────────────────────────────────

function getPassiveHolders(guildId, effect, targetUserId) {
  return stmtGetPassive.all(guildId, effect, targetUserId, Date.now());
}

// ─── CRUD básico ─────────────────────────────────────────────────────────────

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
  return db.queries.deleteUser.run(userId, guildId).changes > 0;
};

export const getOrCreateUser = (userId, displayName, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "getOrCreateUser");
    return null;
  }
  const existing = db.queries.getUserById.get(userId, guildId);
  if (existing) return existing;
  db.queries.insertUser.run(userId, displayName ?? null, guildId);
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

// ─── reduceChars ─────────────────────────────────────────────────────────────

export const reduceChars = async (userId, guildId, amount, allowCredit = false) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return 0;

  const date = new Date().toISOString();

  if (allowCredit && hasEffect(userId, guildId, "credit_card_active")) {
    db.queries.reduceCharsAllowNegative.run(amount, date, userId, guildId);
    const user = getUser(userId, guildId);
    if ((user?.charLeft ?? 0) < -(user?.credit_limit || 0)) {
      removeEffect(userId, guildId, "credit_card_active");
    }
  } else {
    db.queries.reduceChars.run(amount, date, userId, guildId);
  }

  const remaining = getUser(userId, guildId)?.charLeft ?? 0;

  // ── Seguro Desemprego ──────────────────────────────────────────────────────
  // Cache lookup primeiro — O(1), sem DB
  if (remaining <= 0 && guildHasPassive(guildId, "safety_net")) {
    if (hasEffect(userId, guildId, "safety_net")) {
      removeEffect(userId, guildId, "safety_net");
      removePassiveFromCache(guildId, "safety_net");
      db.queries.addChars.run(300, userId, guildId);
      try {
        const { client } = await import("../../bot.js");
        client.guilds.cache.get(guildId)
          ?.members.cache.get(userId)
          ?.send("Seu **Seguro Desemprego** foi ativado! Você recebeu **+300 chars** automaticamente.")
          .catch(() => {});
      } catch {}
    }
  }

  // ── Parasita ───────────────────────────────────────────────────────────────
  if (guildHasPassive(guildId, "parasita")) {
    const holders = getPassiveHolders(guildId, "parasita", userId);
    if (holders.length > 0) {
      const gain = Math.floor(amount / 2);
      if (gain > 0) {
        // Escreve direto no stmt — sem passar por addChars para não disparar sombra em cima de parasita
        for (const { user_id } of holders) {
          db.queries.addChars.run(gain, user_id, guildId);
        }
      }
    }
  }

  return remaining;
};

// ─── addChars ─────────────────────────────────────────────────────────────────

export const addChars = (userId, guildId, amount) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return;
  db.queries.addChars.run(parseInt(amount), userId, guildId);

  // ── Sombra ─────────────────────────────────────────────────────────────────
  if (guildHasPassive(guildId, "sombra")) {
    const holders = getPassiveHolders(guildId, "sombra", userId);
    if (holders.length > 0) {
      const gain = Math.max(1, Math.floor(parseInt(amount) * 0.05));
      // Direto no stmt — sem passar por addChars de novo (sem loop)
      for (const { user_id } of holders) {
        db.queries.addChars.run(gain, user_id, guildId);
      }
    }
  }
};

// ─── bulk ops ────────────────────────────────────────────────────────────────

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

// ─── misc ─────────────────────────────────────────────────────────────────────

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