import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ComponentType,
} from 'discord.js';
import { getInventory, removeFromInventory } from '../functions/inventario.js';
import { addEffect } from '../functions/effects.js';
import {SHOP_ITEMS} from '../data/shopItems.js';
import {db} from '../database.js';
import { randomInt } from 'es-toolkit';

// ───────────────────────── helpers ──────────────────────────

export const name = "usar";
export const aliases = ["ativar", "use", "equipar"];

const SLOT_EMOJI = ['1️⃣', '2️⃣', '3️⃣'];
const MAX_DISPLAY = 3;

function buildInventoryEmbed(userId, guildId, inventory, displayStartIndex = 0) {
  const displayItems = inventory.slice(displayStartIndex, displayStartIndex + MAX_DISPLAY);
  
  const embed = new EmbedBuilder()
    .setTitle('🎒 Seu Inventário')
    .setColor(0xf39c12)
    .setFooter({ text: `${inventory.length}/3 slots usados • Página ${Math.floor(displayStartIndex / MAX_DISPLAY) + 1}` });

  if (!inventory.length) {
    embed.setDescription('Seu inventário está vazio. Compre itens na `/loja`!');
    return embed;
  }

  for (let i = 0; i < displayItems.length; i++) {
    const item = displayItems[i];
    const itemDef = SHOP_ITEMS[item.id];
    const added = `<t:${Math.floor(item.addedAt / 1000)}:R>`;
    const durStamp = item.duration ? `\n⏳ Expira em ${Math.floor(item.duration / 1000 / 60)} minutos` : '';

    embed.addFields({
      name: `${SLOT_EMOJI[i]} ${itemDef?.name ?? item.id}`,
      value: `${itemDef?.description ?? 'Sem descrição'}\n📅 Adquirido ${added}${durStamp}`,
      inline: false,
    });
  }

  return embed;
}

function buildInventoryButtons(inventory, displayStartIndex = 0) {
  const displayItems = inventory.slice(displayStartIndex, displayStartIndex + MAX_DISPLAY);
  const row = new ActionRowBuilder();

  for (let i = 0; i < displayItems.length; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`inv_use_${displayStartIndex + i}`)
        .setLabel(`Usar ${i + 1}`)
        .setEmoji(SLOT_EMOJI[i])
        .setStyle(ButtonStyle.Primary),
    );
  }

  return [row];
}

function buildPaginationButtons(inventory, displayStartIndex = 0) {
  const row = new ActionRowBuilder();
  const hasMore = inventory.length > displayStartIndex + MAX_DISPLAY;
  const hasPrev = displayStartIndex > 0;

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('inv_prev')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasPrev),

    new ButtonBuilder()
      .setCustomId('inv_next')
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasMore),
  );

  return row;
}

