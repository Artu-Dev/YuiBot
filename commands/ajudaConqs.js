import {
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelFlags,
} from "discord.js";
import { achievements } from "../functions/achievmentsData.js";
import { getOrCreateUser } from "../database.js";
import { getBotPrefix } from "../database.js";
import { resolveDisplayAvatarURL, discordDisplayLabel } from "../functions/utils.js";
import { log } from "../bot.js";

export const name = "conquistas";
export const aliases = ["conqs", "achievements", "cq"];

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE    = 4; 
const COLLECTOR_TTL = 60_000;

const CATEGORIES = {
  activity: { label: "Atividade",   emoji: "💬" },
  social:   { label: "Social",      emoji: "👥" },
  verbal:   { label: "Verbal",      emoji: "🗣️" },
  robbery:  { label: "Roubos",      emoji: "🥷" },
  tiger:    { label: "Tigrinho",    emoji: "🐯" },
  bounty:   { label: "Recompensas", emoji: "🏴‍☠️" },
  special:  { label: "Especiais",   emoji: "✨" },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

// ─── Slash command ────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("conquistas")
  .setDescription("Veja o progresso das suas conquistas.")
  .addStringOption((opt) =>
    opt
      .setName("categoria")
      .setDescription("Filtrar por categoria (padrão: resumo geral)")
      .setRequired(false)
      .addChoices(
        { name: "💬 Atividade",   value: "activity" },
        { name: "👥 Social",      value: "social"   },
        { name: "🗣️ Verbal",      value: "verbal"   },
        { name: "🥷 Roubos",      value: "robbery"  },
        { name: "🐯 Tigrinho",    value: "tiger"    },
        { name: "🏴‍☠️ Recompensas", value: "bounty"   },
        { name: "✨ Especiais",   value: "special"  }
      )
  )
  .addUserOption((opt) =>
    opt
      .setName("usuário")
      .setDescription("Ver conquistas de outro usuário (padrão: você)")
      .setRequired(false)
  );

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseUnlocked(user) {
  try {
    return new Set(Object.keys(JSON.parse(user.achievements_unlocked || "{}")));
  } catch {
    return new Set();
  }
}

const CAT_FALLBACK_ICON = {
  activity: "🏅", social: "🏅", verbal: "🏅",
  robbery: "🥷", tiger: "🐯", bounty: "🏴‍☠️", special: "🌟",
};

function resolveIcon(ach) {
  return ach.icon && String(ach.icon).trim() !== ""
    ? ach.icon
    : CAT_FALLBACK_ICON[ach.category] ?? "🏆";
}

function progressBar(current, total, size = 7) {
  const pct     = total > 0 ? Math.min(current / total, 1) : 0;
  const filled  = Math.round(pct * size);
  const bar     = "🟩".repeat(filled) + "⬛".repeat(size - filled);
  const pctStr  = Math.floor(pct * 100);
  return `${bar}  **${pctStr}%** (${current}/${total})`;
}

function formatBlock(achKey, ach, unlockedSet, userStats) {
  const isUnlocked = unlockedSet.has(achKey);
  const icon       = resolveIcon(ach);

  if (isUnlocked) {
    const secretBadge = ach.secret ? " 🌟" : "";
    return [
      `${icon} **${ach.title}**${secretBadge}`,
      `-# ${ach.description}`,
      `-# ${ach.charPoints.toLocaleString("pt-BR")} chars`,
    ].join("\n");
  }

  if (ach.secret) return null;

  const lines = [`🔒 **${ach.title}**`, `-# ${ach.description}`];

  if (typeof ach.progress === "function") {
    const { current, total } = ach.progress(userStats);
    if (total > 1) {
      lines.push(`-# ${progressBar(current, total)}`);
    }
  }

  return lines.join("\n");
}

function paginate(entries) {
  const pages = [];
  for (let i = 0; i < entries.length; i += PAGE_SIZE) {
    pages.push(entries.slice(i, i + PAGE_SIZE));
  }
  return pages.length ? pages : [[]];
}

// ─── Componentes Visuais ──────────────────────────────────────────────────────

function buildOverviewComponents(userId) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`conqs_select_${userId}`)
    .setPlaceholder("Selecione uma categoria...")
    .addOptions(
      CATEGORY_KEYS.map((key) => {
        const { label, emoji } = CATEGORIES[key];
        return new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(key)
          .setEmoji(emoji);
      })
    );
  return [new ActionRowBuilder().addComponents(selectMenu)];
}

