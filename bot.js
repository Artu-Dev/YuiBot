import { Client, GatewayIntentBits } from "discord.js";
import { readdirSync } from "fs";
import dotenv from "dotenv";
import path from "path";
import Config from "./data/config.js";
import { dbBot, initializeDbBot } from "./database.js";
import nodeCron from "node-cron";
import { cleanupLeftUsers } from "./functions/cleanUsers.js";
import { registerCommands } from "./registerCommands.js";
import {
  executeMonthlyReset,
  runMonthlyEventForAllGuilds,
} from "./functions/monthlyEvent.js";
import {
  generateAndCacheDailyEvent,
  resetDailyEventCache,
} from "./functions/getTodaysEvent.js";
import {
  announceDailyEventForAllGuilds,
  resetDailyAnnouncementCache,
} from "./functions/dailyEventAnnouncer.js";

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
  executeMonthlyReset(client);
}

// === FIM DE MÊS ===
async function checkMonthlyEventExecution() {
  await runMonthlyEventForAllGuilds(client);
}

// === EVENTOS DIÁRIOS ===
async function generateDailyEventsForAllGuilds() {
  if (!client || !client.guilds || client.guilds.cache.size === 0) return;

  const promises = Array.from(client.guilds.cache.keys()).map((guildId) =>
    generateAndCacheDailyEvent(guildId).catch((error) => {
      log(`Erro ao gerar evento para ${guildId}: ${error.message}`, "DailyEvent", 31);
    })
  );

  await Promise.allSettled(promises);
}

async function checkDailyEventAnnouncements() {
  resetDailyAnnouncementCache();
  resetDailyEventCache();
  await announceDailyEventForAllGuilds(client);
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

    nodeCron.schedule(
      "0 0 * * *",
      async () => {
        try {
          // === RESET MENSAL ===
          checkMonthlyReset();

          // === FIM DE MÊS ===
          await checkMonthlyEventExecution();

          // === EVENTOS DIÁRIOS ===
          await generateDailyEventsForAllGuilds();
          await checkDailyEventAnnouncements();
        } catch (error) {
          log(`❌ Erro no reset mensal: ${error.message}`, "Cron", 31);
        }
      },
      { timezone: "America/Sao_Paulo" }
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