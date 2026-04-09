import { Client, GatewayIntentBits } from "discord.js";
import { readdirSync } from "fs";
import dotenv from "dotenv";
import path from "path";
import Config from "./config.js";
import { intializeDbBot, dbBot, getGuildUsers, addChars, getServerConfig } from "./database.js";
import nodeCron from "node-cron";

dotenv.config();
Config.setupDirectories();

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
  rest: {
    timeout: 20000,
  },
});

const log = (msg) => console.log(`\x1b[36m[Bot]\x1b[0m ${msg}`);

// === CARREGAR COMANDOS ===
client.commands = new Map();
const commandsPath = path.join(process.cwd(), "commands");
for (const file of readdirSync(commandsPath)) {
  try {
    const command = await import(`./commands/${file}`);
    if (!command.name || typeof command.execute !== "function") {
      console.error(`⚠️  Comando inválido em ${file}: faltam 'name' ou 'execute'`);
      continue;
    }
    client.commands.set(command.name, command);
  } catch (error) {
    console.error(`❌ Erro ao carregar comando ${file}:`, error.message);
  }
}

log(`Carregados ${client.commands.size} comandos.`);

// === CARREGAR EVENTOS ===
const eventsPath = path.join(process.cwd(), "events");
for (const file of readdirSync(eventsPath)) {
  try {
    const event = await import(`./events/${file}`);
    if (!event.name || !event.execute) {
      console.error(`⚠️  Evento inválido em ${file}: faltam 'name' ou 'execute'`);
      continue;
    }
    client.on(event.name, (...args) => event.execute(...args, client));
  } catch (error) {
    console.error(`❌ Erro ao carregar evento ${file}:`, error.message);
  }
}

log(`Eventos ativos: ${readdirSync(eventsPath).length}`);

await intializeDbBot();

// === RESET MENSAL ===
function checkMonthlyReset() {
  const now = new Date();
  const monthYearNow = `${now.getMonth() + 1}/${now.getFullYear()}`;

  if (dbBot.data.lastReset === monthYearNow) return;

  log("--- NOVO MÊS DETECTADO: INICIANDO RESET GERAL ---");

  for (const [guildId] of client.guilds.cache) {
    const users = getGuildUsers(guildId);
    const monthlyChars = getServerConfig(guildId, 'limitChar') || 4000;
    for (const u of users) {
      addChars(u.id, guildId, monthlyChars);
    }
  }

  dbBot.data.lastReset = monthYearNow;
  dbBot.write();

  log(`--- RESET MENSAL CONCLUÍDO PARA ${monthYearNow} ---`);
}

client.once("clientReady", () => {
  log(`Online como ${client.user.tag}`);

  nodeCron.schedule("0 0 * * *", checkMonthlyReset, {
    timezone: "America/Sao_Paulo"
  });
});

// === LOGIN COM TRATAMENTO DE ERRO ===
try {
  await client.login(process.env.DISCORD_TOKEN);
} catch (error) {
  console.error("❌ Erro crítico ao fazer login:", error.message);
  process.exit(1);
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Promise rejeitada não tratada:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Erro não capturado:", error);
});
