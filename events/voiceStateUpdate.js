import { getVoiceConnection } from "@discordjs/voice";
import { stopPlayingAudio } from "../functions/audio.js";

const name = "voiceStateUpdate";

const execute = (oldState, newState) => {
      const channel = oldState.channel || newState.channel;
      if (!channel) return;

      if (channel && channel.members.size === 1 && channel.members.has(newState.client.user.id)) {
        const guildId = channel.guild.id;
        stopPlayingAudio(guildId);
        const connection = getVoiceConnection(guildId);
        connection.destroy();
      }
};

export { name, execute };
