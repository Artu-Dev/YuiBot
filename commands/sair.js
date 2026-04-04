import { SlashCommandBuilder } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export const name = "sair";

export const data = new SlashCommandBuilder()
  .setName("sair")
  .setDescription("Faz o bot sair do canal de voz.");

function parseArgs(data) {
  // No args for sair
  return {};
}

export async function execute(client, data) {
  const connection = getVoiceConnection(data.guildId);

  if (!connection) {
    return data.reply("Não estou em nenhum canal de voz.");
  }

  connection.destroy();
  return data.reply("Saí da call! Tchau! 👋");
}
