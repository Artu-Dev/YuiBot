import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { achievements } from "../functions/achievmentsData.js";
import {
  getOrCreateUser,
  hasEscudo,
  getEscudoTimeRemaining,
  db,
} from "../database.js";
import { CLASSES } from "../functions/classes.js";
import {
  resolveDisplayAvatarURL,
  discordDisplayLabel,
} from "../functions/utils.js";
import { getBotPrefix } from "../database.js";

export const name = "stats";

function normalizeModeToken(raw) {
  if (!raw) return null;
  const r = String(raw).toLowerCase();
  if (r === "ver" || r === "full" || r === "completo" || r === "tudo") return "full";
  if (r === "conquistas" || r === "conqs") return "conquistas";
  if (r === "resumo") return "resumo";
  return null;
}

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription(`Mostra estatísticas do usuário.`)
  .addStringOption((opt) =>
    opt
      .setName("modo")
      .setDescription("Padrão: resumo rápido")
      .setRequired(false)
      .addChoices(
        { name: "Resumo (padrão)", value: "resumo" },
        { name: "Completo — todas as métricas", value: "full" },
        { name: "Só conquistas", value: "conquistas" }
      )
  )
  .addUserOption((opt) =>
    opt
      .setName("usuário")
      .setDescription("De quem ver as stats (padrão: você)")
      .setRequired(false)
  );

function resolveMode(data) {
  if (data.fromInteraction) {
    return data.getString("modo") || "resumo";
  }
  const a = data.args ?? [];
  const m = normalizeModeToken(a[0]);
  if (m) return m;
  return "resumo";
}

function parseTarget(data) {
  if (data.fromInteraction) {
    return data.getUser("usuário") ?? null;
  }
  return data.mentionedUser ?? null;
}

function buildDiscordFacade(data, mentionedUser, userId, username, displayName) {
  if (mentionedUser) return mentionedUser;
  return {
    id: userId,
    username,
    displayName,
    displayAvatarURL: (opts) => data.avatarURL(opts),
  };
}

