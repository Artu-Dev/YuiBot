import { createWriteStream, unlinkSync, readdirSync, statSync, existsSync, mkdirSync } from "fs";
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

export const RECORDING_MIN_DELAY = ms('1m') / 1000; 
export const RECORDING_MAX_DELAY = ms('20m') / 1000;

export const PLAYBACK_MIN_DELAY = ms('1m') / 1000;
export const PLAYBACK_MAX_DELAY = ms('20m') / 1000;

const recordingTimeouts = new Map();
const playingTimeouts = new Map(); 
const activePlayers = new Map();
const activeRecordings = new Map();


function convertPcmToWav(pcmFileName) {
    return new Promise((resolveP, rejectP) => {
        const wavFileName = pcmFileName.replace(".pcm", ".wav");
        
        if (!existsSync(pcmFileName)) {
            return rejectP(new Error("Arquivo PCM não encontrado para conversão."));
        }

        // Verificar tamanho do arquivo
        const stats = statSync(pcmFileName);
        if (stats.size < 1000) {
            return rejectP(new Error(`Arquivo PCM muito pequeno: ${stats.size} bytes`));
        }

        const ffmpegCommand = ffmpeg(pcmFileName)
            .inputOptions(["-f s16le", "-ar 48000", "-ac 1"])
            .audioFrequency(48000)
            .audioChannels(1)
            .audioCodec("pcm_s16le")
            .outputOptions(["-y"])
            .on("start", (commandLine) => {
            })
            .on("progress", (progress) => {
            })
            .on("end", function () {
                // Aguardar um pouco para garantir que o FFmpeg liberou o arquivo
                setTimeout(() => {
                    try {
                        if (!existsSync(wavFileName)) {
                            return rejectP(new Error("Arquivo WAV não foi criado"));
                        }
                        
                        // Tentar deletar o PCM com retry em caso de EBUSY
                        let deleteAttempts = 0;
                        const tryDelete = () => {
                            try {
                                if (existsSync(pcmFileName)) {
                                    unlinkSync(pcmFileName);
                                }
                                resolveP(wavFileName);
                            } catch (err) {
                                deleteAttempts++;
                                if (deleteAttempts < 5 && err.code === 'EBUSY') {
                                    // Tentar novamente em 500ms
                                    setTimeout(tryDelete, 500);
                                } else {
                                    log(`❌ Falha ao deletar arquivo PCM após ${deleteAttempts} tentativas: ${err.message}`, "Audio", 31);
                                    // Mesmo com erro, resolver com o arquivo WAV se ele existe
                                    resolveP(wavFileName);
                                }
                            }
                        };
                        tryDelete();
                    } catch (err) {
                        rejectP(err);
                    }
                }, 1000); // Aguardar 1 segundo
            })
            .on("error", function (err) {
                log(`❌ Erro do FFmpeg ao converter ${pcmFileName}: ${err.message}`, "Audio", 31);
                try {
                    if (existsSync(pcmFileName)) unlinkSync(pcmFileName);
                    if (existsSync(wavFileName)) unlinkSync(wavFileName);
                } catch {}
                rejectP(err);
            })
            .save(wavFileName);

        setTimeout(() => {
            ffmpegCommand.kill('SIGKILL');
            rejectP(new Error("Timeout na conversão FFmpeg"));
        }, 30000); 
    });
}

function scheduleNextRecordingLoop(connection, client, time) {
    const guildId = connection.joinConfig.guildId;
    
    const oldTimeout = recordingTimeouts.get(guildId);
    if (oldTimeout) {
        clearTimeout(oldTimeout);
    }
    
    const newTimeout = setTimeout(() => startRecording(connection, client), Math.max(1000, time * 1000));
    recordingTimeouts.set(guildId, newTimeout);
}