function buildCategoryComponents(pageIdx, totalPages, userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`conqs_prev_${userId}`)
        .setEmoji("◀")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIdx === 0),
      new ButtonBuilder()
        .setCustomId(`conqs_next_${userId}`)
        .setEmoji("▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= 1 || pageIdx === totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`conqs_menu_${userId}`)
        .setLabel("Voltar ao Menu")
        .setEmoji("🏠")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

// ─── Embeds ───────────────────────────────────────────────────────────────────

function buildPageEmbed(pages, pageIdx, cat, discordUser, unlockedSet) {
  const catInfo        = CATEGORIES[cat];
  const catAchsEntries = Object.entries(achievements).filter(([_, a]) => a.category === cat);
  const catAchs        = catAchsEntries.map(([_, a]) => a);
  const visible        = catAchs.filter((a) => !a.secret);
  const unlockedInCat  = catAchsEntries.filter(([key, _]) => unlockedSet.has(key)).map(([_, a]) => a);
  const secretUnlocked = catAchsEntries.filter(([key, a]) => a.secret && unlockedSet.has(key)).map(([_, a]) => a);

  const label = discordDisplayLabel(discordUser);
  const icon  = resolveDisplayAvatarURL(discordUser);
  const thumb = resolveDisplayAvatarURL(discordUser, { size: 256 });
  const prefix = getBotPrefix();

  const secretNote = secretUnlocked.length > 0
    ? `  •  🌟 +${secretUnlocked.length} secreta${secretUnlocked.length > 1 ? "s" : ""}`
    : "";

  const pageContent = pages[pageIdx].join("\n\n") || "_Nenhuma conquista aqui_";

  const eb = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setAuthor({
      name: `${label} — ${catInfo.emoji} ${catInfo.label}`,
      ...(icon ? { iconURL: icon } : {}),
    })
    .setDescription(
      `**${unlockedInCat.length}/${visible.length}** desbloqueadas${secretNote}\n\n${pageContent}`
    )
    .setFooter({
      text: `Página ${pageIdx + 1} de ${pages.length}  •  ${prefix}conquistas [categoria]`,
    });

  if (thumb) eb.setThumbnail(thumb);
  return eb;
}

function buildOverviewEmbed(discordUser, unlockedSet) {
  const allAchsEntries = Object.entries(achievements);
  const allAchs        = allAchsEntries.map(([_, a]) => a);
  const totalSecrets   = allAchs.filter((a) => a.secret).length;
  const totalVisible   = allAchs.length - totalSecrets;
  const unlockedTotal  = unlockedSet.size;
  const secretsUnlocked = allAchsEntries.filter(([key, a]) => a.secret && unlockedSet.has(key)).length;

  const label  = discordDisplayLabel(discordUser);
  const icon   = resolveDisplayAvatarURL(discordUser);
  const thumb  = resolveDisplayAvatarURL(discordUser, { size: 256 });
  const prefix = getBotPrefix();

  const globalBar = progressBar(unlockedTotal, totalVisible, 10);

  const categoryLines = CATEGORY_KEYS.map((cat) => {
    const catAchsEntries = allAchsEntries.filter(([_, a]) => a.category === cat);
    const catAchs        = catAchsEntries.map(([_, a]) => a);
    const catVisible     = catAchs.filter((a) => !a.secret);
    const catUnlocked    = catAchsEntries.filter(([key, _]) => unlockedSet.has(key)).length;
    const catSecrets     = catAchsEntries.filter(([key, a]) => a.secret && unlockedSet.has(key)).length;
    const { emoji, label: catLabel } = CATEGORIES[cat];

    const total   = catVisible.length;
    const filled  = total > 0 ? Math.round((catUnlocked / total) * 8) : 0;
    const miniBar = "▰".repeat(filled) + "▱".repeat(8 - filled);
    const secretStr = catSecrets > 0 ? `  🌟×${catSecrets}` : "";

    return `${emoji} **${catLabel}** \`${miniBar}\`  ${catUnlocked}/${total}${secretStr}`;
  }).join("\n");

  const secretNote = secretsUnlocked > 0
    ? `\n> 🌟 ${secretsUnlocked} conquista${secretsUnlocked > 1 ? "s secretas" : " secreta"} desbloqueada${secretsUnlocked > 1 ? "s" : ""}`
    : "";

  const eb = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setAuthor({
      name: `${label} — Conquistas`,
      ...(icon ? { iconURL: icon } : {}),
    })
    .setDescription(`-# ${globalBar}${secretNote}`)
    .addFields({
      name: "📊 Por categoria",
      value: categoryLines,
      inline: false,
    })
    .setFooter({
      text: `${prefix}conquistas [categoria]  •  secretas aparecem ao desbloquear`,
    });

  if (thumb) eb.setThumbnail(thumb);
  return eb;
}

// ─── Execute ──────────────────────────────────────────────────────────────────

export async function execute(client, data) {
  try {
    const mentionedUser = data.fromInteraction
      ? (data.getUser("usuário") ?? null)
      : (data.mentionedUser ?? null);

    const { userId, guildId, displayName, username } = data;
    const targetId   = mentionedUser ? mentionedUser.id   : userId;
    const targetName = mentionedUser ? discordDisplayLabel(mentionedUser) : displayName;

    const discordUser = mentionedUser ?? {
      id: userId,
      username,
      displayName,
      displayAvatarURL: (opts) => data.avatarURL(opts),
    };

    let currentCat = null;
    let currentPage = 0;

    if (data.fromInteraction) {
      currentCat = data.getString("categoria") ?? null;
    } else {
      const arg = (data.args ?? [])[0]?.toLowerCase();
      if (arg) {
        currentCat = CATEGORY_KEYS.find(
          (k) => k === arg || CATEGORIES[k].label.toLowerCase().startsWith(arg)
        ) ?? null;
      }
    }

    const userData = getOrCreateUser(targetId, targetName, guildId);
    if (!userData) return await data.reply("❌ Erro ao carregar dados do usuário.");

    const unlockedSet = parseUnlocked(userData);

    const getPayload = () => {
      if (!currentCat) {
        return {
          embeds: [buildOverviewEmbed(discordUser, unlockedSet)],
          components: buildOverviewComponents(userId),
        };
      }

      const catAchs = Object.entries(achievements)
        .filter(([_, a]) => a.category === currentCat)
        .map(([key, ach]) => formatBlock(key, ach, unlockedSet, userData))
        .filter(Boolean);
      
      // Definir pages ANTES de usá-la
      const pages = paginate(catAchs);
      currentPage = Math.max(0, Math.min(currentPage, pages.length - 1));

      return {
        embeds: [buildPageEmbed(pages, currentPage, currentCat, discordUser, unlockedSet)],
        components: buildCategoryComponents(currentPage, pages.length, userId),
      };
    };

    const reply = await data.reply(getPayload());
    const message = data.fromInteraction ? await data.fetchReply() : reply;

    const collector = message.createMessageComponentCollector({
      filter: (i) => {
        if (i.user.id !== userId) {
          i.reply({ content: "Esses botões não são seus.", flags: ChannelFlags.Ephemeral });
          return false;
        }
        return i.customId.endsWith(`_${userId}`);
      },
      time: COLLECTOR_TTL,
    });

    collector.on("collect", async (interaction) => {
      const id = interaction.customId;

      if (id.startsWith("conqs_prev")) currentPage--;
      else if (id.startsWith("conqs_next")) currentPage++;
      else if (id.startsWith("conqs_menu")) {
        currentCat = null;
        currentPage = 0;
      } 
      else if (id.startsWith("conqs_select")) {
        currentCat = interaction.values[0];
        currentPage = 0;
      }

      await interaction.update(getPayload());
    });

    collector.on("end", async () => {
      await message.edit({ components: [] }).catch(() => null);
    });

  } catch (err) {
    log(`❌ Erro no comando conquistas: ${err.message}`, "Comando", 31);
    return await data.reply("❌ Erro ao processar comando.");
  }
}