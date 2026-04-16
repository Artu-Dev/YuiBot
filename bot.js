import { Client, GatewayIntentBits } from "discord.js";
import { readdirSync } from "fs";
import dotenv from "dotenv";
import path from "path";
import Config from "./data/config.js";
import { dbBot, getGuildUsers, addChars, getServerConfig, addCharsBulk, initializeDbBot, db, unlockAchievement } from "./database.js";
import nodeCron from "node-cron";
import { cleanupLeftUsers } from "./functions/cleanUsers.js";
import { registerCommands } from "./registerCommands.js";
import dayjs from "dayjs";
import { EmbedBuilder } from "discord.js";

dotenv.config();
Config.setupDirectories();

export const log = (msg, name = "Bot", color = 36) =>
  console.log(`\x1b[${color}m[${name}]\x1b[0m ${msg}`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
  rest: { timeout: 20000 },
});

// === RESET MENSAL ===
function checkMonthlyReset() {
  const now = dayjs();
  const monthYearNow = `${now.month() + 1}/${now.year()}`;

  if (dbBot.data.lastReset === monthYearNow) return;

  log("--- NOVO MÊS DETECTADO: INICIANDO RESET GERAL ---");

  for (const [guildId] of client.guilds.cache) {
    const users = getGuildUsers(guildId);
    const monthlyChars = getServerConfig(guildId, "limitChar") || 4000;
    const updates = users.map((u) => ({ userId: u.id, guildId, amount: monthlyChars }));
    addCharsBulk(updates);
  }

  dbBot.data.lastReset = monthYearNow;
  dbBot.write();

  log(`--- RESET MENSAL CONCLUÍDO PARA ${monthYearNow} ---`);
}

// === EVENTO DE FIM DE MÊS ===
// Cache simples para evitar rodar o evento mais de 1x por mês
const monthlyEventCache = new Map();

function isLastDayOfMonth() {
  const today = dayjs();
  const tomorrow = today.add(1, 'day');
  return today.month() !== tomorrow.month();
}

function shouldRunMonthlyEvent() {
  const now = dayjs();
  const isLastDay = isLastDayOfMonth();
  const hour = now.hour();
  const minute = now.minute();
  
  // Roda entre 23:55 e 23:59 do último dia do mês
  return isLastDay && hour === 23 && minute >= 55;
}

async function runMonthlyEvent(botClient, guildId) {
  if (!guildId) return;

  // Previne execução duplicada no mesmo mês
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  if (monthlyEventCache.get(guildId) === monthKey) {
    return;
  }

  try {
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      log(`[MonthlyEvent] Guild ${guildId} não encontrada`, "Bot", 31);
      return;
    }

    // Pega todos os usuários do servidor
    const users = db.prepare(`
      SELECT id, display_name, charLeft 
      FROM users 
      WHERE guild_id = ? 
      ORDER BY charLeft DESC 
      LIMIT 3
    `).all(guildId);

    if (users.length === 0) {
      log(`[MonthlyEvent] Nenhum usuário encontrado em ${guildId}`, "Bot", 31);
      return;
    }

    // Define os rankings
    const rankings = [
      { position: 1, achievement: 'milionario_do_mes', emoji: '🥇', title: 'Milionário do Mês' },
      { position: 2, achievement: 'ricao_do_mes', emoji: '🥈', title: 'Ricão do Mês' },
      { position: 3, achievement: 'abastado_do_mes', emoji: '🥉', title: 'Abastado do Mês' },
    ];

    // Desbloqueia as conquistas
    const winners = [];
    for (let i = 0; i < Math.min(users.length, 3); i++) {
      const user = users[i];
      const ranking = rankings[i];

      // Desbloqueia a conquista
      unlockAchievement(user.id, guildId, ranking.achievement);
      
      // Verifica se é a 1ª vez ganhando (para milestone)
      const achData = db.prepare(`
        SELECT achievements_unlocked FROM users WHERE id = ? AND guild_id = ?
      `).get(user.id, guildId);

      const achieved = JSON.parse(achData?.achievements_unlocked || '{}');
      
      // Se tem milionario_do_mes e ricao_do_mes e abastado_do_mes, pode premiar reincidente
      if (achieved.milionario_do_mes && achieved.ricao_do_mes && achieved.abastado_do_mes) {
        // Conta quantos meses ganhou milionario
        const milCount = (achieved.milionario_dos_meses_count || 0) + 1;
        if (milCount >= 5 && ranking.position === 1) {
          unlockAchievement(user.id, guildId, 'milionario_reincidente');
        }
      }

      winners.push({
        userId: user.id,
        displayName: user.display_name,
        chars: user.charLeft,
        ...ranking,
      });
    }

    // Cria embed de anúncio
    const embed = new EmbedBuilder()
      .setTitle('📊 FIM DE MÊS - RANKING DE CHARS')
      .setColor(0xFFD700)
      .setDescription(`**${dayjs().format('MMMM YYYY')}**\n\nOs 3 mais ricos do servidor:`)
      .setTimestamp();

    for (const winner of winners) {
      embed.addFields({
        name: `${winner.emoji} ${winner.title}`,
        value: `<@${winner.userId}> — **${winner.chars.toLocaleString()}** chars 💰`,
        inline: false,
      });
    }

    // Posta em todos os canais (tenta postar em channels com permissão)
    const channels = guild.channels.cache.filter(ch => 
      ch.isTextBased() && 
      ch.permissionsFor(guild.members.me).has('SendMessages')
    );

    if (channels.size > 0) {
      const channel = channels.first();
      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    log(`[MonthlyEvent] ✅ Evento de fim de mês executado em ${guild.name}`, "Bot", 36);
    monthlyEventCache.set(guildId, monthKey);
  } catch (error) {
    log(`[MonthlyEvent] Erro: ${error.message}`, "Bot", 31);
  }
}