export function startRecording(connection, client) {
    try {
    const guildId = connection.joinConfig.guildId;
    
    if (activeRecordings.has(guildId)) {
        scheduleNextRecordingLoop(connection, client, getRandomTime(RECORDING_MIN_DELAY, RECORDING_MAX_DELAY));
        return;
    }
    
    const connectionStatus = connection?.state?.status;
    if (!connection || (connectionStatus !== 'ready' && connectionStatus !== 'signalling')) {
        scheduleNextRecordingLoop(connection, client, getRandomTime(RECORDING_MIN_DELAY, RECORDING_MAX_DELAY));
        return;
    }
    
    const receiver = connection.receiver;
    if (!receiver) {
        log(`[${guildId}] Receiver não disponível para gravação.`, "Audio", 31);
        scheduleNextRecordingLoop(connection, client, getRandomTime(RECORDING_MIN_DELAY, RECORDING_MAX_DELAY));
        return;
    }

    // Verificar se o receiver está em um estado válido
    try {
        // Tentar uma operação simples para verificar se o receiver está funcionando
        const testSubscription = receiver.subscribe(client.user.id, { end: { behavior: EndBehaviorType.AfterSilence } });
        if (testSubscription) {
            testSubscription.destroy(); // Limpar o teste
        }
    } catch (error) {
        log(`[${guildId}] Receiver não está funcional: ${error.message}`, "Audio", 31);
        scheduleNextRecordingLoop(connection, client, getRandomTime(RECORDING_MIN_DELAY, RECORDING_MAX_DELAY));
        return;
    }
    
    const time = getRandomTime(RECORDING_MIN_DELAY, RECORDING_MAX_DELAY);


    receiver.speaking.once("start", (userId) => {
        const user = client.users.cache.get(userId);
        
        if (!user || user.bot) {
            scheduleNextRecordingLoop(connection, client, time);
            return;
        }

        activeRecordings.set(guildId, true);

        // Criar pasta de gravações específica da guild se não existir
        const guildRecordingDir = resolve(process.cwd(), `./recordings/${guildId}`);
        try {
            if (!existsSync(guildRecordingDir)) {
                mkdirSync(guildRecordingDir, { recursive: true });
            }
        } catch (err) {
            log(`[${guildId}] Erro ao criar pasta de gravações: ${err.message}`, "Audio", 31);
            activeRecordings.delete(guildId);
            scheduleNextRecordingLoop(connection, client, time);
            return;
        }

        let audioStream;
        try {
            audioStream = receiver.subscribe(userId, {
                end: { behavior: EndBehaviorType.Manual },
            });
            
            // Verificar se o stream foi criado corretamente
            if (!audioStream) {
                throw new Error("Stream de áudio não foi criado");
            }
            
            // Verificar se o stream está em um estado válido
            if (audioStream.destroyed || audioStream.readable === false) {
                throw new Error("Stream de áudio criado mas não está funcional");
            }
            
        } catch (error) {
            log(`[${guildId}] Erro ao criar stream de áudio para ${user.username}: ${error.message}`, "Audio", 31);
            activeRecordings.delete(guildId);
            scheduleNextRecordingLoop(connection, client, time);
            return;
        }

        const pcmFileName = resolve(process.cwd(), `./recordings/${guildId}/${user.username}-${Date.now()}.pcm`);
        const fileStream = createWriteStream(pcmFileName);
        
        let isStopped = false;
        
        let opusDecoder;
        try {
            opusDecoder = new opus.Decoder({
                rate: 48000,
                channels: 1,
                frameSize: 960,
            });
        } catch (error) {
            log(`[${guildId}] Erro ao criar decoder OPUS: ${error.message}`, "Audio", 31);
            activeRecordings.delete(guildId);
            scheduleNextRecordingLoop(connection, client, time);
            return;
        }

        let pipelineError = false;
        const pipeline = audioStream.pipe(opusDecoder).pipe(fileStream);

        pipeline.on('error', (error) => {
            if (!pipelineError) {
                pipelineError = true;
                log(`[${guildId}] Erro no pipeline de áudio: ${error.message}`, "Audio", 31);
                stopRecording();
            }
        });

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

            activeRecordings.delete(guildId);

            clearTimeout(maxDurationTimeout);
            clearInterval(sizeInterval);

            audioStream.removeListener("end", stopRecording);
            audioStream.removeListener("close", stopRecording);
            audioStream.removeListener("error", handleAudioError);
            connection.removeListener("disconnect", handleDisconnect);

            try { 
                if (audioStream && !audioStream.destroyed) {
                    audioStream.destroy(); 
                }
            } catch {}
            try { 
                if (fileStream && !fileStream.destroyed) {
                    fileStream.end(); 
                }
            } catch {}

            setTimeout(() => {
                if (existsSync(pcmFileName)) {
                    const stats = statSync(pcmFileName);
                    if (stats.size < 1000) {
                        log(`[${guildId}] Arquivo PCM muito pequeno (${stats.size} bytes), descartando.`, "Audio", 31);
                        try { unlinkSync(pcmFileName); } catch {}
                        scheduleNextRecordingLoop(connection, client, time);
                        return;
                    }
                    
                    convertPcmToWav(pcmFileName)
                        .then(() => {
                             scheduleNextRecordingLoop(connection, client, time);
                        })
                        .catch((err) => {
                             log(`[${guildId}] ❌ Falha na conversão: ${err.message}`, "Audio", 31);
                             try { 
                                 if (existsSync(pcmFileName)) unlinkSync(pcmFileName);
                             } catch {}
                             scheduleNextRecordingLoop(connection, client, time);
                        });
                } else {
                    log(`[${guildId}] Arquivo PCM não foi criado.`, "Audio", 31);
                    scheduleNextRecordingLoop(connection, client, time);
                }
            }, 2000); 
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
    } catch (error) {
        log(`❌ Erro não capturado em startRecording: ${error.message}`, "Audio", 31);
        if (error.stack) {
            console.error(error.stack);
        }
        // Tentar reagendar mesmo com erro
        try {
            scheduleNextRecordingLoop(connection, client, getRandomTime(RECORDING_MIN_DELAY, RECORDING_MAX_DELAY));
        } catch (e) {
            log(`❌ Falha ao reagendar gravação após erro: ${e.message}`, "Audio", 31);
        }
    }
}

function playAudio(relativePath, connection, deleteFile) {
    const guildId = connection.joinConfig.guildId;
    
    if (activePlayers.has(guildId)) {
        log(`[${guildId}] Já há um áudio tocando, pulando reprodução.`, "Audio", 33);
        return;
    }
    
    const player = createAudioPlayer();
    activePlayers.set(guildId, player);
    
    const audioPath = resolve(process.cwd(), relativePath); 
    
    if (!existsSync(audioPath)) {
        log(`[${guildId}] Arquivo de áudio não encontrado: ${relativePath}`, "Audio", 31);
        activePlayers.delete(guildId);
        return;
    }
    
    const stats = statSync(audioPath);
    if (stats.size < 1000) {
        log(`[${guildId}] Arquivo de áudio muito pequeno (${stats.size} bytes), pulando: ${relativePath}`, "Audio", 31);
        try { unlinkSync(audioPath); } catch {}
        activePlayers.delete(guildId);
        return;
    }
    
    let resource;
    try {
        resource = createAudioResource(audioPath);
    } catch (error) {
        log(`[${guildId}] Erro ao criar resource de áudio: ${error.message}`, "Audio", 31);
        activePlayers.delete(guildId);
        return;
    }
    
    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
        activePlayers.delete(guildId);
        if (deleteFile) {
            try {
                if(existsSync(audioPath)) {
                    unlinkSync(audioPath);
                }
            } catch(e) { log(`[${guildId}] Erro ao deletar arquivo: ${e.message}`, "Audio", 31); }
        }
    });
    
    player.on('error', (error) => {
        activePlayers.delete(guildId);
        log(`[${guildId}] Erro no player de áudio: ${error.message}`, "Audio", 31);
        try {
            if (existsSync(audioPath)) {
                unlinkSync(audioPath);
            }
        } catch {}
    });
}