// ───────────────────────── aplicar item ─────────────────────
async function applyInventoryItem(userId, guildId, item, itemDef, targetId) {
  const { getUser, setUserProperty } = await import('../database.js');
  
  const expiresAt = item.duration ? Date.now() + item.duration : null;
  const durStr = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'permanente';

  switch (itemDef.effect) {
    case 'char_double_cost':
      addEffect(targetId, guildId, 'char_double_cost', expiresAt);
      return `🃏 Maldição lançada em <@${targetId}>! Eles vão gastar o dobro de chars (expira ${durStr}).`;

    case 'swap_chars': {
      const userData = getUser(userId, guildId);
      const targetData = getUser(targetId, guildId);
      
      const myChars = userData?.charLeft ?? 0;
      const theirChars = targetData?.charLeft ?? 0;
      
      // Swap the values
      setUserProperty('charLeft', userId, guildId, theirChars);
      setUserProperty('charLeft', targetId, guildId, myChars);
      
      return `🔀 Troca feita! Você tinha **${myChars}** chars e <@${targetId}> tinha **${theirChars}**. Agora estão invertidos!`;
    }

    case 'reset_achievement':
      return `🔄 Conquista de <@${targetId}> resetada! (implemente conforme seu sistema de conquistas)`;

    case 'char_discount':
      addEffect(userId, guildId, 'char_discount', expiresAt);
      return `☕ **${itemDef.name}** ativado! Suas mensagens custam 50% menos (expira ${durStr}).`;

    case 'immunity':
      addEffect(userId, guildId, 'immunity', expiresAt);
      return `🛡️ **${itemDef.name}** ativado! Você tem imunidade a penalidades (expira ${durStr}).`;

    case 'free_messages':
      addEffect(userId, guildId, 'free_messages', expiresAt);
      return `🍽️ **${itemDef.name}** ativado! Você não gasta chars (expira ${durStr}).`;

    case 'next_rob_takes_all':
      addEffect(userId, guildId, 'next_rob_takes_all', expiresAt);
      return `🔫 **${itemDef.name}** ativado! Seu próximo roubo leva TUDO (válido para 1x roubo).`;

    case 'char_bomb': {
      const { getGuildUsers } = await import('../database.js');
      const users = getGuildUsers(guildId);
      
      if (users.length === 0) {
        return `💣 Ninguém pra destruir chars! 😅`;
      }

      const charParaDestruir = 1000;
      const destruirPorPessoa = Math.floor(charParaDestruir / users.length);
      
      let totalDestruido = 0;
      const afetados = [];
      
      for (const user of users) {
        const charsAtuais = user.charLeft ?? 0;
        const destruir = Math.min(destruirPorPessoa, charsAtuais);
        
        if (destruir > 0) {
          setUserProperty('charLeft', user.id, guildId, charsAtuais - destruir);
          totalDestruido += destruir;
          afetados.push(`<@${user.id}>: -${destruir} chars`);
        }
      }
      
      return `💣 **BOMBA DETONADA!**\n\n🔥 ${totalDestruido} chars foram destruídos!\n\n${afetados.slice(0, 5).join('\n')}${afetados.length > 5 ? `\n... e mais ${afetados.length - 5}` : ''}`;
    }

    case 'mystery': {
      const { getGuildUsers } = await import('../database.js');
      
      const effects = [
        {
          name: '🎉 Sorte!',
          action: async () => {
            const bonus = randomInt(2000, 5000);
            const userData = getUser(userId, guildId);
            setUserProperty('charLeft', userId, guildId, (userData?.charLeft ?? 0) + bonus);
            return `Você ganhou **${bonus}** chars! 💰`;
          }
        },
        {
          name: '💀 Azar!',
          action: async () => {
            const userData = getUser(userId, guildId);
            const loss = Math.min(randomInt(1000, 3000), userData?.charLeft ?? 0);
            setUserProperty('charLeft', userId, guildId, (userData?.charLeft ?? 0) - loss);
            return `Você perdeu **${loss}** chars! 😭`;
          }
        },
        {
          name: '📈 Multiplicador',
          action: async () => {
            addEffect(userId, guildId, 'message_multiplier', Date.now() + 6 * 60 * 60 * 1000);
            return `Seus chars de mensagem estão em 2x por 6 horas! 🚀`;
          }
        },
        {
          name: '🎪 Caos Total',
          action: async () => {
            const users = getGuildUsers(guildId);
            if (users.length > 1) {
              const randomUser = users[randomInt(0, users.length - 1)];
              const userData = getUser(userId, guildId);
              const targetData = getUser(randomUser.id, guildId);
              const userChars = userData?.charLeft ?? 0;
              const targetChars = targetData?.charLeft ?? 0;
              
              setUserProperty('charLeft', userId, guildId, targetChars);
              setUserProperty('charLeft', randomUser.id, guildId, userChars);
              
              return `Seus chars foram trocados com <@${randomUser.id}>! 🌀`;
            }
            return `Ninguém pra trocar com você! 😅`;
          }
        },
        {
          name: '🛡️ Proteção',
          action: async () => {
            addEffect(userId, guildId, 'immunity', Date.now() + 12 * 60 * 60 * 1000);
            return `Você ganhou imunidade a penalidades por 12 horas! 🛡️`;
          }
        },
        {
          name: '🎲 Rouleta',
          action: async () => {
            const resultado = randomInt(1, 3);
            if (resultado === 1) {
              const userData = getUser(userId, guildId);
              setUserProperty('charLeft', userId, guildId, (userData?.charLeft ?? 0) * 2);
              return `Você DUPLICOU seus chars! 🤑`;
            } else if (resultado === 2) {
              const userData = getUser(userId, guildId);
              setUserProperty('charLeft', userId, guildId, Math.floor((userData?.charLeft ?? 0) / 2));
              return `Você PERDEU METADE dos seus chars! 💸`;
            } else {
              return `Nada aconteceu... talvez próxima vez! 🎲`;
            }
          }
        }
      ];
      
      const chosen = effects[randomInt(0, effects.length - 1)];
      addEffect(userId, guildId, 'lixo_collector');
      
      const result = await chosen.action();
      return `🗑️ Lixo Lendário ativou: **${chosen.name}**\n\n${result}`;
    }

    default:
      return `✅ Item **${itemDef.name}** usado com sucesso! ${durStr}`;
  }
}

// ───────────────────────── comando ──────────────────────────
export const data = new SlashCommandBuilder()
  .setName('usar')
  .setDescription('🎒 Abre seu inventário e usa um item');

