import { SlashCommandBuilder } from "discord.js";
import { playRandomAudio, startRecording } from "../functions/audio.js";
import { joinCall } from "../functions/voice.js";
import { getVoiceConnection } from "@discordjs/voice";

export const name = "entrar";

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
    return data.reply("Você precisa estar em um canal de voz.");
  }

  if (!voiceChannel.joinable) {
    return data.reply("Não tenho permissão para entrar no canal de voz.");
  }

  if (getVoiceConnection(data.guildId)) {
    return data.reply("Já estou em um canal de voz.");
  }

  // Criar um objeto message-like para compatibilidade
  const fakeMessage = {
    guild: { id: data.guildId },
    member: { voice: { channel: voiceChannel } }
  };

  const connection = joinCall(fakeMessage);
  if (!connection) {
    return data.reply("Não foi possível conectar à call agora. Tente novamente mais tarde.");
  }

  data.reply("Gravando audio...");
  startRecording(connection, client);
  playRandomAudio(connection);
}