async function checkMonthlyEventExecution(botClient) {
  if (!shouldRunMonthlyEvent()) return;

  const eventPromises = botClient.guilds.cache.map(guild => 
    runMonthlyEvent(botClient, guild.id)
  );

  await Promise.allSettled(eventPromises);
  log("EVENTO DE FIM DE MÊS CONCLUÍDO EM TODOS OS SERVIDORES", "Bot", 36);
}

async function main() {
  client.commands = new Map();

  const commandsPath = path.join(process.cwd(), "commands");

  let commandCount = 0
  let aliasCount = 0;

  for (const file of readdirSync(commandsPath)) {
    try {
      const command = await import(`./commands/${file}`);

      if (!command.name || typeof command.execute !== "function") {
        log(`⚠️  Comando inválido em ${file}: faltam 'name' ou 'execute'`, "Bot", 31);
        continue;
      }

      client.commands.set(command.name.toLowerCase(), command);
      commandCount++;

      if (Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          const lowerAlias = alias.toLowerCase();
          
          if (!client.commands.has(lowerAlias)) {
            client.commands.set(lowerAlias, command);
            aliasCount++;
          } else {
            log(`⚠️ Alias "${lowerAlias}" de ${file} já existe (ignorado)`, "Bot", 33);
          }
        }
      }

    } catch (error) {
      log(`❌ Erro ao carregar comando ${file}: ${error}`, "Bot", 31);
    }
  }

  log(`Carregados ${commandCount} comandos (${aliasCount} aliases).`, "Bot", 36);

  // === CARREGAR EVENTOS ===
  const eventsPath = path.join(process.cwd(), "events");

  for (const file of readdirSync(eventsPath)) {
    // Skip directories (handlers/ will be used in Phase 3)
    if (file.startsWith(".") || !file.endsWith(".js")) continue;
    
    try {
      const event = await import(`./events/${file}`);
      if (!event.name || !event.execute) {
        log(`⚠️  Evento inválido em ${file}: faltam 'name' ou 'execute'`, "Bot", 31);
        continue;
      }
      client.on(event.name, (...args) => event.execute(...args, client));
    } catch (error) {
      log(`❌ Erro ao carregar evento ${file}: ${error.message}`, "Bot", 31);
    }
  }

  log(`Eventos ativos: ${readdirSync(eventsPath).length}`);

  await initializeDbBot();

  client.once("clientReady", async () => {
    log(`Online como ${client.user.tag}`);
    await cleanupLeftUsers(client);
    await registerCommands(client.commands);

    await Promise.all(
      client.guilds.cache.map((guild) =>
        guild.members.fetch().catch(() => null),
      ),
    );

    nodeCron.schedule("0 0 * * *", async () => {
        try {
          checkMonthlyReset();
          await checkMonthlyEventExecution(client);
        } catch (error) {
          log(`❌ Erro no reset mensal: ${error.message}`, "Cron", 31);
        }
      },{ timezone: "America/Sao_Paulo" },
    );
  });

  // === LOGIN ===
  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    log("❌ Erro crítico ao fazer login: " + error.message, "Erro", 31);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  log("❌ Promise rejeitada não tratada: " + reason?.message, "Erro", 31);
});

process.on("uncaughtException", (error) => {
  log("❌ Erro não capturado: " + error, "Erro", 31);
});

main();