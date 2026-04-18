import { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { achievements } from "../functions/achievmentsData.js";
import {
  getOrCreateUser,
} from "../database.js";
import { CLASSES, getClassModifier, formatModifier } from "../functions/classes.js";
import {
  resolveDisplayAvatarURL,
  discordDisplayLabel,
  customEmojis,
} from "../functions/utils.js";
import { log } from "../bot.js";
import { getInventory } from "../functions/inventario.js";
import { getActiveEffects } from "../functions/effects.js";
import { SHOP_ITEMS } from "../data/shopItems.js";
import { ALLOWED_MESSAGE_BOT_ID } from "../data/config.js";

export const name = "stats";
export const aliases = ["estatísticas", "stat", "perfil", "profile", "dados"];

const EMBED_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE"];
function getRandomColor() {
  return EMBED_COLORS[Math.floor(Math.random() * EMBED_COLORS.length)];
}

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription(`Mostra estatísticas do usuário.`)
  .addUserOption((opt) =>
    opt
      .setName("usuário")
      .setDescription("De quem ver as stats (padrão: você)")
      .setRequired(false)
  );

function parseTarget(data) {
  if (data.fromInteraction) {
    return data.getUser("usuário") ?? null;
  }
  return data.mentionedUser ?? null;
}

function parseAchievements(user) {
  try {
    return JSON.parse(user.achievements_unlocked || "{}");
  } catch {
    return {};
  }
}

// ===== FORMATAÇÃO DE TEMPO =====
function formatTimeRemaining(milliseconds) {
  if (milliseconds < 0) return "Expirado";
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const mins = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

function formatInventoryResume(userId, guildId) {
  const inventory = getInventory(userId, guildId);
  if (!inventory || inventory.length === 0) return null;

  const items = inventory.map(item => {
    const shopItem = SHOP_ITEMS[item.id];
    const name = shopItem?.name || item.id;
    return `• **${name}**`;
  });

  return items.join("\n");
}

// ===== MAPEAMENTO DE EFEITOS =====
function getEffectLabel(effectName) {
  const effectMap = {
    char_discount: `${customEmojis.enchantedBook || "📦"} Desconto (msgs -50% chars)`,
    immunity: `${customEmojis.shield || "🛡️"} Imunidade a penalidades`,
    shield_robbery: `${customEmojis.shield || "🛡️"} Protegido contra roubos`,
    char_double_cost: `${customEmojis.skullAndRoses || "⚠️"} Custo duplo (msgs +100% chars)`,
    free_messages: `${customEmojis.pepePray || "✨"} Mensagens grátis`,
    next_rob_takes_all: `${customEmojis.pointingGun || "🥷"} Próximo roubo leva tudo`,
    mystery: `${customEmojis.loading || "✨"} Efeito misterioso`,
  };
  
  return effectMap[effectName] || `✨ ${effectName}`;
}

// ===== FORMATAÇÃO DE EFEITOS =====
function formatEffects(userId, guildId) {
  const effects = getActiveEffects(userId, guildId);
  if (!effects || effects.length === 0) return null;

  const formatted = effects.map(eff => {
    const label = getEffectLabel(eff.effect);
    
    if (eff.expiresAt) {
      const now = Date.now();
      const timeLeft = eff.expiresAt - now;
      if (timeLeft > 0) {
        const timeStr = formatTimeRemaining(timeLeft);
        return `${label} (${timeStr})`;
      }
    }
    return label;
  });

  return formatted.join("\n");
}

function formatAchievements(unlocked) {
  const unlockedKeys = Object.keys(unlocked);
  if (!unlockedKeys.length) return "_Nenhuma ainda_";

  return unlockedKeys
    .map(key => {
      const ach = achievements[key];
      return ach ? `• ${ach.icon} **${ach.title}**` : `• 🏆 ${key}`;
    })
    .join("\n");
}

function embedResumo(user, discordUser, guildId, embedColor) {
  const cls = CLASSES[user.user_class || "none"];
  const penalityName = user && user.penality ? user.penality : "Nenhuma";
  const name = discordDisplayLabel(discordUser);
  const icon = resolveDisplayAvatarURL(discordUser);
  const thumb = resolveDisplayAvatarURL(discordUser, { size: 256 });
  const unlocked = parseAchievements(user);
  const achCount = Object.keys(unlocked).length;
  const totalAch = Object.keys(achievements).length;

  const eb = new EmbedBuilder()
    .setColor(embedColor)
    .setDescription(`**Estatisticas**`)
    .addFields(
      {
        name: `${customEmojis.ironIngot || "💎"} Chars`,
        value: `${(user.charLeft ?? 0).toLocaleString()}`,
        inline: true,
      },
      {
        name: `${customEmojis.verifiedBlue || "📚"} Classe`,
        value: `${cls?.name ?? "—"}`,
        inline: true,
      },
      {
        name: `${customEmojis.pointingGun || "🥷"} Roubos Hoje`,
        value: `${user.daily_robberies ?? 0}/3`,
        inline: true,
      }
    );

  eb.addFields({
    name: `${customEmojis.skullAndRoses || "⚠️"} Penalidade`,
    value: `${penalityName}`,
    inline: true,
  });

  eb.addFields({
    name: `${customEmojis.pepeCruz || "🏆"} Conquistas`,
    value: `${achCount}/${totalAch}`,
    inline: true,
  });

  const effectsResume = formatEffects(user.id, guildId);
  if (effectsResume) {
    eb.addFields({
      name: `${customEmojis.loading || "✨"} Efeitos Ativos`,
      value: effectsResume,
      inline: true,
    });
  }

  const invResume = formatInventoryResume(user.id, guildId);
  if (invResume) {
    eb.addFields({
      name: `${customEmojis.enchantedBook || "📦"} Inventário`,
      value: invResume,
      inline: true,
    });
  }

  eb.setFooter({ text: `Navegue com os botões` });

  if (icon) eb.setAuthor({ name, iconURL: icon });
  if (thumb) eb.setThumbnail(thumb);
  return eb;
}

function embedConquistas(user, discordUser, embedColor) {
  const unlocked = parseAchievements(user);
  const pretty = formatAchievements(unlocked);
  const icon = resolveDisplayAvatarURL(discordUser);
  const thumb = resolveDisplayAvatarURL(discordUser, { size: 256 });
  const total = Object.keys(achievements).length;
  const n = Object.keys(unlocked).length;
  const label = discordDisplayLabel(discordUser);

  const eb = new EmbedBuilder()
    .setColor(embedColor)
    .setDescription(`**${label}**`)
    .addFields({
      name: `${customEmojis.pepeCruz || "🏆"} Desbloqueadas (${n}/${total})`,
      value: pretty.length > 1024 ? pretty.slice(0, 1020) + "…" : pretty || "_Nenhuma ainda_",
      inline: false,
    })
    .setFooter({ text: `Navegue com os botões` });

  if (icon) eb.setAuthor({ name: label, iconURL: icon });
  if (thumb) eb.setThumbnail(thumb);
  return eb;
}

const STATS_PAGES = ["inventario", "geral", "roubos", "recompensas", "mensagens", "estilo"];

function getPageEmbed(user, discordUser, guildId, pageIndex, embedColor) {
  const page = STATS_PAGES[pageIndex] || "geral";
  const cls = CLASSES[user.user_class || "none"];
  const penality = user.penality || "Nenhuma";
  const name = discordDisplayLabel(discordUser);
  const icon = resolveDisplayAvatarURL(discordUser);
  const thumb = resolveDisplayAvatarURL(discordUser, { size: 256 });
  const invResume = formatInventoryResume(user.id, guildId);
  const effectsResume = formatEffects(user.id, guildId);

  const eb = new EmbedBuilder()
    .setColor(embedColor);

  if (icon) eb.setAuthor({ name, iconURL: icon });
  if (thumb) eb.setThumbnail(thumb);

  switch (page) {
    case "inventario":
      eb.setDescription(`**Yui Stats** — Inventário & Efeitos`);
      
      const inventory = getInventory(user.id, guildId);
      if (inventory && inventory.length > 0) {
        const itemsWithDesc = inventory.map(item => {
          const shopItem = SHOP_ITEMS[item.id];
          if (!shopItem) return null;
          return `**${shopItem.name}**\n_${shopItem.description}_`;
        }).filter(Boolean).join("\n\n");
        
        if (itemsWithDesc) {
          eb.addFields({
            name: `${customEmojis.enchantedBook || "📦"} Itens Comprados`,
            value: itemsWithDesc.length > 1024 ? itemsWithDesc.slice(0, 1020) + "…" : itemsWithDesc,
            inline: false,
          });
        }
      }
      
      if (effectsResume) {
        eb.addFields({
          name: `${customEmojis.loading || "✨"} Efeitos Ativos`,
          value: effectsResume,
          inline: false,
        });
      }
      
      if ((!inventory || inventory.length === 0) && !effectsResume) {
        eb.addFields({
          name: "Vazio",
          value: "Nenhum item ou efeito ativo no momento.",
          inline: false,
        });
      }
      break;

    case "geral":
      eb.setDescription(`**Yui Stats** — Essencial`);
      const luckValue = getClassModifier(user.user_class, "lucky");
      eb.addFields({
        name: "\u200b",
        value:
          `**Saldo:** ${customEmojis.ironIngot} ${(user.charLeft ?? 0).toLocaleString()} chars\n` +
          `**Classe:** ${cls?.name ?? "Nenhuma"}\n` +
          `**Penalidade ativa:** ${penality}\n` +
          `${penality === "palavra_obrigatoria" ? `**Palavra:** ${user.penalityWord || "—"}\n` : ""}` +
          `**Sorte:** ${formatModifier(luckValue)}`,
        inline: false,
      });
      break;

    case "roubos":
      eb.setDescription(`**Yui Stats** — Roubos`);
      eb.addFields({
        name: "\u200b",
        value:
          `**Roubos hoje:** ${user.daily_robberies ?? 0}/3\n` +
          `**Derrotas seguidas:** ${user.consecutive_robbery_losses ?? 0}\n` +
          `**Último dia de roubo:** ${user.lastRoubo || "—"}\n` +
          `**Total de roubos:** ${user.total_robberies ?? 0}`,
        inline: false,
      });
      break;

    case "recompensas":
      eb.setDescription(`**Yui Stats** — Recompensas por cabeças`);
      eb.addFields({
        name: "\u200b",
        value:
          `**Coletadas:** ${user.bounties_claimed ?? 0}\n` +
          `**Colocadas:** ${user.bounties_placed ?? 0}\n` +
          `**Como alvo:** ${user.times_bountied ?? 0}\n` +
          `**Valor total:** ${(user.total_bounty_value ?? 0).toLocaleString()} chars\n` +
          `**Último colocador:** ${user.bounty_placer || "—"}`,
        inline: false,
      });
      break;

    case "mensagens":
      eb.setDescription(`**Yui Stats** — Atividade & Comunicação`);
      eb.addFields({
        name: "\u200b",
        value:
          `**Enviadas:** ${user.messages_sent ?? 0}\n` +
          `**Comandos usados:** ${user.bot_commands_used ?? 0}\n` +
          `**Bom dia's (realmente de dia):** ${user.morning_messages ?? 0}\n` +
          `**Mensagens as 03:33:** ${user.specific_time_messages ?? 0}\n` +
          `**Mensagens entre 2h e 6h:** ${user.night_owl_messages ?? 0}\n` +
          `**Textão:** ${user.textao_messages ?? 0}\n` +
          `**Perguntas (?):** ${user.question_marks ?? 0}\n` +
          `**Perguntas longas (+100 chars):** ${user.long_questions ?? 0}`,
        inline: false,
      });
      break;

    case "estilo":
      eb.setDescription(`**Yui Stats** — Estilo de Comunicação`);
      eb.addFields({
        name: "\u200b",
        value:
          `**Palavrões ditos:** ${user.swears_count ?? 0}\n` +
          `**Risadas (kkkk):** ${user.laught_messages ?? 0}\n` +
          `**Mensagens em CAPS:** ${user.caps_lock_messages ?? 0}\n` +
          `**Suspense (...):** ${user.suspense_messages ?? 0}\n` +
          `**Monólogos seguidos:** ${user.monologo_streak ?? 0}`,
        inline: false,
      });
      break;
  }

  eb.setFooter({ text: `${pageIndex + 1}/${STATS_PAGES.length}` });
  return eb;
}

// ===== BOTÕES =====
function createModeButtons(currentMode) {
  const buttons = [];
  
  if (currentMode !== "resumo") {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("stats_mode_resumo")
        .setLabel("Resumo")
        .setStyle(ButtonStyle.Secondary)
    );
  }
  
  if (currentMode !== "full") {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("stats_mode_full")
        .setLabel("Completo")
        .setStyle(ButtonStyle.Secondary)
    );
  }
  
  if (currentMode !== "conquistas") {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("stats_mode_conquistas")
        .setLabel("Conquistas")
        .setStyle(ButtonStyle.Secondary)
    );
  }
  
  return new ActionRowBuilder().addComponents(buttons);
}

