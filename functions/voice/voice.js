import { getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";

export function joinCall(message) {
  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel) {
    message.reply("Você precisa estar em um canal de voz.");
    return null;
  }
  if (!voiceChannel.joinable) {
    message.reply("Não tenho permissão para entrar no canal de voz.");
    return null;
  }
  if (getVoiceConnection(message.guild.id)) {
     message.reply("Já estou gravando.");
    return null;
  }

  return joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  });
}


