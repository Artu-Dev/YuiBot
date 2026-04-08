import { createWriteStream, unlinkSync, readdirSync, statSync, existsSync } from "fs"; // Adicionado statSync
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, EndBehaviorType } from "@discordjs/voice";
import ffmpeg from "fluent-ffmpeg";
import { opus } from "prism-media";
import { getRandomTime } from "./utils.js"; 
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import ms from 'ms';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const recordingTimeouts = new Map();
const playingTimeouts = new Map(); 

const log = (...args) => console.log("\x1b[35m[Audio]\x1b[0m", ...args);


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
                console.error(`Erro do FFmpeg ao converter ${pcmFileName}:`, err);
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
    
    log(`[${guildId}] Próxima tentativa de gravação em`, (time / 1000).toFixed(1), "segundos");

    receiver.speaking.once("start", (userId) => {
        const user = client.users.cache.get(userId);
        
        if (!user || user.bot) {
            log(`[${guildId}] Ignorando bot:`, user?.username);
            scheduleNextRecordingLoop(connection, client, time);
            return;
        }

        log(`[${guildId}] 🎙️ Iniciando gravação de áudio de ${user.username}`);

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
            log(`[${guildId}] ⏱️ Tempo máximo atingido (10s)`);
            stopRecording();
        }, ms('10s'));

        const sizeInterval = setInterval(() => {
            try {
                if (existsSync(pcmFileName)) {
                    const stats = statSync(pcmFileName);
                    if (stats.size >= 1_000_000) {
                        log(`[${guildId}] 📦 Tamanho máximo atingido (1MB)`);
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

            try { audioStream.destroy(); } catch {}
            try { fileStream.end(); } catch {}

            log(`[${guildId}] 🛑 Parando gravação de ${user.username}`);

            // Pequeno delay para garantir que o fileStream liberou o arquivo no disco
            setTimeout(() => {
                convertPcmToWav(pcmFileName)
                    .then(() => {
                         log(`[${guildId}] ✅ Conversão concluída.`);
                         scheduleNextRecordingLoop(connection, client, time);
                    })
                    .catch((err) => {
                         console.error(`[${guildId}] ❌ Falha na conversão.`);
                         scheduleNextRecordingLoop(connection, client, time);
                    });
            }, 500); 
        }

        audioStream.on("end", stopRecording);
        audioStream.on("close", stopRecording);
        audioStream.on("error", (err) => {
            console.error(`[${guildId}] Erro na stream:`, err);
            stopRecording();
        });

        connection.on("disconnect", () => {
            log(`[${guildId}] Desconectado, parando...`);
            stopRecording();
        });
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
                    log(`[${guildId}] Arquivo antigo deletado: ${relativePath}`);
                }
            } catch(e) { console.error(`[${guildId}] Erro ao deletar arquivo:`, e); }
        });
    }
}


export function playRandomAudio(connection) {
    const guildId = connection.joinConfig.guildId;
    const time = getRandomTime(60, 240);
    
    log(`[${guildId}] Próxima execução de áudio em ${(time / 1000).toFixed(1)}s`);

    try {
        const recordingDir = resolve(process.cwd(), "./recordings");
        if (existsSync(recordingDir)) {
            const allFilesWav = readdirSync(recordingDir).filter((file) => file.endsWith(".wav"));
            if (allFilesWav.length !== 0) {
                log(`[${guildId}] 🔊 Tocando áudio aleatório...`);
                const randomFile = allFilesWav[Math.floor(Math.random() * allFilesWav.length)];
                playAudio(join("./recordings", randomFile), connection, allFilesWav.length >= 50);
            }
        } else {
             log(`[${guildId}] Pasta recordings não existe ou está vazia.`);
        }
    } catch (e) {
        console.error(`[${guildId}] Erro ao ler diretório de gravações:`, e);
    }

    const oldTimeout = playingTimeouts.get(guildId);
    if (oldTimeout) clearTimeout(oldTimeout);
    
    const newTimeout = setTimeout(() => playRandomAudio(connection), Math.max(1, time));
    playingTimeouts.set(guildId, newTimeout);
}

export function stopPlayingAudio(guildId) {
    if (!guildId) {
        console.error("GuildId não fornecido para stopPlayingAudio.");
        return;
    }

    const playingTimeout = playingTimeouts.get(guildId);
    if (playingTimeout) {
        clearTimeout(playingTimeout);
        playingTimeouts.delete(guildId); 
        log(`[${guildId}] Timer de reprodução parado.`);
    }

    const recordingTimeout = recordingTimeouts.get(guildId);
    if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeouts.delete(guildId);
        log(`[${guildId}] Timer de gravação parado.`);
    }
}