import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import { stopPlayingAudio } from "../functions/audio.js";

export const name = "sair";
export const aliases = ["leave", "disconnect", "dc", "saircall", "sair-call"];

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
    const embed = new EmbedBuilder()
      .setColor("#FF6B6B")
      .setTitle("❌ Não conectado")
      .setDescription("Não estou em nenhum canal de voz.");
    return data.reply({ embeds: [embed] });
  }

  stopPlayingAudio(data.guildId);

  connection.destroy();
  const embed = new EmbedBuilder()
    .setColor("#4ECDC4")
    .setTitle("👋 Saindo da call")
    .setDescription("Tchau! Até a próxima.");
  return data.reply({ embeds: [embed] });
}
