import { createWriteStream, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, EndBehaviorType } from "@discordjs/voice";
import ffmpeg from "fluent-ffmpeg";
import { opus } from "prism-media";
import { getRandomTime } from "./utils.js";
const __dirname = join(new URL(import.meta.url).pathname, "..");


let timeoutId, timeoutId2;

export function startRecording(connection, client) {
    const receiver = connection.receiver;
      const time = getRandomTime(60, 240);
      console.log("proxima gravação em", time/998.4);
  
      receiver.speaking.once("start", (userId) => {
      console.log(`Iniciando gravação de áudio de ${userId}`);
    
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.Manual,
        },
      });
  
      const userName = client?.users.cache.get(userId).username;
      const pcmFileName = `./recordings/${userName}-${Date.now()}.pcm`;
      const fileStream = createWriteStream(pcmFileName);
    
      const opusDecoder = new opus.Decoder({
        rate: 48000,
        channels: 1,
        frameSize: 960,
      });
      audioStream.pipe(opusDecoder).pipe(fileStream);
     
      const timeout = setTimeout(async () => {
        console.log("terminou o timer");
    
        audioStream.destroy();
        fileStream.end(); 
  
        await convertPcmToWav(pcmFileName, connection);
      }, getRandomTime(3, 10));
  
  
      audioStream.on("error", (err) => {
        console.error(`Erro na gravação de ${userId}:`, err);
        clearTimeout(timeout);
        fileStream.end();
      });
      connection.on("disconnect", () => {
        console.log(`Desconectado do canal de voz, encerrando gravação...`);
        audioStream.destroy();
      });
  
      timeoutId2 = setTimeout(() => startRecording(connection, client), time);  
    });
}

async function convertPcmToWav(pcmFileName) {
  const wavFileName = pcmFileName.replace(".pcm", ".wav");
  ffmpeg(pcmFileName)
    .inputOptions(["-f s16le", "-ar 48000", "-ac 1"])
    .audioFrequency(48000)
    .audioChannels(1)
    .audioCodec("pcm_s16le")
    .on("end", function () {
      unlinkSync(pcmFileName);
    })
    .on("error", function (err) {
      console.error("Erro ao converter o áudio:", err);
    })
    .save(wavFileName);
}

export function playRandomAudio(connection) {
  const time = getRandomTime(60, 240);
  console.log(`Próxima execução em ${time / 60000}s`);

  const allFilesWav = readdirSync("./recordings").filter((file) => file.endsWith(".wav"));
  if (allFilesWav.length !== 0) {
    console.log("Tocando áudio...");
    const randomFile = allFilesWav[Math.floor(Math.random() * allFilesWav.length)];
    playAudio(`recordings/${randomFile}`, connection, allFilesWav.length >= 50);
  }

  timeoutId = setTimeout(() => playRandomAudio(connection), time);
}

function playAudio(wavFileName, connection, deleteFile) {
  const player = createAudioPlayer();
  const audioPath = join(__dirname, wavFileName);
  const resource = createAudioResource(audioPath);
  connection.subscribe(player);
  player.play(resource);

  if (deleteFile) {
    player.on(AudioPlayerStatus.Idle, () => {
      unlinkSync(audioPath);
    });
  }
}

export function stopPlayingAudio() {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    clearTimeout(timeoutId2);
    timeoutId = null;
    timeoutId2 = null;
  }
}
