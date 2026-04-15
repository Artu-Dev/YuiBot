import { db } from '../database.js';
import { SHOP_ITEMS } from '../data/shopItems.js';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';

dayjs.extend(weekOfYear);

const ITEMS_POR_SEMANA = 3;

const STOCK_PADRAO = {
  comum: 1,
  incomum: 1,
  raro: 1,
  lendário: 1,
};

// Gera uma chave única por semana e servidor
function getWeekKey(guildId) {
  const year = dayjs().year();
  const week = dayjs().week();
  return `${guildId}_${year}_W${week}`;
}

function generateWeeklyShop() {
  const entries = Object.entries(SHOP_ITEMS);
  // Embaralha o array (Fisher-Yates shuffle)
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  return entries.slice(0, ITEMS_POR_SEMANA).map(([id, item]) => ({
    id,
    price: typeof item.price === 'function' ? item.price() : (item.price || 1000),
    duration: item.duration ? (typeof item.duration === 'function' ? item.duration() : item.duration) : null,
    stock: item.stock ?? STOCK_PADRAO[item.rarity] ?? 2,
  }));
}

/**
 * Obtém a loja semanal para um servidor específico
 * @param {string} guildId - ID do servidor
 * @returns {object} { weekKey, items }
 */
export function getShop(guildId) {
  if (!guildId) {
    console.error('[getShop] guildId não fornecido');
    return { weekKey: '', items: [] };
  }
  
  const weekKey = getWeekKey(guildId);
  
  try {
    const row = db.queries.getDailyShop.get(guildId, weekKey);

    if (!row) {
      const newShop = { items: generateWeeklyShop() };
      db.queries.setDailyShop.run(guildId, weekKey, JSON.stringify(newShop.items));
      return { weekKey, items: newShop.items };
    }

    return {
      weekKey,
      items: JSON.parse(row.items || '[]')
    };
  } catch (error) {
    console.error('[getShop] Erro:', error);
    return { weekKey, items: [] };
  }
}

/**
 * Obtém um item específico da loja
 * @param {string} guildId - ID do servidor
 * @param {string} itemId - ID do item
 * @returns {object|null} Item com preço e estoque, ou null
 */
export function getShopItem(guildId, itemId) {
  if (!guildId || !itemId) return null;
  const shop = getShop(guildId);
  if (!shop || !shop.items) return null;
  return shop.items.find(i => i.id === itemId);
}

/**
 * Decrementa o estoque de um item
 * @param {string} guildId - ID do servidor
 * @param {string} itemId - ID do item
 * @returns {boolean} Sucesso
 */
export function decrementStock(guildId, itemId) {
  if (!guildId || !itemId) return false;
  
  const shop = getShop(guildId);
  if (!shop || !shop.items) return false;
  
  const item = shop.items.find(i => i.id === itemId);
  if (!item || item.stock <= 0) return false;
  
  item.stock -= 1;
  
  try {
    const weekKey = getWeekKey(guildId);
    db.queries.setDailyShop.run(guildId, weekKey, JSON.stringify(shop.items));
    return true;
  } catch (error) {
    console.error('[decrementStock] Erro:', error);
    return false;
  }
}