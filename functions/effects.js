import { db } from '../database.js';
import { SHOP_ITEMS } from '../data/shopItemsData.js';

export function getActiveEffects(userId, guildId) {
  if (!userId || !guildId) return [];
  
  const now = Date.now();
  
  // Limpa efeitos expirados primeiro
  db.queries.clearExpiredEffects.run(userId, guildId, now);
  
  // Retorna os ativos restantes
  const rows = db.queries.getActiveEffects.all(userId, guildId);
  return rows.map(row => ({
    effect: row.effect,
    itemId: row.item_id,
    addedAt: row.added_at,
    expiresAt: row.expires_at
  }));
}

export function hasEffect(userId, guildId, effectName) {
  return getActiveEffects(userId, guildId).some(e => e.effect === effectName);
}

export function addEffect(userId, guildId, effect, expiresAt = null, itemId = null) {
  if (!userId || !guildId) return false;
  
  const now = Date.now();
  
  try {
    db.queries.addActiveEffect.run(
      userId,
      guildId,
      effect,
      itemId,
      now,
      expiresAt
    );
    return true;
  } catch (error) {
    console.error('[addEffect] Erro:', error);
    return false;
  }
}

export function removeEffect(userId, guildId, effectName) {
  if (!userId || !guildId) return false;
  
  try {
    db.queries.removeActiveEffect.run(userId, guildId, effectName);
    return true;
  } catch (error) {
    console.error('[removeEffect] Erro:', error);
    return false;
  }
}

export function applyShopEffect(userId, guildId, itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item || !item.effect) return false;

  const now = Date.now();
  const duration = typeof item.duration === 'function' ? item.duration() : (item.duration || null);
  const expiresAt = duration ? now + duration : null;

  removeEffect(userId, guildId, item.effect);
  
  return addEffect(userId, guildId, item.effect, expiresAt, itemId);
}

export function getCharMultiplier(userId, guildId) {
  const effects = getActiveEffects(userId, guildId);
  let multiplier = 1.0;

  if (effects.some(e => e.effect === 'char_discount')) multiplier *= 0.5;
  if (effects.some(e => e.effect === 'char_double_cost')) multiplier *= 2.0;
  if (effects.some(e => e.effect === 'free_messages')) multiplier = 0;

  return multiplier;
}