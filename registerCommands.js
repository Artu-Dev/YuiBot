import { log } from "./bot.js";
import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

export const registerCommands = async (commandsMap) => {
  try {
    const slashCommands = [];

    for (const [name, command] of commandsMap) {
      if (name === command.name?.toLowerCase() && command.data) {
        slashCommands.push(command.data.toJSON ? command.data.toJSON() : command.data);
      }
    }

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: slashCommands }
    );

    log(`✅ ${data.length} comandos registrados com sucesso!`, "Registro", 34);
  } catch (error) {
    log(`❌ Erro ao registrar comandos: ${error.message}`, "Registro", 31);
    if (error.rawError) {
      console.error(error.rawError);
    }
  }
};