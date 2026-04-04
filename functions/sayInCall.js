import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { config } from "dotenv";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { joinCall } from "../functions/voice.js";
import { AudioPlayerStatus, createAudioPlayer, createAudioResource } from "@discordjs/voice";
import { unlinkSync } from "fs";
import { dbBot } from "../database.js";
import { createAudioFileFromText } from "./createTTS.js";
config();

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});


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
      return "<laughing>HAHAHAHHAHAHHAHAHAHHAHAHAHHAHAHAHHAHAHHAHAHAHHAHAHAH<laughing>";
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
    // const audio = await createAudioFileFromText(tratedText);

    console.log(`🔊 Reproduzindo áudio: ${audio}`)

    const player = createAudioPlayer();
    const resource = createAudioResource(audio);
    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      try {
        unlinkSync(audio);
      } catch (e) {
        console.error(`⚠️  Erro ao deletar arquivo de áudio ${audio}:`, e.message);
      }
    });
  } catch (error) {
    console.error("❌ Erro em sayInCall:", error.message);
    throw error;
  }
}