function createNavigationButtons(pageIndex, totalPages) {
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("stats_prev")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0)
  );

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("stats_page_info")
      .setLabel(`${pageIndex + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("stats_next")
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1)
  );

  return row;
}

export async function execute(client, data) {
  try {
    const mode = "resumo";
    const mentionedUser = parseTarget(data);
    const { userId, guildId, displayName, username } = data;
    
    if (mentionedUser && mentionedUser.bot && mentionedUser.id !== ALLOWED_MESSAGE_BOT_ID) {
      return await data.reply("❌ Não posso mostrar stats de um bot!");
    }
    
    const targetUserId = mentionedUser ? mentionedUser.id : userId;
    
    const discordUser = mentionedUser || {
      id: userId,
      username,
      displayName,
      displayAvatarURL: () => client.users.cache.get(userId)?.displayAvatarURL() || data.avatarURL?.(),
    };
    
    const targetDisplayName = mentionedUser
      ? discordDisplayLabel(mentionedUser)
      : displayName;

    const userData = getOrCreateUser(targetUserId, targetDisplayName, guildId);
    if (!userData) {
      if (mentionedUser) {
        return await data.reply(`❌ **${mentionedUser.username}** não está registrado no banco de dados.`);
      }
      return await data.reply("❌ Erro ao carregar seus dados.");
    }

    const embedColor = getRandomColor();
    let embed;
    const components = [createModeButtons(mode)];

    if (mode === "resumo") {
      embed = embedResumo(userData, discordUser, guildId, embedColor);
    } else if (mode === "conquistas") {
      embed = embedConquistas(userData, discordUser, embedColor);
    } else {
      embed = getPageEmbed(userData, discordUser, guildId, 0, embedColor);
      components.push(createNavigationButtons(0, STATS_PAGES.length));
    }

    const reply = await data.reply({ embeds: [embed], components });

    const collector = reply.createMessageComponentCollector({
      time: 120000,
      filter: (i) => i.user.id === userId,
    });

    let currentPage = 0;
    let currentMode = mode;
    let currentColor = embedColor;

    collector.on("collect", async (interaction) => {
      if (interaction.customId.startsWith("stats_mode_")) {
        const newMode = interaction.customId.replace("stats_mode_", "");
        currentMode = newMode;
        currentPage = 0;

        let newEmbed;
        const newComponents = [createModeButtons(newMode)];

        if (newMode === "resumo") {
          newEmbed = embedResumo(userData, discordUser, guildId, currentColor);
        } else if (newMode === "conquistas") {
          newEmbed = embedConquistas(userData, discordUser, currentColor);
        } else {
          newEmbed = getPageEmbed(userData, discordUser, guildId, 0, currentColor);
          newComponents.push(createNavigationButtons(0, STATS_PAGES.length));
        }

        await interaction.update({ embeds: [newEmbed], components: newComponents });
      } else if (interaction.customId === "stats_prev") {
        if (currentPage > 0) currentPage--;
        const newEmbed = getPageEmbed(userData, discordUser, guildId, currentPage, currentColor);
        const newComponents = [createModeButtons(currentMode), createNavigationButtons(currentPage, STATS_PAGES.length)];
        await interaction.update({ embeds: [newEmbed], components: newComponents });
      } else if (interaction.customId === "stats_next") {
        if (currentPage < STATS_PAGES.length - 1) currentPage++;
        const newEmbed = getPageEmbed(userData, discordUser, guildId, currentPage, currentColor);
        const newComponents = [createModeButtons(currentMode), createNavigationButtons(currentPage, STATS_PAGES.length)];
        await interaction.update({ embeds: [newEmbed], components: newComponents });
      }
    });

    collector.on("end", async () => {
      await reply.edit({ components: [] }).catch(() => {});
    });
  } catch (error) {
    log(`❌ Erro ao executar comando stats: ${error.message}`, "Stats", 31);
    return await data.reply("❌ Erro ao processar comando.");
  }
}
