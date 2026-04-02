import { playRandomAudio, startRecording } from "../functions/audio.js";
import { joinCall } from "../functions/voice.js";
import { getVoiceConnection } from "@discordjs/voice";

export async function run(client, message) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    return message.reply("Você precisa estar em um canal de voz.");
  }

  if (!voiceChannel.joinable) {
    return message.reply("Não tenho permissão para entrar no canal de voz.");
  }

  if (getVoiceConnection(message.guild.id)) {
    return message.reply("Já estou em um canal de voz.");
  }

  const connection = joinCall(message);
  if (!connection) {
    return message.reply("Não foi possível conectar à call agora. Tente novamente mais tarde.");
  }

  message.reply("Gravando audio...");
  startRecording(connection, client);
  playRandomAudio(connection);
};

export const name = "entrar";
