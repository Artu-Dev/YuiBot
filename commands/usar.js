import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ComponentType,
  ChannelFlags,
  StringSelectMenuBuilder,
} from 'discord.js';
import { getInventory, removeFromInventory } from '../functions/inventario.js';
import { addEffect } from '../functions/effects.js';
import {SHOP_ITEMS} from '../data/shopItems.js';
import {db, getServerConfig} from '../database.js';
import { randomInt } from 'es-toolkit';

// ───────────────────────── helpers ──────────────────────────

export const name = "usar";
export const aliases = ["ativar", "use", "equipar"];
export const requiresCharLimit = true;

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
  const { hasEffect } = await import('../functions/effects.js');
  
  const expiresAt = item.duration ? Date.now() + item.duration : null;
  const durStr = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'permanente';

  // Verificar se é não-stackável e se o usuário já tem o efeito
  if (itemDef.nonStackable && hasEffect(userId, guildId, itemDef.effect)) {
    return `❌ **${itemDef.name}** não é stackável! Você já tem esse efeito ativo.`;
  }

  // Definir efeitos negativos que podem ser bloqueados
  const negativeEffects = ['char_double_cost'];

  // Verificar se target tem blockNegativeEffects (Fora da Lei)
  if (itemDef.requiresTarget && targetId !== userId && negativeEffects.includes(itemDef.effect)) {
    // Verificar se target tem immunity ativo (efeito do Fora da Lei)
    const hasBlockEffect = hasEffect(targetId, guildId, 'immunity');
    
    if (hasBlockEffect) {
      return `🛡️ <@${targetId}> está protegido com "Fora da Lei"! Você não pode lançar efeitos negativos nele!`;
    }
  }

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
      return `🔄 Selecione uma conquista para resetar`;

    case 'char_discount':
      addEffect(userId, guildId, 'char_discount', expiresAt);
      return `☕ **${itemDef.name}** ativado! Suas mensagens gastam 50% menos (expira ${durStr}).`;

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
          name: 'Renda extra!',
          action: async () => {
            const bonus = randomInt(2000, 5000);
            const userData = getUser(userId, guildId);
            setUserProperty('charLeft', userId, guildId, (userData?.charLeft ?? 0) + bonus);
            return `Você ganhou **${bonus}** chars! 💰`;
          }
        },
        {
          name: 'IMPOSTO!!!',
          action: async () => {
            const userData = getUser(userId, guildId);
            const loss = Math.min(randomInt(1000, 3000), userData?.charLeft ?? 0);
            setUserProperty('charLeft', userId, guildId, (userData?.charLeft ?? 0) - loss);
            return `Você perdeu **${loss}** chars de imposto pra Yui! 😭`;
          }
        },
        {
          name: 'Dobro de gasto',
          action: async () => {
            addEffect(userId, guildId, 'char_double_cost', Date.now() + 6 * 60 * 60 * 1000);
            return `Voce ta gastando 2x mais chars por 6 horas!`;
          }
        },
        {
          name: 'Troca aleatória',
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
              
              return `Seus chars foram trocados com <@${randomUser.id}>! \n\n Agora você tem **${targetChars}** chars e eles têm **${userChars}** chars! 🔄`;
            }
            return `Ninguém pra trocar com você! 😅`;
          }
        },
        {
          name: 'Proteção',
          action: async () => {
            addEffect(userId, guildId, 'immunity', Date.now() + 12 * 60 * 60 * 1000);
            return `Você ganhou imunidade a penalidades por 12 horas! 🛡️`;
          }
        },
        {
          name: 'Roleta do Silvio santos',
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
        },
        {
          name: 'Premio pela cabeça!',
          action: async () => {
            const { getGuildUsers } = await import('../database.js');
            const users = getGuildUsers(guildId);
            if (users.length === 0) {
              return `Não há ninguém pra colocar uma recompensa! 😅`;
            }
            
            const targetUser = users[randomInt(0, users.length - 1)];
            const bountyAmount = randomInt(500, 2500);
            const userData = getUser(userId, guildId);
            
            setUserProperty('bounty_placer', targetUser.id, guildId, userData?.display_name || 'Usuário Desconhecido');
            setUserProperty('total_bounty_value', targetUser.id, guildId, bountyAmount);
            
            const message = targetUser.id === userId
              ? `Uma recompensa de **${bountyAmount}** chars foi colocada na SUA cabeça! Cuidado!
              \n\nQue começe a caçada! `
              : `Uma recompensa de **${bountyAmount}** chars foi colocada na cabeça de <@${targetUser.id}>!
              \n\nQue começe a caçada! `;

            return message;
          }
        }
      ];
      
      const chosen = effects[randomInt(0, effects.length - 1)];
      
      const result = await chosen.action();
      return `🗑️ Lixo Lendário ativou: **${chosen.name}**\n\n${result}`;
    }

    case 'tiger_luck': {
      const existingEffect = hasEffect(userId, guildId, 'tiger_luck');
      if (existingEffect) {
        return `❌ Você já tem esse efeito! A Moeda da Sorte não é stackável.`;
      }
      addEffect(userId, guildId, 'tiger_luck', expiresAt);
      return `🍀 **${itemDef.name}** ativada! Sua sorte no tigre aumentou em 20% (expira ${durStr}).`;
    }

    case 'robbery_luck':
      addEffect(userId, guildId, 'robbery_luck', expiresAt);
      return `📖 **${itemDef.name}** aprendido! Seu próximo roubo tem +15% de sucesso!`;

    case 'robbery_damage_boost':
      addEffect(userId, guildId, 'robbery_damage_boost', expiresAt);
      return `🗡️ **${itemDef.name}** equipada! Seu dano em roubos aumentou em 35% (expira ${durStr}).`;

    case 'guaranteed_rob': {
      const targetData = getUser(targetId, guildId);
      if (!targetData) {
        return `❌ Usuário alvo não encontrado no banco de dados.`;
      }
      addEffect(userId, guildId, 'guaranteed_rob', expiresAt);
      return `🎓 **${itemDef.name}** concluído! Seu próximo roubo em <@${targetId}> é 100% garantido!`;
    }

    case 'halve_wealth': {
      const targetData = getUser(targetId, guildId);
      const currentChars = targetData?.charLeft ?? 0;
      const half = Math.floor(currentChars / 2);
      const destroyed = currentChars - half;

      setUserProperty('charLeft', targetId, guildId, half);

      return `💸 **${itemDef.name}** ativado!\n\n<@${targetId}> perdeu **${destroyed}** chars (ficou com ${half})`;
    }

    case 'server_chaos': {
      const { getGuildUsers } = await import('../database.js');
      const { randomEventsData } = await import('../data/eventsData.js');
      
      const users = getGuildUsers(guildId);
      const randomEvent = randomEventsData[Math.floor(Math.random() * randomEventsData.length)];
      
      let message = `🌪️ **CAOS DA YUI ATIVADO!**\n\n`;
      message += `**${randomEvent.name}**\n`;
      message += `${randomEvent.description}\n\n`;
      message += `Duração: ${randomEvent.charMultiplier}x chars, ${randomEvent.casinoMultiplier}x cassino`;

      // Aplicar evento para todos do servidor
      for (const user of users) {
        // Aqui você poderia salvar o evento no banco de dados para toda a guild
        // Por enquanto, apenas notificamos
      }

      return message;
    }

    default:
      return `✅ Item **${itemDef.name}** usado com sucesso! ${durStr}`;
  }
}

