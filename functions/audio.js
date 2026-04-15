import { createWriteStream, unlinkSync, readdirSync, statSync, existsSync } from "fs";
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, EndBehaviorType } from "@discordjs/voice";
import ffmpeg from "fluent-ffmpeg";
import { opus } from "prism-media";
import { getRandomTime } from "./utils.js"; 
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import ms from 'ms';
import { log } from "../bot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const recordingTimeouts = new Map();
const playingTimeouts = new Map(); 


function convertPcmToWav(pcmFileName) {
    return new Promise((resolveP, rejectP) => {
        const wavFileName = pcmFileName.replace(".pcm", ".wav");
        
        if (!existsSync(pcmFileName)) {
            return rejectP(new Error("Arquivo PCM não encontrado para conversão."));
        }

        ffmpeg(pcmFileName)
            .inputOptions(["-f s16le", "-ar 48000", "-ac 1"])
            .audioFrequency(48000)
            .audioChannels(1)
            .audioCodec("pcm_s16le")
            .on("end", function () {
                try {
                    // Deleta o arquivo PCM original após a conversão
                    if (existsSync(pcmFileName)) unlinkSync(pcmFileName);
                    resolveP(wavFileName);
                } catch (err) {
                    rejectP(err);
                }
            })
            .on("error", function (err) {
                log(`❌ Erro do FFmpeg ao converter ${pcmFileName}: ${err.message}`, "Audio", 31);
                rejectP(err);
            })
            .save(wavFileName);
    });
}

function scheduleNextRecordingLoop(connection, client, time) {
    const guildId = connection.joinConfig.guildId;
    
    const oldTimeout = recordingTimeouts.get(guildId);
    if (oldTimeout) {
        clearTimeout(oldTimeout);
    }
    
    const newTimeout = setTimeout(() => startRecording(connection, client), Math.max(1, time));
    recordingTimeouts.set(guildId, newTimeout);
}

export function startRecording(connection, client) {
    const guildId = connection.joinConfig.guildId;
    const receiver = connection.receiver;
    const time = getRandomTime(60, 240);


    receiver.speaking.once("start", (userId) => {
        const user = client.users.cache.get(userId);
        
        if (!user || user.bot) {
            scheduleNextRecordingLoop(connection, client, time);
            return;
        }

        const audioStream = receiver.subscribe(userId, {
            end: { behavior: EndBehaviorType.Manual },
        });

        const pcmFileName = resolve(process.cwd(), `./recordings/${user.username}-${Date.now()}.pcm`);
        const fileStream = createWriteStream(pcmFileName);
        
        let isStopped = false;
        
        const opusDecoder = new opus.Decoder({
            rate: 48000,
            channels: 1,
            frameSize: 960,
        });

        audioStream.pipe(opusDecoder).pipe(fileStream);

        const maxDurationTimeout = setTimeout(() => {
            stopRecording();
        }, ms('10s'));

        const sizeInterval = setInterval(() => {
            try {
                if (existsSync(pcmFileName)) {
                    const stats = statSync(pcmFileName);
                    if (stats.size >= 1_000_000) {
                        stopRecording();
                    }
                }
            } catch (e) {}
        }, ms('300ms'));

        function stopRecording() {
            if (isStopped) return;
            isStopped = true;

            clearTimeout(maxDurationTimeout);
            clearInterval(sizeInterval);

            audioStream.removeListener("end", stopRecording);
            audioStream.removeListener("close", stopRecording);
            audioStream.removeListener("error", handleAudioError);
            connection.removeListener("disconnect", handleDisconnect);

            try { audioStream.destroy(); } catch {}
            try { fileStream.end(); } catch {}

            // Pequeno delay para garantir que o fileStream liberou o arquivo no disco
            setTimeout(() => {
                convertPcmToWav(pcmFileName)
                    .then(() => {
                         scheduleNextRecordingLoop(connection, client, time);
                    })
                    .catch((err) => {
                         log(`[${guildId}] ❌ Falha na conversão.`, "Audio", 31);
                         scheduleNextRecordingLoop(connection, client, time);
                    });
            }, 500); 
        }

        const handleAudioError = (err) => {
            log(`[${guildId}] Erro na stream: ${err.message}`, "Audio", 31);
            stopRecording();
        };

        const handleDisconnect = () => {
            stopRecording();
        };

        audioStream.on("end", stopRecording);
        audioStream.on("close", stopRecording);
        audioStream.on("error", handleAudioError);

        connection.on("disconnect", handleDisconnect);
    });
}

function playAudio(relativePath, connection, deleteFile) {
    const guildId = connection.joinConfig.guildId;
    const player = createAudioPlayer();
    
    const audioPath = resolve(process.cwd(), relativePath); 
    
    const resource = createAudioResource(audioPath);
    connection.subscribe(player);
    player.play(resource);

    if (deleteFile) {
        player.on(AudioPlayerStatus.Idle, () => {
            try {
                if(existsSync(audioPath)) {
                    unlinkSync(audioPath);
                }
            } catch(e) { log(`[${guildId}] Erro ao deletar arquivo: ${e.message}`, "Audio", 31); }
        });
    }
}


export function playRandomAudio(connection) {
    const guildId = connection.joinConfig.guildId;
    const time = getRandomTime(60, 240);

    try {
        const recordingDir = resolve(process.cwd(), "./recordings");
        if (existsSync(recordingDir)) {
            const allFilesWav = readdirSync(recordingDir).filter((file) => file.endsWith(".wav"));
            if (allFilesWav.length !== 0) {
                const randomFile = allFilesWav[Math.floor(Math.random() * allFilesWav.length)];
                playAudio(join("./recordings", randomFile), connection, allFilesWav.length >= 50);
            }
        } else {
            log(`[${guildId}] Pasta recordings não existe ou está vazia.`, "Audio", 31);
        }
    } catch (e) {
        log(`[${guildId}] Falha ao acessar gravações.`, "Audio", 31);
    }

    const oldTimeout = playingTimeouts.get(guildId);
    if (oldTimeout) clearTimeout(oldTimeout);
    
    const newTimeout = setTimeout(() => playRandomAudio(connection), Math.max(1, time));
    playingTimeouts.set(guildId, newTimeout);
}

export function stopPlayingAudio(guildId) {
    if (!guildId) {
        log("GuildId não fornecido para stopPlayingAudio.", "Audio", 31);
        return;
    }

    const playingTimeout = playingTimeouts.get(guildId);
    if (playingTimeout) {
        clearTimeout(playingTimeout);
        playingTimeouts.delete(guildId); 
    }

    const recordingTimeout = recordingTimeouts.get(guildId);
    if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeouts.delete(guildId);
    }
}