export async function execute(client, data) {
  const userId = data.userId;
  const guildId = data.guildId;
  const inventory = getInventory(userId, guildId);

  let displayStart = 0;

  const embed = buildInventoryEmbed(userId, guildId, inventory, displayStart);
  const itemButtons = inventory.length ? buildInventoryButtons(inventory, displayStart) : [];
  const paginationButtons = inventory.length ? [buildPaginationButtons(inventory, displayStart)] : [];
  
  const components = [...itemButtons, ...paginationButtons];

  const reply = await data.reply({
    embeds: [embed],
    components: components.length ? components : [],
    ephemeral: true,
    fetchReply: true,
  });

  if (!inventory.length) return;

  const collector = reply.createMessageComponentCollector({
    time: 60_000,
  });

  // Guarda qual slot foi selecionado enquanto espera o alvo
  let pendingSlot = null;

  collector.on('collect', async (comp) => {
    if (comp.user.id !== userId) return;

    // ── Navegação de páginas ──
    if (comp.customId === 'inv_prev') {
      displayStart = Math.max(0, displayStart - MAX_DISPLAY);
      
      const newEmbed = buildInventoryEmbed(userId, guildId, inventory, displayStart);
      const newItemButtons = buildInventoryButtons(inventory, displayStart);
      const newPaginationButtons = buildPaginationButtons(inventory, displayStart);
      const newComponents = [...newItemButtons, newPaginationButtons];

      return comp.update({
        embeds: [newEmbed],
        components: newComponents,
      });
    }

    if (comp.customId === 'inv_next') {
      displayStart = Math.min(inventory.length - MAX_DISPLAY, displayStart + MAX_DISPLAY);
      
      const newEmbed = buildInventoryEmbed(userId, guildId, inventory, displayStart);
      const newItemButtons = buildInventoryButtons(inventory, displayStart);
      const newPaginationButtons = buildPaginationButtons(inventory, displayStart);
      const newComponents = [...newItemButtons, newPaginationButtons];

      return comp.update({
        embeds: [newEmbed],
        components: newComponents,
      });
    }

    // ── Clicou num botão "Usar N" ──
    if (comp.customId.startsWith('inv_use_')) {
      const slotIndex = parseInt(comp.customId.replace('inv_use_', ''));
      const item = inventory[slotIndex];
      const itemDef = SHOP_ITEMS[item.id];

      if (!itemDef) {
        return comp.update({ content: '❌ Item inválido no inventário.', embeds: [], components: [] });
      }

      // Item precisa de alvo → mostra UserSelect
      if (itemDef.requiresTarget) {
        pendingSlot = slotIndex;

        const select = new UserSelectMenuBuilder()
          .setCustomId('inv_select_target')
          .setPlaceholder(`Selecione o alvo para ${itemDef.name}`)
          .setMinValues(1)
          .setMaxValues(1);

        const cancelBtn = new ButtonBuilder()
          .setCustomId('inv_cancel')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary);

        return comp.update({
          content: `👤 **${itemDef.name}** — Selecione o alvo:`,
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(select),
            new ActionRowBuilder().addComponents(cancelBtn),
          ],
        });
      }

      // Item sem alvo → usa direto
      const result = await applyInventoryItem(userId, guildId, item, itemDef, userId);
      removeFromInventory(userId, guildId, slotIndex);
      
      // Remove from local inventory
      inventory.splice(slotIndex, 1);
      
      collector.stop();
      return comp.update({ content: result, embeds: [], components: [] });
    }

    // ── Selecionou um alvo no UserSelect ──
    if (comp.customId === 'inv_select_target' && pendingSlot !== null) {
      const targetId = comp.values[0];

      if (targetId === userId) {
        return comp.update({
          content: '❌ Você não pode usar este item em si mesmo. Selecione outro alvo:',
          components: comp.message.components,
        });
      }

      const item = inventory[pendingSlot];
      const itemDef = SHOP_ITEMS[item.id];
      const result = await applyInventoryItem(userId, guildId, item, itemDef, targetId);

      removeFromInventory(userId, guildId, pendingSlot);
      
      // Remove from local inventory
      inventory.splice(pendingSlot, 1);
      
      pendingSlot = null;
      collector.stop();
      return comp.update({ content: result, embeds: [], components: [] });
    }

    // ── Cancelou ──
    if (comp.customId === 'inv_cancel') {
      pendingSlot = null;
      const newEmbed = buildInventoryEmbed(userId, guildId, inventory, displayStart);
      const newItemButtons = buildInventoryButtons(inventory, displayStart);
      const newPaginationButtons = buildPaginationButtons(inventory, displayStart);
      const newComponents = [...newItemButtons, newPaginationButtons];

      return comp.update({
        content: null,
        embeds: [newEmbed],
        components: newComponents,
      });
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      reply.edit({ content: '⏰ Tempo esgotado.', embeds: [], components: [] }).catch(() => {});
    }
  });
}