import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  ChannelFlags,
} from 'discord.js';
import { getShop, getShopItem, decrementStock } from '../functions/shop.js';
import { addToInventory, getInventory } from '../functions/inventario.js';
import { getUser, reduceChars, getSpendableChars, getServerConfig, db } from '../database.js';
import {SHOP_ITEMS} from '../data/shopItemsData.js';
import { customEmojis } from '../functions/utils.js';

export const name = "loja";
export const aliases = ['shop', 'mall', 'comprar', 'mercado'];
export const requiresCharLimit = true;

const RARITY_COLOR = {
  comum:    0x95a5a6,
  incomum:  0x2ecc71,
  raro:     0x3498db,
  lendário: 0x9b59b6,
};

const RARITY_LABEL = {
  comum:    '⚪ Comum',
  incomum:  '🟢 Incomum',
  raro:     '🔵 Raro',
  lendário: '🟣 Lendário',
};

const MAX_INVENTORY = 3;

function buildItemEmbed(shopItem, itemDef, index, total, itemPrice = 0) {
  if (!shopItem || !itemDef) {
    return new EmbedBuilder()
      .setTitle('❌ Erro')
      .setDescription('Item não encontrado')
      .setColor(0xff0000);
  }

  const dur = shopItem.duration
    ? `${Math.round(shopItem.duration / 3_600_000)}h`
    : 'Instantâneo';

  const priceEmoji = customEmojis.lapislazuli || '💰';
  const priceLabel = `${priceEmoji} **${itemPrice || 0}** chars`;
  const durationLabel = `${dur}`;

  return new EmbedBuilder()
    .setTitle(itemDef.name || 'Item Desconhecido')
    .setDescription(itemDef.description || '')
    .setColor(RARITY_COLOR[itemDef.rarity] ?? 0xc0392b)
    .addFields(
      { name: '💰 Preço', value: priceLabel, inline: true },
      { name: '⏳ Duração', value: durationLabel, inline: true },
    )
    .setFooter({ text: `Item ${index + 1} de ${total} • ${RARITY_LABEL[itemDef.rarity] || 'Desconhecida'}` })
    .setThumbnail(itemDef.image);
}

function buildNavRow(shopItem, index, total, userChars, effectivePrice) {
  const outOfStock = !shopItem || (shopItem.stock || 0) <= 0;
  const price      = effectivePrice ?? shopItem?.price ?? 0;
  const canAfford  = userChars >= price;

  let buyLabel = 'Comprar';
  let buyStyle = ButtonStyle.Success;
  let buyDisabled = outOfStock;

  if (outOfStock) {
    buyLabel = 'Esgotado';
    buyStyle = ButtonStyle.Danger;
  } else if (!canAfford) {
    buyLabel = `Faltam ${price - userChars} chars`;
    buyStyle = ButtonStyle.Secondary;
    buyDisabled = true;
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('shop_prev')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index === 0),

    new ButtonBuilder()
      .setCustomId(`shop_buy_${shopItem?.id || 'unknown'}`)
      .setLabel(buyLabel)
      .setStyle(buyStyle)
      .setDisabled(buyDisabled),

    new ButtonBuilder()
      .setCustomId('shop_next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index === total - 1),
  );
}

function buildDisabledRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('d1').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('d2').setLabel('Comprar').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId('d3').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(true),
  );
}

async function handleBuy(user, guildId, itemId) {
  if (!user || !guildId || !itemId) return 'Parametros invalidos.';
 
  const userId   = user.id;
  const shopItem = getShopItem(guildId, itemId);
  const itemDef  = SHOP_ITEMS[itemId];
 
  if (!shopItem || !itemDef) return 'Item nao encontrado na loja de hoje.';
  if (shopItem.stock <= 0)   return 'Este item acabou de esgotar!';
 
  const itemPrice = applyInflation(shopItem.price, userId, guildId);

  const userData = getUser(userId, guildId);
  if (!userData) return 'Usuario nao encontrado no banco de dados.';
 
  const spendableChars = await getSpendableChars(userId, guildId);
  if (spendableChars < itemPrice)
    return `Voce tem **${userData.charLeft} chars** mas precisa de **${itemPrice}**.`;
 
  const inv = getInventory(userId, guildId);
  if (inv.length >= MAX_INVENTORY)
    return `Seu inventario esta cheio! (${MAX_INVENTORY}/${MAX_INVENTORY})\nUse /usar para usar um item antes.`;
 
  await reduceChars(userId, guildId, itemPrice, true);
  decrementStock(guildId, itemId);
  addToInventory(userId, guildId, { id: itemId, duration: shopItem.duration });
 
  return `**${itemDef.name}** comprado! Adicionado ao seu inventario.\nUse /usar para ativa-lo.`;
}


