import { Client, GatewayIntentBits } from "discord.js";
import { readdirSync } from "fs";
import dotenv from "dotenv";
import path from "path";
import Config from "./config.js";
import { intializeDbBot, dbBot, getGuildUsers, addChars } from "./database.js";

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
});

const log = (msg) => console.log(`\x1b[36m[Bot]\x1b[0m ${msg}`);

client.commands = new Map();
const commandsPath = path.join(process.cwd(), "commands");
for (const file of readdirSync(commandsPath)) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.name, command);
}

log(`Carregados ${client.commands.size} comandos.`);

const eventsPath = path.join(process.cwd(), "events");
for (const file of readdirSync(eventsPath)) {
  const event = await import(`./events/${file}`);
  client.on(event.name, (...args) => event.execute(...args, client));
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
    for (const u of users) {
      addChars(u.id, guildId, 2000);
    }
  }

  dbBot.data.lastReset = monthYearNow;
  dbBot.write();

  log(`--- RESET MENSAL CONCLUÍDO PARA ${monthYearNow} ---`);
}

client.once("clientReady", () => {
  log(`Online como ${client.user.tag}`);
  checkMonthlyReset();
  setInterval(checkMonthlyReset, 6 * 60 * 60 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