// ───────────────────────── comando ──────────────────────────
export const data = new SlashCommandBuilder()
  .setName('usar')
  .setDescription('Abre seu inventário e usa um item');

export async function execute(client, data) {
  const userId = data.userId;
  const guildId = data.guildId;
  
  if (!getServerConfig(guildId, 'charLimitEnabled')) {
    return await data.reply({
      content: "❌ O sistema de caracteres está desligado neste servidor!",
      flags: ChannelFlags.Ephemeral
    });
  }

  const inventory = getInventory(userId, guildId);

  let displayStart = 0;

  const embed = buildInventoryEmbed(userId, guildId, inventory, displayStart);
  const itemButtons = inventory.length ? buildInventoryButtons(inventory, displayStart) : [];
  const paginationButtons = inventory.length ? [buildPaginationButtons(inventory, displayStart)] : [];
  
  const components = [...itemButtons, ...paginationButtons];

  const reply = await data.reply({
    embeds: [embed],
    components: components.length ? components : [],
    flags: ChannelFlags.Ephemeral,
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
      if (itemDef.effect === 'reset_achievement') {
        const { getAchievements } = await import('../database.js');
        const { achievements } = await import('../functions/achievmentsData.js');
        
        const userAchievements = getAchievements(userId, guildId);
        const unlockedKeys = Object.keys(userAchievements).filter(k => userAchievements[k]);
        
        if (unlockedKeys.length === 0) {
          return comp.update({
            content: '🔄 Você não tem nenhuma conquista pra resetar! 😅',
            embeds: [],
            components: [],
          });
        }

        // Get unique categories the user has achievements in
        const userCategories = new Set();
        for (const key of unlockedKeys) {
          const achData = achievements[key];
          if (achData?.category) {
            userCategories.add(achData.category);
          }
        }

        if (userCategories.size === 0) {
          return comp.update({
            content: '🔄 Nenhuma categoria válida encontrada.',
            embeds: [],
            components: [],
          });
        }

        // Build select menu for categories
        const select = new StringSelectMenuBuilder()
          .setCustomId('inv_select_achievement')
          .setPlaceholder('Selecione uma categoria para resetar');
        
        const categoryNames = {
          special: '✨ Especiais',
          activity: '💬 Atividade',
          social: '👥 Social',
          verbal: '🗣️ Verbal',
          robbery: '🔫 Roubo',
          tiger: '🐯 Tigre',
          bounty: '💰 Recompensas',
        };

        for (const category of userCategories) {
          const achInCategory = unlockedKeys.filter(k => achievements[k]?.category === category);
          select.addOptions({
            label: categoryNames[category] || category,
            value: category,
            description: `${achInCategory.length} conquista(s) nesta categoria`,
          });
        }

        pendingSlot = slotIndex; // Store for later

        return comp.update({
          content: `🏆 **${itemDef.name}** — Qual categoria deseja resetar?`,
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(select),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('inv_cancel')
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Secondary)
            ),
          ],
        });
      }

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

    // ── Selecionou uma categoria para resetar ──
    if (comp.customId === 'inv_select_achievement' && pendingSlot !== null) {
      const categoryToReset = comp.values[0];
      const { achievements } = await import('../functions/achievmentsData.js');
      const { getAchievements } = await import('../database.js');
      const { db } = await import('../database.js');

      // Get user's current achievements
      const userAchievements = getAchievements(userId, guildId);
      
      // Find all achievements in this category
      const achievementsInCategory = Object.entries(achievements)
        .filter(([_, achData]) => achData.category === categoryToReset)
        .map(([key, _]) => key);
      
      if (achievementsInCategory.length === 0) {
        return comp.update({
          content: '❌ Nenhuma conquista encontrada nesta categoria.',
          embeds: [],
          components: [],
        });
      }

      // Remove all achievements in this category
      let removedCount = 0;
      for (const achKey of achievementsInCategory) {
        if (userAchievements[achKey]) {
          delete userAchievements[achKey];
          removedCount++;
        }
      }

      if (removedCount === 0) {
        return comp.update({
          content: `ℹ️ Você não tinha nenhuma conquista da categoria **${categoryToReset}** pra resetar.`,
          embeds: [],
          components: [],
        });
      }

      // Update database with cleaned achievements
      db.prepare('UPDATE users SET achievements_unlocked = ? WHERE id = ? AND guild_id = ?')
        .run(JSON.stringify(userAchievements), userId, guildId);

      const item = inventory[pendingSlot];
      const itemDef = SHOP_ITEMS[item.id];
      const categoryNames = {
        special: '✨ Especiais',
        activity: '💬 Atividade',
        social: '👥 Social',
        verbal: '🗣️ Verbal',
        robbery: '🔫 Roubo',
        tiger: '🐯 Tigre',
        bounty: '💰 Recompensas',
      };

      const result = `🔄 ✅ **${removedCount}** conquista(s) da categoria **${categoryNames[categoryToReset]}** foram resetadas!`;

      removeFromInventory(userId, guildId, pendingSlot);
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