let _stmtInflation = null;
function applyInflation(basePrice, buyerUserId, guildId) {
  if (!_stmtInflation) {
    _stmtInflation = db.prepare(`
      SELECT user_id FROM active_effects
      WHERE guild_id = ? AND effect = 'inflacao' AND (expires_at IS NULL OR expires_at > ?)
      LIMIT 1
    `);
  }
  const inflator = _stmtInflation.get(guildId, Date.now());
  if (!inflator || inflator.user_id === buyerUserId) return basePrice;
  return Math.ceil(basePrice * 1.5);
}


export const data = new SlashCommandBuilder()
  .setName('loja')
  .setDescription('Veja os itens disponíveis na loja de hoje');

import { isValidUserId, isValidGuildId } from "../functions/validation.js";

export async function execute(client, data) {
  const guildId = data.guildId;
  
  if (!getServerConfig(guildId, 'charLimitEnabled')) {
    return await data.reply("❌ O sistema de caracteres está desligado neste servidor!");
  }
  
  if (!getServerConfig(guildId, 'shopEnabled')) {
    return await data.reply("❌ A loja está desabilitada neste servidor!");
  }
  
  if (!isValidGuildId(data.guildId)) {
    return await data.reply("Erro de configuração do servidor");
  }

  const shop = getShop(guildId);

  if (!shop || !shop.items || shop.items.length === 0) {
    return data.reply({ content: 'A loja está vazia hoje ou houve um erro ao carregar!', flags: ChannelFlags.Ephemeral });
  }

  function getEffectivePrice(item, userId, guildId) {
    return applyInflation(item.price, userId, guildId);
  }

  const userId = data.userId;  
  const userData = getUser(userId, guildId);
  const userChars = userData?.charLeft ?? 0;

  let index = 0;

  const getCurrentItem = () => shop.items[index] || null;
  const getCurrentDef = () => {
    const item = getCurrentItem();
    return item ? (SHOP_ITEMS[item.id] || null) : null;
  };

  if (!getCurrentItem() || !getCurrentDef()) {
    return data.reply({ content: 'Erro ao carregar itens da loja!', flags: ChannelFlags.Ephemeral });
  }

  const reply = await data.reply({
    embeds:     [buildItemEmbed(getCurrentItem(), getCurrentDef(), index, shop.items.length, getCurrentItem()?.price || 0)],
    components: [buildNavRow(getCurrentItem(), index, shop.items.length, userChars, getEffectivePrice(getCurrentItem(), userId, guildId))],
    withResponse: true,
  });

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 90_000,
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== data.userId)
      return btn.reply({ content: '❌ Só quem abriu a loja pode interagir.', flags: ChannelFlags.Ephemeral });

    if (btn.customId === 'shop_prev' || btn.customId === 'shop_next') {
      if (btn.customId === 'shop_prev') index = Math.max(0, index - 1);
      else                              index = Math.min(shop.items.length - 1, index + 1);

      const currItem = getCurrentItem();
      const currDef = getCurrentDef();
      
      if (!currItem || !currDef) {
        return btn.reply({ content: '❌ Erro ao navegar entre os itens!', flags: ChannelFlags.Ephemeral });
      }

      return btn.update({
        embeds:     [buildItemEmbed(currItem, currDef, index, shop.items.length, currItem.price)],
        components: [buildNavRow(currItem, index, shop.items.length, userChars)],
      });
    }

    if (btn.customId.startsWith('shop_buy_')) {
      const itemId = btn.customId.replace('shop_buy_', '');
      
      if (itemId === 'unknown') {
        return btn.reply({ content: '❌ Item inválido!', flags: ChannelFlags.Ephemeral });
      }
      
      const result = await handleBuy(btn.user, guildId, itemId);

      const freshItem = getShopItem(guildId, getCurrentItem()?.id);
      if (freshItem && getCurrentItem()) {
        Object.assign(getCurrentItem(), { stock: freshItem.stock });
      }

      await btn.update({
        embeds:     [buildItemEmbed(getCurrentItem(), getCurrentDef(), index, shop.items.length, getCurrentItem()?.price || 0)],
        components: [buildNavRow(getCurrentItem(), index, shop.items.length, userChars)],
      });

      return btn.followUp({ content: result, flags: ChannelFlags.Ephemeral });
    }
  });

  collector.on('end', () => {
    reply.edit({ components: [buildDisabledRow()] }).catch(() => {});
  });
}