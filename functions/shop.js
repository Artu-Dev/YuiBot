import { db } from '../database.js';
import { SHOP_ITEMS } from '../data/shopItems.js';
import dayjs from 'dayjs';

// 'day'  'week' 'month'
const RESTART_SHOP = 'day';

const ITEMS_POR_SEMANA = 3;

const STOCK_PADRAO = {
  comum: 1,
  incomum: 1,
  raro: 1,
  lendário: 1,
};

function getPeriodKey(guildId) {
  const periodStart = dayjs().startOf(RESTART_SHOP);
  const dateStr = periodStart.format('YYYYMMDD');
  const periodLabel = RESTART_SHOP.toUpperCase();
  return `${guildId}_${dateStr}_${periodLabel}`;
}

function generateWeeklyShop() {
  const entries = Object.entries(SHOP_ITEMS);
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

export function getShop(guildId) {
  if (!guildId) {
    console.error('[getShop] guildId não fornecido');
    return { periodKey: '', items: [] };
  }
  
  const periodKey = getPeriodKey(guildId);
  
  try {
    const row = db.queries.getDailyShop.get(guildId, periodKey);

    if (!row) {
      const newShop = { items: generateWeeklyShop() };
      db.queries.setDailyShop.run(guildId, periodKey, JSON.stringify(newShop.items));
      return { periodKey, items: newShop.items };
    }

    return {
      periodKey,
      items: JSON.parse(row.items || '[]')
    };
  } catch (error) {
    console.error('[getShop] Erro:', error);
    return { periodKey, items: [] };
  }
}

export function getShopItem(guildId, itemId) {
  if (!guildId || !itemId) return null;
  const shop = getShop(guildId);
  if (!shop || !shop.items) return null;
  return shop.items.find(i => i.id === itemId);
}

export function decrementStock(guildId, itemId) {
  if (!guildId || !itemId) return false;
  
  try {
    const decrementTransaction = db.transaction(() => {
      const shop = getShop(guildId);
      if (!shop || !shop.items) return false;
      
      const item = shop.items.find(i => i.id === itemId);
      if (!item || item.stock <= 0) return false;
      
      item.stock -= 1;
      
      const periodKey = getPeriodKey(guildId);
      db.queries.setDailyShop.run(guildId, periodKey, JSON.stringify(shop.items));
      return true;
    });
    
    return decrementTransaction();
  } catch (error) {
    console.error('[decrementStock] Erro:', error);
    return false;
  }
}