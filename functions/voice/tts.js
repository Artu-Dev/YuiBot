import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { config } from "dotenv";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import { unlinkSync } from "fs";
import { dbBot } from "../../database.js";
import { log } from "../../bot.js";

config();

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// ==================== VOICE CONNECTION ====================

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

// ==================== TEXT-TO-SPEECH ====================

const createAudioFileTTSElevenLabs = async (text) => {
  return new Promise(async (resolve, reject) => {
    try {
      const voiceId = dbBot.data.AiConfig.voiceId;
      const audio = await elevenlabs.textToSpeech.convert(
        voiceId,
        {
          modelId: "eleven_flash_v2_5",
          text,
          outputFormat: "mp3_44100_128",
          voiceSettings: {
            stability: 0,
            similarityBoost: 0,
            useSpeakerBoost: true,
            speed: 1.0,
          },
        }
      );

      const fileName = `YUIBOT ${Date.now()}.mp3`;
      const fileStream = createWriteStream(fileName);

      const readableStream = Readable.from(audio);
      readableStream.pipe(fileStream);

      fileStream.on("finish", () => resolve(fileName));
      fileStream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
};

function fixText(text) {
  let finalText = text.replace(/^[\s\S]*?<\/think>/, "");

  finalText = finalText.replace(/k{3,}/gi, (match) => {
    const count = match.length;

    if (count <= 5) {
      return "<laugh>hahahahahaha</laugh>";
    } else {
      return "<laughing>HAHAHAHHAHAHAHAHHAHAHAH<laughing>";
    }
  });

  if (finalText.length > 400) finalText = finalText.slice(0, 400);
  return finalText;
}

export async function sayInCall(message, responseText) {
  try {
    const connection = joinCall(message);
    if (!connection) return;

    let tratedText = fixText(responseText);

    const audio = await createAudioFileTTSElevenLabs(tratedText);
    const player = createAudioPlayer();
    const resource = createAudioResource(audio);
    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      try {
        unlinkSync(audio);
      } catch (e) {
        log(`⚠️  Erro ao deletar arquivo de áudio ${audio}: ${e.message}`, "Audio", 31);
      }
    });
  } catch (error) {
    log(`❌ Erro em sayInCall: ${error.message}`, "Audio", 31);
    throw error;
  }
}
