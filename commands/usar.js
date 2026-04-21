import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ChannelFlags,
  StringSelectMenuBuilder,
} from 'discord.js';
import { getInventory, removeFromInventory } from '../functions/inventario.js';
import { addEffect } from '../functions/effects.js';
import { SHOP_ITEMS } from '../data/shopItemsData.js';
import { db, getServerConfig } from '../database.js';
import { randomInt } from 'es-toolkit';
import { setCharsBulk } from '../functions/database/users.js';
import { customEmojis } from "../functions/utils.js";

// ───────────────────────── helpers ──────────────────────────

export const name = "usar";
export const aliases = ["ativar", "use", "equipar"];
export const requiresCharLimit = true;

const SLOT_EMOJI = ['1️⃣', '2️⃣', '3️⃣'];
const MAX_DISPLAY = 3;

function buildInventoryEmbed(userId, guildId, inventory) {
  const embed = new EmbedBuilder()
    .setTitle('Seu Inventário')
    .setColor(0xf39c12)
    .setFooter({ 
      text: `${inventory.length}/3 slots usados` 
    });

  if (!inventory.length) {
    embed.setDescription('Seu inventário está vazio. Compre itens na /loja!');
    return embed;
  }

  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    const itemDef = SHOP_ITEMS[item.id];
    const added = `<t:${Math.floor(item.addedAt / 1000)}:R>`;
    const durStamp = item.duration 
      ? `\n⏳ Expira em ${Math.floor(item.duration / 1000 / 60)} minutos` 
      : '';

    embed.addFields({
      name: `${SLOT_EMOJI[i]} ${itemDef?.name ?? item.id}`,
      value: `${itemDef?.description ?? 'Sem descrição'}\n📅 Adquirido ${added}${durStamp}`,
      inline: false,
    });
  }

  return embed;
}

function buildInventoryButtons(inventory) {
  const rows = [];
  
  for (let i = 0; i < inventory.length; i += MAX_DISPLAY) {
    const row = new ActionRowBuilder();
    const end = Math.min(i + MAX_DISPLAY, inventory.length);
    
    for (let j = i; j < end; j++) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`inv_use_${j}`)
          .setLabel(`Usar ${j + 1}`)
          .setEmoji(SLOT_EMOJI[j % MAX_DISPLAY])
          .setStyle(ButtonStyle.Primary),
      );
    }
    
    rows.push(row);
  }

  return rows;
}

