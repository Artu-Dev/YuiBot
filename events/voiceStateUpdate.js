import { getVoiceConnection } from "@discordjs/voice";
import { stopPlayingAudio } from "../functions/audio.js";

const name = "voiceStateUpdate";

const execute = (oldState, newState) => {
      const channel = oldState.channel || newState.channel;
    
      if (channel && channel.members.size === 1 && channel.members.has(newState.client.user.id)) {
        console.log('Saindo porque estou sozinho...');
        stopPlayingAudio();
        const connection = getVoiceConnection(channel.guild.id);
        connection.destroy();
      }
};

export { name, execute };
