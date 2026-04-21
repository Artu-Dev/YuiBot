import { db } from '../database.js';
import { SHOP_ITEMS } from '../data/shopItemsData.js';
import dayjs from 'dayjs';

// 'day'  'week' 'month'
const RESTART_SHOP = 'day';

const ITEMS_POR_SEMANA = 3;

function getPeriodKey(guildId) {
  const periodStart = dayjs().startOf(RESTART_SHOP);
  const dateStr = periodStart.format('YYYYMMDD');
  const periodLabel = RESTART_SHOP.toUpperCase();
  return `${guildId}_${dateStr}_${periodLabel}`;
}

function generateWeeklyShop() {
  const entries = Object.entries(SHOP_ITEMS);
  
  const rarityWeights = {
    comum: 50,
    incomum: 30,
    raro: 15,
    lendário: 5
  };
  
  const selectedItems = [];
  const usedItems = new Set();
  
  for (let i = 0; i < ITEMS_POR_SEMANA; i++) {
    let totalWeight = 0;
    const availableEntries = entries.filter(([id, item]) => !usedItems.has(id));
    
    const weightedEntries = availableEntries.map(([id, item]) => {
      const weight = rarityWeights[item.rarity] || 10;
      totalWeight += weight;
      return { id, item, weight, cumulative: totalWeight };
    });
    
    if (weightedEntries.length === 0) break;
    
    const random = Math.random() * totalWeight;
    const selected = weightedEntries.find(entry => random <= entry.cumulative);
    
    if (selected) {
      const itemDef = selected.item;
      usedItems.add(selected.id);
      selectedItems.push({
        id: selected.id,
        price: typeof itemDef.price === 'function' ? itemDef.price() : (itemDef.price || 1000),
        duration: itemDef.duration ? (typeof itemDef.duration === 'function' ? itemDef.duration() : itemDef.duration) : null,
        stock: 1,
      });
    }
  }
  
  return selectedItems;
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