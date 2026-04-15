import { db } from '../database.js';

const MAX_SLOTS = 3;

export function getInventory(userId, guildId) {
  if (!userId || !guildId) return [];
  
  const items = db.queries.getInventory.all(userId, guildId);
  return items.map(row => ({
    id: row.item_id,
    slot: row.slot,
    addedAt: row.added_at,
    duration: row.duration
  }));
}

export function getInventorySize(userId, guildId) {
  return getInventory(userId, guildId).length;
}

export function addToInventory(userId, guildId, item) {
  const current = getInventory(userId, guildId);
  
  if (current.length >= MAX_SLOTS) {
    return { success: false, error: 'Inventário cheio (máximo 3 itens)' };
  }
  
  const nextSlot = current.length;
  const now = Date.now();
  const duration = item.duration || null;
  
  try {
    db.queries.addInventoryItem.run(
      userId, 
      guildId, 
      nextSlot, 
      item.id, 
      now, 
      duration
    );
    return { success: true, slot: nextSlot };
  } catch (error) {
    console.error('[addToInventory] Erro:', error);
    return { success: false, error: 'Erro ao adicionar item' };
  }
}

export function removeFromInventory(userId, guildId, slotIndex) {
  try {
    // Remove the item from the specified slot
    db.queries.removeInventoryItem.run(userId, guildId, slotIndex);
    
    // Shift down all items above the removed slot to maintain contiguous slots
    db.queries.clearInventorySlot.run(userId, guildId, slotIndex);
    
    return true;
  } catch (error) {
    console.error('[removeFromInventory] Erro:', error);
    return false;
  }
}

export function hasItem(userId, guildId, itemId) {
  const inventory = getInventory(userId, guildId);
  return inventory.some(item => item.id === itemId);
}