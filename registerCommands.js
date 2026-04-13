import { log } from "./bot.js";
import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
config();


const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

export const registerCommands = async (commands) => {
  try {
    log(`Registrando ${commands.size} comandos globais...`, "Registro", 34);

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.data }
    );

    log('✅ Comandos registrados com sucesso!', "Registro", 34);
  } catch (error) {
    log('❌ Erro ao registrar comandos:', "Registro", 34);
  }
};