import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { playRandomAudio, startRecording } from "../functions/audio.js";
import { joinCall } from "../functions/voice/voice.js";
import { getVoiceConnection } from "@discordjs/voice";

export const name = "entrar";
export const aliases = ["join", "vc", "conectar"];

export const data = new SlashCommandBuilder()
  .setName("entrar")
  .setDescription("Faz o bot entrar no canal de voz atual.");

function parseArgs(data) {
  // No args for entrar
  return {};
}

export async function execute(client, data) {
  const voiceChannel = data.voiceChannel;

  if (!voiceChannel) {
    const embed = new EmbedBuilder()
      .setColor("#FF6B6B")
      .setTitle("❌ Erro")
      .setDescription("Você precisa estar em um canal de voz.");
    return data.reply({ embeds: [embed] });
  }

  if (!voiceChannel.joinable) {
    const embed = new EmbedBuilder()
      .setColor("#FF6B6B")
      .setTitle("❌ Sem permissão")
      .setDescription("Não tenho permissão para entrar no canal de voz.");
    return data.reply({ embeds: [embed] });
  }

  if (getVoiceConnection(data.guildId)) {
    const embed = new EmbedBuilder()
      .setColor("#FF6B6B")
      .setTitle("❌ Já conectado")
      .setDescription("Já estou em um canal de voz.");
    return data.reply({ embeds: [embed] });
  }


  const connection = joinCall(data);
  if (!connection) {
    const embed = new EmbedBuilder()
      .setColor("#FF6B6B")
      .setTitle("❌ Falha na conexão")
      .setDescription("Não foi possível conectar à call agora. Tente novamente mais tarde.");
    return data.reply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor("#4ECDC4")
    .setTitle("🎤 Entrando na call")
    .setDescription("Gravando áudio...");
  data.reply({ embeds: [embed] });
  startRecording(connection, client);
  playRandomAudio(connection);
}