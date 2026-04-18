
import dayjs from "dayjs";
import { EmbedBuilder } from "discord.js";
import {
  getGuildUsers,
  getServerConfig,
  addCharsBulk,
  unlockAchievement,
  db,
  dbBot,
} from "../database.js";
import { log } from "../bot.js";

// =============== CONSTANTES ===============
const MONTHLY_RANKINGS = [
  {
    position: 1,
    achievement: "milionario_do_mes",
    emoji: "🥇",
    title: "Milionário do Mês",
    milestone: "milionario_reincidente",
    milestoneThreshold: 5,
  },
  {
    position: 2,
    achievement: "ricao_do_mes",
    emoji: "🥈",
    title: "Ricão do Mês",
  },
  {
    position: 3,
    achievement: "abastado_do_mes",
    emoji: "🥉",
    title: "Abastado do Mês",
  },
];

const MONTHLY_EVENT_CACHE = new Map();

export function executeMonthlyReset(client) {
  const now = dayjs();
  const currentMonth = `${now.month() + 1}/${now.year()}`;

  if (dbBot?.data?.lastReset === currentMonth) {
    return false;
  }

  log("--- NOVO MÊS DETECTADO: INICIANDO RESET GERAL ---", "MonthlyReset", 36);

  try {
    const updates = [];

    for (const [guildId] of client.guilds.cache) {
      const guildUsers = getGuildUsers(guildId);
      const monthlyCharLimit = getServerConfig(guildId, "limitChar") || 4000;

      for (const user of guildUsers) {
        updates.push({
          userId: user.id,
          guildId,
          amount: monthlyCharLimit,
        });
      }
    }

    if (updates.length > 0) {
      addCharsBulk(updates);
    }

    dbBot.data.lastReset = currentMonth;
    dbBot.write();

    log(
      `--- RESET MENSAL CONCLUÍDO: ${updates.length} usuários resetados ---`,
      "MonthlyReset",
      36
    );

    return true;
  } catch (error) {
    log(
      `Erro no reset mensal: ${error.message}`,
      "MonthlyReset",
      31
    );
    return false;
  }
}

// =============== RANKING E CONQUISTAS ===============

export function getMonthlyTopPlayers(guildId) {
  try {
    const topPlayers = db
      .prepare(
        `
        SELECT id, display_name, charLeft 
        FROM users 
        WHERE guild_id = ? 
        ORDER BY charLeft DESC 
        LIMIT 3
      `
      )
      .all(guildId);

    return topPlayers || [];
  } catch (error) {
    log(
      `Erro ao buscar top players em ${guildId}: ${error.message}`,
      "MonthlyEvent",
      31
    );
    return [];
  }
}

export function awardMonthlyAchievements(topPlayers, guildId) {
  const winners = [];

  for (let i = 0; i < Math.min(topPlayers.length, 3); i++) {
    const user = topPlayers[i];
    const ranking = MONTHLY_RANKINGS[i];

    try {
      unlockAchievement(user.id, guildId, ranking.achievement);

      if (ranking.milestone) {
        const achievedData = db
          .prepare(
            `
          SELECT achievements_unlocked 
          FROM users 
          WHERE id = ? AND guild_id = ?
        `
          )
          .get(user.id, guildId);

        if (achievedData) {
          const achieved = JSON.parse(achievedData.achievements_unlocked || "{}");

          const countKey = `${ranking.achievement}_count`;
          const currentCount = (achieved[countKey] || 0) + 1;
          achieved[countKey] = currentCount;

          if (currentCount >= ranking.milestoneThreshold) {
            unlockAchievement(user.id, guildId, ranking.milestone);
          }
        }
      }

      winners.push({
        userId: user.id,
        displayName: user.display_name,
        chars: user.charLeft,
        ...ranking,
      });
    } catch (error) {
      log(
        `Erro ao dar conquista para ${user.id}: ${error.message}`,
        "MonthlyEvent",
        31
      );
    }
  }

  return winners;
}

// =============== ANÚNCIO ===============
function createMonthlyAnnounceEmbed(winners) {
  const embed = new EmbedBuilder()
    .setTitle("📊 FIM DE MÊS - RANKING DE CHARS")
    .setColor(0xffd700)
    .setDescription(
      `**${dayjs().format("MMMM/YYYY")}**\n\nOs 3 mais ricos do servidor:`
    )
    .setTimestamp();

  for (const winner of winners) {
    embed.addFields({
      name: `${winner.emoji} ${winner.title}`,
      value: `<@${winner.userId}> — **${winner.chars.toLocaleString()}** chars 💰`,
      inline: false,
    });
  }

  return embed;
}

async function announceInGuild(guild, winners) {
  try {
    const channels = guild.channels.cache.filter(
      (ch) =>
        ch.isTextBased() && ch.permissionsFor(guild.members.me).has("SendMessages")
    );

    if (channels.size === 0) {
      log(
        `Nenhum canal com permissão em ${guild.name}`,
        "MonthlyEvent",
        33
      );
      return;
    }

    const channel = channels.first();
    const embed = createMonthlyAnnounceEmbed(winners);

    await channel.send({ embeds: [embed] });
    log(
      `✅ Anúncio enviado em ${guild.name}`,
      "MonthlyEvent",
      36
    );
  } catch (error) {
    log(
      `Erro ao anunciar em ${guild.name}: ${error.message}`,
      "MonthlyEvent",
      31
    );
  }
}

export function shouldRunMonthlyEvent() {
  const now = dayjs();
  const tomorrow = now.add(1, "day");
  const isLastDay = now.month() !== tomorrow.month();
  const hour = now.hour();
  const minute = now.minute();

  return isLastDay && hour === 23 && minute >= 55;
}

export async function runMonthlyEventForGuild(client, guildId) {
  if (!guildId) return;

  const monthKey = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}`;

  if (MONTHLY_EVENT_CACHE.get(guildId) === monthKey) {
    return;
  }

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      log(`Guild ${guildId} não encontrada`, "MonthlyEvent", 31);
      return;
    }

    const topPlayers = getMonthlyTopPlayers(guildId);
    if (topPlayers.length === 0) {
      log(
        `Nenhum usuário encontrado em ${guildId}`,
        "MonthlyEvent",
        31
      );
      return;
    }

    const winners = awardMonthlyAchievements(topPlayers, guildId);

    await announceInGuild(guild, winners);

    MONTHLY_EVENT_CACHE.set(guildId, monthKey);
  } catch (error) {
    log(
      `Erro no evento mensal de ${guildId}: ${error.message}`,
      "MonthlyEvent",
      31
    );
  }
}


export async function runMonthlyEventForAllGuilds(client) {
  if (!shouldRunMonthlyEvent()) return;

  log(
    "🌙 INICIANDO EVENTO DE FIM DE MÊS EM TODOS OS SERVIDORES...",
    "MonthlyEvent",
    36
  );

  const eventPromises = Array.from(client.guilds.cache.keys()).map((guildId) =>
    runMonthlyEventForGuild(client, guildId)
  );

  await Promise.allSettled(eventPromises);
  log(
    "✅ EVENTO DE FIM DE MÊS CONCLUÍDO EM TODOS OS SERVIDORES",
    "MonthlyEvent",
    36
  );
}