export function playRandomAudio(connection) {
    const guildId = connection.joinConfig.guildId;
    const time = getRandomTime(PLAYBACK_MIN_DELAY, PLAYBACK_MAX_DELAY);

    try {
        const recordingDir = resolve(process.cwd(), `./recordings/${guildId}`);
        if (existsSync(recordingDir)) {
            const allFilesWav = readdirSync(recordingDir).filter((file) => file.endsWith(".wav"));
            if (allFilesWav.length >= 3) {
                const randomFile = allFilesWav[Math.floor(Math.random() * allFilesWav.length)];
                playAudio(join(`./recordings/${guildId}`, randomFile), connection, allFilesWav.length >= 50);
                
                const player = activePlayers.get(guildId);
                if (player) {
                    player.on(AudioPlayerStatus.Idle, () => {
                        const oldTimeout = playingTimeouts.get(guildId);
                        if (oldTimeout) clearTimeout(oldTimeout);
                        
                        const newTimeout = setTimeout(() => playRandomAudio(connection), Math.max(1, time) * 1000);
                        playingTimeouts.set(guildId, newTimeout);
                    });
                }
            } else {
                const oldTimeout = playingTimeouts.get(guildId);
                if (oldTimeout) clearTimeout(oldTimeout);
                
                const newTimeout = setTimeout(() => playRandomAudio(connection), Math.max(1, time / 2) * 1000);
                playingTimeouts.set(guildId, newTimeout);
            }
        } else {
            log(`[${guildId}] Pasta recordings não existe ou está vazia.`, "Audio", 31);
        }
    } catch (e) {
        log(`[${guildId}] Falha ao acessar gravações.`, "Audio", 31);
    }
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
    
    const activePlayer = activePlayers.get(guildId);
    if (activePlayer) {
        activePlayer.stop();
     
    
    activeRecordings.delete(guildId);   activePlayers.delete(guildId);
    }
}