function parsePenalties(user) {
  try {
    const list = JSON.parse(user.penalities || "[]");
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

function parseAchievements(user) {
  try {
    return JSON.parse(user.achievements_unlocked || "{}");
  } catch {
    return {};
  }
}

function formatAchievements(unlocked) {
  const keys = Object.keys(unlocked);
  if (!keys.length) return "_Nenhuma ainda_";
  return keys
    .map((key) => {
      const ach = achievements[key];
      return ach ? `• ${ach.emoji} **${ach.name}**` : `• 🏆 ${key}`;
    })
    .join("\n");
}

function maybeEscudoFooter(user, guildId) {
  if (!hasEscudo(user.id, guildId)) return "";
  const today = new Date().toISOString().split("T")[0];
  const lastEscudoShown = user.last_escudo_shown || "";
  if (lastEscudoShown === today) return "";
  const remainingTime = getEscudoTimeRemaining(user.id, guildId);
  try {
    db.prepare(`UPDATE users SET last_escudo_shown = ? WHERE id = ? AND guild_id = ?`).run(
      today,
      user.id,
      guildId
    );
  } catch (e) {
    console.error(`⚠️  Erro ao atualizar last_escudo_shown:`, e);
  }
  return `\n🛡️ **Escudo ativo:** ${remainingTime}`;
}

function baseAuthor(discordUser) {
  const name = `${discordDisplayLabel(discordUser)} — Estatísticas`;
  const icon = resolveDisplayAvatarURL(discordUser);
  const thumb = resolveDisplayAvatarURL(discordUser, { size: 256 });
  return { name, icon, thumb };
}

function embedResumo(user, discordUser, guildId) {
  const cls = CLASSES[user.user_class || "none"];
  const penN = parsePenalties(user);
  const escudoExtra = maybeEscudoFooter(user, guildId);
  const { name, icon, thumb } = baseAuthor(discordUser);

  const unlocked = parseAchievements(user);
  const achCount = Object.keys(unlocked).length;
  const totalAch = Object.keys(achievements).length;

  const eb = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setDescription(`**${user.display_name}** — Estatísticas${escudoExtra}`)
    .addFields(
      {
        name: "💎 Conta",
        value:
          `**Chars:** ${(user.charLeft ?? 0).toLocaleString()}\n` +
          `**Classe:** ${cls?.name ?? "Nenhuma"}\n` +
          `**Sorte:** ${user.luck_stat > 0 ? "+" : ""}${user.luck_stat ?? 0}`,
        inline: true,
      },
      {
        name: "🥷 Roubos & Recompensas",
        value:
          `**Roubos hoje:** ${user.daily_robberies ?? 0}/3\n` +
          `**Total roubos:** ${user.total_robberies ?? 0}\n` +
          `**Derrotas seguidas:** ${user.consecutive_robbery_losses ?? 0}\n` +
          `**Recompensas caçadas:** ${user.bounties_claimed ?? 0}\n` +
          `**Recompensas colocadas:** ${user.bounties_placed ?? 0}\n` +
          `**Vezes como alvo:** ${user.times_bountied ?? 0}`,
        inline: true,
      },
      {
        name: "🎰 Tigre e Penalidades ⚠️",
        value:
          `**Penalidades ativas:** ${penN}\n` +
          `**Conquistas:** ${achCount}/${totalAch}`,
        inline: false,
      },
      {
        name: "📋 Variações de comando",
        value:
          `**Slash:** \`/stats\` (padrão) | \`/stats full\` | \`/stats conquistas\`\n` +
          `**Prefixo:** \`${getBotPrefix()}stats\` | \`${getBotPrefix()}stats full\` | \`${getBotPrefix()}stats conqs\``,
        inline: false,
      }
    )
    .setFooter({ text: `ID: ${discordUser.id}` });

  if (icon) eb.setAuthor({ name, iconURL: icon });
  if (thumb) eb.setThumbnail(thumb);
  return eb;
}

function embedConquistas(user, discordUser) {
  const unlocked = parseAchievements(user);
  const pretty = formatAchievements(unlocked);
  const { icon, thumb } = baseAuthor(discordUser);
  const total = Object.keys(achievements).length;
  const n = Object.keys(unlocked).length;
  const label = discordDisplayLabel(discordUser);

  const eb = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setDescription(`**${label}** — **${n}/${total}** conquistas`)
    .addFields(
      {
        name: "🏆 Desbloqueadas",
        value: pretty.length > 2048 ? pretty.slice(0, 2000) + "…" : pretty,
        inline: false,
      },
      {
        name: "📋 Voltar ao resumo",
        value:
          `**Slash:** \`/stats\` | \`/stats full\`\n` +
          `**Prefixo:** \`${getBotPrefix()}stats\` | \`${getBotPrefix()}stats full\``,
        inline: false,
      }
    )
    .setFooter({ text: `ID: ${discordUser.id}` });

  if (icon) eb.setAuthor({ name: `${label} — Conquistas`, iconURL: icon });
  if (thumb) eb.setThumbnail(thumb);
  return eb;
}

function embedFull(user, discordUser, guildId) {
  const cls = CLASSES[user.user_class || "none"];
  const penN = parsePenalties(user);
  const escudoExtra = maybeEscudoFooter(user, guildId);
  const unlocked = parseAchievements(user);
  const achPretty = formatAchievements(unlocked);
  const { name, icon, thumb } = baseAuthor(discordUser);

  const eb = new EmbedBuilder()
    .setColor("#8A2BE2")
    .setDescription(`**${user.display_name}** — Painel Completo${escudoExtra}`)
    .addFields(
      {
        name: "💎 Geral",
        value:
          `**Chars restantes (mês):** ${(user.charLeft ?? 0).toLocaleString()}\n` +
          `**Classe:** ${cls?.name ?? "Nenhuma"}\n` +
          `**Sorte:** ${user.luck_stat > 0 ? "+" : ""}${user.luck_stat ?? 0}\n`,
        inline: false,
      },
      {
        name: "💬 Mensagens & hábitos",
        value:
          `**Enviadas:** ${user.messages_sent ?? 0}\n` +
          `**Perguntas (?):** ${user.question_marks ?? 0}\n` +
          `**CAPS LOCK:** ${user.caps_lock_messages ?? 0} · **Streak CAPS:** ${user.caps_streak ?? 0}\n` +
          `**Coruja (2h–6h):** ${user.night_owl_messages ?? 0}\n` +
          `**“Bom dia” de dia:** ${user.morning_messages ?? 0}\n` +
          `**Mensagens às 03:33:** ${user.specific_time_messages ?? 0}\n` +
          `**Perguntas longas (+100):** ${user.long_questions ?? 0}\n` +
          `**Risadas (kkkk…):** ${user.laught_messages ?? 0}\n` +
          `**Palavrões:** ${user.swears_count ?? 0}`,
        inline: true,
      },
      {
        name: "🎭 Estilo de mensagem",
        value:
          `**Suspense:** ${user.suspense_messages ?? 0}\n` +
          `**Textão:** ${user.textao_messages ?? 0}\n` +
          `**Monólogo (streak):** ${user.monologo_streak ?? 0}`,
        inline: true,
      },
      {
        name: "🥷 Roubos & defesa",
        value:
          `**Roubos hoje:** ${user.daily_robberies ?? 0}/3\n` +
          `**Total de roubos:** ${user.total_robberies ?? 0}\n` +
          `**Derrotas seguidas:** ${user.consecutive_robbery_losses ?? 0}\n` +
          `**Último dia de roubo:** ${user.lastRoubo || "—"}`,
        inline: true,
      },
      {
        name: "🏴‍☠️ Sistema de Recompensas",
        value:
          `**Recompensas colocadas:** ${user.bounties_placed ?? 0}\n` +
          `**Recompensas caçadas:** ${user.bounties_claimed ?? 0}\n` +
          `**Vezes como alvo:** ${user.times_bountied ?? 0}\n` +
          `**Valor total oferecido:** ${(user.total_bounty_value ?? 0).toLocaleString()} chars\n` +
          `**Último bounty placer:** ${user.bounty_placer || "—"}`,
        inline: true,
      },
      {
        name: "🤖 Bot & sanções",
        value:
          `**Comandos usados:** ${user.bot_commands_used ?? 0}\n` +
          `**Penalidades ativas:** ${penN}\n` +
          `**Palavra-chave penalidade:** ${user.penalityWord ? "definida" : "—"}`,
        inline: false,
      },
      {
        name: "🏆 Conquistas",
        value: achPretty.length > 1024 ? achPretty.slice(0, 1000) + "…" : achPretty,
        inline: false,
      },
      {
        name: "📋 Variações de comando",
        value:
          `**Slash:** \`/stats\` | \`/stats full\` | \`/stats conquistas\`\n` +
          `**Prefixo:** \`${getBotPrefix()}stats\` | \`${getBotPrefix()}stats full\` | \`${getBotPrefix()}stats conqs\``,
        inline: false,
      }
    )
    .setFooter({ text: `ID: ${discordUser.id} · dados do banco` });

  if (icon) eb.setAuthor({ name, iconURL: icon });
  if (thumb) eb.setThumbnail(thumb);
  return eb;
}

export async function execute(client, data) {
  try {
    const mode = resolveMode(data);
    const mentionedUser = parseTarget(data);
    const { userId, guildId, displayName, username } = data;

    const targetUserId = mentionedUser ? mentionedUser.id : userId;
    const discordUser = buildDiscordFacade(
      data,
      mentionedUser,
      userId,
      username,
      displayName
    );
    const targetDisplayName = mentionedUser
      ? discordDisplayLabel(mentionedUser)
      : displayName;

    const userData = getOrCreateUser(targetUserId, targetDisplayName, guildId);
    if (!userData) {
      return await data.reply("❌ Erro ao carregar dados do usuário.");
    }

    let embed;
    if (mode === "resumo") embed = embedResumo(userData, discordUser, guildId);
    else if (mode === "conquistas") embed = embedConquistas(userData, discordUser);
    else embed = embedFull(userData, discordUser, guildId);

    return await data.reply({ embeds: [embed] });
  } catch (error) {
    console.error(`❌ Erro no comando stats:`, error);
    return await data.reply("❌ Erro ao processar comando.");
  }
}