// ───────────────────────── aplicar item ─────────────────────
async function applyInventoryItem(userId, guildId, item, itemDef, targetId) {
  const { getOrCreateUser, setUserProperty } = await import('../database.js');
  const { hasEffect } = await import('../functions/effects.js');

  const expiresAt = item.duration ? Date.now() + item.duration : null;
  const durStr = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : '';

  if (itemDef.nonStackable && hasEffect(userId, guildId, itemDef.effect)) {
    return `❌ **${itemDef.name}** não é stackável! Você já tem esse efeito ativo.`;
  }

  const negativeEffects = ['char_double_cost'];

  if (itemDef.requiresTarget && targetId !== userId && negativeEffects.includes(itemDef.effect)) {
    const hasBlockEffect = hasEffect(targetId, guildId, 'immunity');
    if (hasBlockEffect) {
      return `🛡️ <@${targetId}> está protegido com "Fora da Lei"! não da pra pegar um fora da lei! ele nao respeita leis!`;
    }
  }

  switch (itemDef.effect) {
    case 'char_double_cost':
      addEffect(targetId, guildId, 'char_double_cost', expiresAt);
      return `Maldição lançada em <@${targetId}>! Agora ele vai gastar o dobro de chars (expira ${durStr}).`;

    case 'swap_chars': {
      const userData = await getOrCreateUser(userId, guildId);
      const targetData = await getOrCreateUser(targetId, guildId);

      if (!targetData || !targetData.charLeft) {
        return 'Usuário alvo não encontrado no banco de dados.';
      }

      const myChars = userData.charLeft;
      const theirChars = targetData.charLeft;

      await setUserProperty('charLeft', userId, guildId, theirChars);
      await setUserProperty('charLeft', targetId, guildId, myChars);

      return `Troca feita! Você tinha **${myChars}** chars e <@${targetId}> tinha **${theirChars}**`;
    }

    case 'reincarnate': {
      const { resetUserData } = await import('../database.js');
      const success = resetUserData(userId, guildId);

      if (!success) {
        return '❌ Erro ao resetar dados do usuário. Tente novamente!';
      }

      return `🔄 **${itemDef.name}** aplicada em <@${userId}>!\n\nTodos os seus dados foram apagados, mas seus **chars** foram preservados! Bem-vindo à sua nova vida!`;
    }

    case 'char_discount':
      addEffect(userId, guildId, 'char_discount', expiresAt);
      return `☕ **${itemDef.name}** ativado! Suas mensagens gastam 50% menos (expira ${durStr}).`;

    case 'immunity':
      addEffect(userId, guildId, 'immunity', expiresAt);
      return `🛡️ **${itemDef.name}** ativado! Você tem imunidade a penalidades (expira ${durStr}).`;

    case 'free_messages':
      addEffect(userId, guildId, 'free_messages', expiresAt);
      return `**${itemDef.name}** ativado! Você não gasta chars (expira ${durStr}).`;

    case 'next_rob_takes_all':
      addEffect(userId, guildId, 'next_rob_takes_all', expiresAt);
      return `**${itemDef.name}** ativado! Seu próximo roubo leva TUDO (válido para 1x roubo).`;

    case 'shield_robbery':
      addEffect(userId, guildId, 'shield_robbery', expiresAt);
      return `🛡️ **${itemDef.name}** ativado! Você está protegido contra roubos por 24 horas.`;

    case 'char_bomb': {
      const { getGuildUsers } = await import('../database.js');
      const users = getGuildUsers(guildId);

      if (users.length === 0) {
        return '💣 Ninguém pra destruir chars?! que droga!';
      }

      const destruirPorPessoa = 1000;
      let totalDestruido = 0;
      const afetados = [];

      for (const user of users) {
        const charsAtuais = user.charLeft ?? 0;
        const destruir = Math.min(destruirPorPessoa, charsAtuais);

        if (destruir > 0) {
          await setUserProperty('charLeft', user.id, guildId, charsAtuais - destruir);
          totalDestruido += destruir;
          afetados.push(`<@${user.id}>: -${destruir} chars`);
        }
      }

      return `💣 **BOMBA DETONADA!**\n\n🔥 ${totalDestruido} chars foram destruídos de todos!\n\n${afetados.slice(0, 5).join('\n')}${afetados.length > 5 ? `\n... e mais ${afetados.length - 5}` : ''}`;
    }

    case 'redistribute': {
      const { getGuildUsers } = await import('../database.js');
      const allUsers = getGuildUsers(guildId);

      if (allUsers.length === 0) {
        return '🤝 Não há ninguém no servidor para redistribuir chars.';
      }

      let totalChars = 0;
      for (const user of allUsers) {
        totalChars += user.charLeft ?? 0;
      }

      const share = Math.floor(totalChars / allUsers.length);
      const remainder = totalChars % allUsers.length;

      for (const user of allUsers) {
        await setUserProperty('charLeft', user.id, guildId, share);
      }

      if (remainder > 0) {
        const lucky = allUsers[Math.floor(Math.random() * allUsers.length)];
        await setUserProperty('charLeft', lucky.id, guildId, share + remainder);

        return `**EQUALIZADOR APLICADO!**\n\nTodos voces camaradas agora têm **${share}** chars! (Ah, e sobraram ${remainder} chars, entregues para <@${lucky.id}>)`;
      }

      return `**EQUALIZADOR APLICADO!**\n\nTodos voces camaradas agora têm **${share}** chars!`;
    }

    case 'shuffle_balances': {
      const { getGuildUsers } = await import('../database.js');
      const users = getGuildUsers(guildId);

      if (users.length < 2) {
        return 'Não há usuários suficientes para embaralhar.';
      }

      const balances = users.map(u => u.charLeft ?? 0);

      for (let i = balances.length - 1; i > 0; i--) {
        const j = randomInt(0, i);
        [balances[i], balances[j]] = [balances[j], balances[i]];
      }

      setCharsBulk(users.map((u, i) => ({ userId: u.id, guildId, amount: balances[i] })));

      return '**EMBARALHADOR SOMBRIO ATIVADO!**\n\nOs chars de todos os membros foram redistribuídos aleatoriamente!';
    }

    case 'mystery': {
      const { getGuildUsers } = await import('../database.js');

      const effects = [
        {
          name: 'Renda extra!',
          action: async () => {
            const bonus = randomInt(2000, 5000);
            const userData = await getOrCreateUser(userId, guildId);
            await setUserProperty('charLeft', userId, guildId, (userData?.charLeft ?? 0) + bonus);
            return `Você ganhou **${bonus}** chars! 💰`;
          }
        },
        {
          name: 'IMPOSTO!!!',
          action: async () => {
            const userData = await getOrCreateUser(userId, guildId);
            const loss = Math.min(randomInt(1000, 3000), userData?.charLeft ?? 0);
            await setUserProperty('charLeft', userId, guildId, (userData?.charLeft ?? 0) - loss);
            return `Você perdeu **${loss}** chars de imposto pra Yui! 😭`;
          }
        },
        {
          name: 'Dobro de gasto',
          action: async () => {
            addEffect(userId, guildId, 'char_double_cost', Date.now() + 6 * 60 * 60 * 1000);
            return 'Você tá gastando 2x mais chars por 6 horas!';
          }
        },
        {
          name: 'Troca aleatória',
          action: async () => {
            const users = getGuildUsers(guildId);
            if (users.length > 1) {
              const randomUser = users[randomInt(0, users.length - 1)];
              const userData = await getOrCreateUser(userId, guildId);
              const targetData = await getOrCreateUser(randomUser.id, guildId);
              const userChars = userData?.charLeft ?? 0;
              const targetChars = targetData?.charLeft ?? 0;

              await setUserProperty('charLeft', userId, guildId, targetChars);
              await setUserProperty('charLeft', randomUser.id, guildId, userChars);

              return `Seus chars foram trocados com <@${randomUser.id}>!\n\nAgora você tem **${targetChars}** chars e eles têm **${userChars}** chars! 🔄`;
            }
            return 'Ninguém pra trocar com você! 😅';
          }
        },
        {
          name: 'Proteção',
          action: async () => {
            addEffect(userId, guildId, 'immunity', Date.now() + 12 * 60 * 60 * 1000);
            return 'Você ganhou imunidade a penalidades por 12 horas! 🛡️';
          }
        },
        {
          name: 'Roleta do Silvio Santos',
          action: async () => {
            const resultado = randomInt(1, 3);
            if (resultado === 1) {
              const userData = await getOrCreateUser(userId, guildId);
              await setUserProperty('charLeft', userId, guildId, (userData?.charLeft ?? 0) * 2);
              return 'Você DUPLICOU seus chars! 🤑';
            } else if (resultado === 2) {
              const userData = await getOrCreateUser(userId, guildId);
              await setUserProperty('charLeft', userId, guildId, Math.floor((userData?.charLeft ?? 0) / 2));
              return 'Você PERDEU METADE dos seus chars! 💸';
            } else {
              return 'Nada aconteceu... talvez próxima vez! 🎲';
            }
          }
        },
        {
          name: 'Prêmio pela cabeça!',
          action: async () => {
            const users = getGuildUsers(guildId);
            if (users.length === 0) {
              return 'Não há ninguém pra colocar uma recompensa! 😅';
            }

            const targetUser = users[randomInt(0, users.length - 1)];
            const bountyAmount = randomInt(500, 2500);
            const userData = await getOrCreateUser(userId, guildId);

            await setUserProperty('bounty_placer', targetUser.id, guildId, userData?.display_name || 'Usuário Desconhecido');
            await setUserProperty('total_bounty_value', targetUser.id, guildId, bountyAmount);

            const message = targetUser.id === userId
              ? `Uma recompensa de **${bountyAmount}** chars foi colocada na **SUA** cabeça! Cuidado!\n\nQue comece a caçada!`
              : `Uma recompensa de **${bountyAmount}** chars foi colocada na cabeça de <@${targetUser.id}>!\n\nQue comece a caçada!`;

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
        return '❌ Você já tem esse efeito! A Moeda da Sorte não é stackável.';
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
      addEffect(userId, guildId, 'guaranteed_rob', expiresAt);
      return `**${itemDef.name}** concluído! Seu próximo roubo é 100% garantido!`;
    }

    case 'halve_wealth': {
      const targetData = await getOrCreateUser(targetId, guildId);
      const currentChars = targetData.charLeft;

      if(!currentChars || currentChars <= 1) {
        return `<@${targetId}> tem pouquíssimos chars, o **${itemDef.name}** não teve efeito!`;
      }

      const half = Math.floor(currentChars / 2);
      const destroyed = currentChars - half;

      await setUserProperty('charLeft', targetId, guildId, half);

      return `**${itemDef.name}** ativado!\n\n<@${targetId}> perdeu **${destroyed}** chars (ficou com ${half})`;
    }

    case 'server_chaos': {
      const { getGuildUsers } = await import('../database.js');

      const users = getGuildUsers(guildId);
      const randomValidEffects = Object.values(SHOP_ITEMS).filter(i => i.effect && i.duration() !== null);
      
      let message = '🌪️ **CAOS DA YUI ATIVADO!**\n\n';
      for (const user of users) {
        const effect = randomValidEffects[randomInt(0, randomValidEffects.length - 1)];
        const expires = Date.now() + effect.duration();
        addEffect(user.id, guildId, effect.effect, expires);
        message += `<@${user.id}> recebeu o efeito **${effect.name}** (expira <t:${Math.floor(expires / 1000)}:R>)\n`;
      }
      return message;
    }

    case 'credit_card': {
      const userData = await getOrCreateUser(userId, guildId);
      const currentBalance = userData?.charLeft ?? 0;
      
      await setUserProperty('credit_limit', userId, guildId, currentBalance);
      await setUserProperty('credit_debt', userId, guildId, 0);
      
      const now = Date.now();
      const duration = typeof itemDef.duration === 'function' ? itemDef.duration() : itemDef.duration;
      const expiresAt = duration ? now + duration : null;
      addEffect(userId, guildId, 'credit_card_active', expiresAt);
      
      const daysLeft = duration ? Math.ceil(duration / (24 * 60 * 60 * 1000)) : 0;
      return `💳 **${itemDef.name}** ativado!\n\nVocê pode gastar até **${currentBalance}** chars negativos.\nConforme você ganhar chars, a dívida será paga automaticamente.\nA fatura fecha daqui a **${daysLeft} dia(s)**!`;
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

  const embed = buildInventoryEmbed(userId, guildId, inventory);
  const itemButtons = inventory.length ? buildInventoryButtons(inventory) : [];

  const components = itemButtons;

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

  let pendingSlot = null;

  collector.on('collect', async (comp) => {
    if (comp.user.id !== userId) return;

    if (comp.customId.startsWith('inv_use_')) {
      const slotIndex = parseInt(comp.customId.replace('inv_use_', ''));
      const item = inventory[slotIndex];
      const itemDef = SHOP_ITEMS[item.id];

      if (!itemDef) {
        return comp.update({ content: '❌ Item inválido no inventário.', embeds: [], components: [] });
      }

      const isMysteryItem = itemDef.effect === 'mystery';
      if (isMysteryItem) {
        const mysteryLoading = new EmbedBuilder()
          .setColor('#8E44AD')
          .setTitle(`${customEmojis.loading} 🗑️ Lixo Lendário ativado...`)
          .setDescription('Algo esta se revelando desse pedaço de lixo...');

        await comp.update({ embeds: [mysteryLoading], components: [] });
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

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



      const result = await applyInventoryItem(userId, guildId, item, itemDef, userId);
      removeFromInventory(userId, guildId, slotIndex);
      inventory.splice(slotIndex, 1);
      collector.stop();
      return isMysteryItem
        ? comp.editReply({ content: result, embeds: [], components: [] })
        : comp.update({ content: result, embeds: [], components: [] });
    }

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
      inventory.splice(pendingSlot, 1);
      pendingSlot = null;
      collector.stop();
      return comp.update({ content: result, embeds: [], components: [] });
    }

    if (comp.customId === 'inv_cancel') {
      pendingSlot = null;
      const newEmbed = buildInventoryEmbed(userId, guildId, inventory);
      const newItemButtons = buildInventoryButtons(inventory);
      return comp.update({
        content: null,
        embeds: [newEmbed],
        components: newItemButtons,
      });
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      reply.edit({ content: '⏰ Tempo esgotado.', embeds: [], components: [] }).catch(() => {});
    }
  });
}