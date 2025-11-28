from pathlib import Path
from discord import FFmpegPCMAudio
from uitls import fix_text, get_random_time
from datetime import datetime
from elevenlabs import VoiceSettings
import os
import asyncio
import random
import discord
from discord.ext import commands
from discord.ext import voice_recv
import elevenlabs
import wave


BASE_DIR = Path(__file__).parent
RECORDINGS_DIR = BASE_DIR / "recordings"
RECORDINGS_DIR.mkdir(exist_ok=True)

timeout_task = None
timeout_task2 = None


async def start_recording(voice_client, client, sink):
    global timeout_task2
    receiver = voice_client.receiver

    async def once_done(sink: discord.sinks, channel: discord.TextChannel, *args):
        for user_id, audio in sink.audio_data.items():
            with open(f"{user_id}.wav", "wb") as f:
                f.write(audio.file)
        await channel.send("Recording complete!")

    sink.after = once_done
    return

    time = get_random_time(60, 240)
    print(f"Próxima gravação em {time/998.4:.2f}s")
    
    user_id, pcm = await receiver.wait_for_packet()
    user = client.get_user(user_id)
    username = user.name if user else str(user_id)
    print("Iniciando gravação de:", username)

    pcm_path = f"recordings/{username}-{int(asyncio.get_event_loop().time())}.pcm"
    pcm_file = open(pcm_path, "wb")
    record_time = get_random_time(3, 10)
    stop_time = asyncio.get_event_loop().time() + record_time
    print(f"Gravando por {record_time} segundos...")
    

    try:
        while asyncio.get_event_loop().time() < stop_time:
            user_packet, pcm = await receiver.wait_for_packet()
            if user_packet == user_id:
                pcm_file.write(pcm)
    except Exception as e:
            print("Erro durante gravação:", e)
    
    pcm_file.close()

    print("Terminou. Convertendo WAV...")
    await convert_pcm_to_wav(pcm_path)


    print("Pronto. Reagendando...")
    await schedule_next_recording(voice_client, client, delay=get_random_time(5, 420))

async def schedule_next_recording(ctx, client, delay):
    await asyncio.sleep(delay)
    await start_recording(ctx, client)

async def convert_pcm_to_wav(pcm_filename):
    wav_filename = pcm_filename.replace(".pcm", ".wav")
    
    try:
        process = await asyncio.create_subprocess_exec(
            'ffmpeg',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '1',
            '-i', pcm_filename,
            '-acodec', 'pcm_s16le',
            '-ar', '48000',
            '-ac', '1',
            wav_filename,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        await process.communicate()
        
        if os.path.exists(pcm_filename):
            os.remove(pcm_filename)
            
        print(f"Áudio convertido: {wav_filename}")
        
    except Exception as e:
        print(f"Erro ao converter o áudio: {e}")

async def play_random_audio(voice_client):
    global timeout_task
    
    time = get_random_time(60, 240)
    print(f"Próxima execução em {time / 60000:.2f}min")
    
    all_files_wav = [
        f for f in os.listdir(RECORDINGS_DIR) 
        if f.endswith(".wav")
    ]
    
    if len(all_files_wav) > 0:
        print("Tocando áudio...")
        random_file = random.choice(all_files_wav)
        audio_path = RECORDINGS_DIR / random_file
        
        delete_file = len(all_files_wav) >= 50
        
        await play_audio(str(audio_path), voice_client, delete_file)
    
    timeout_task = asyncio.create_task(
        schedule_next_play(voice_client, time / 1000)
    )

async def schedule_next_play(voice_client, delay):
    await asyncio.sleep(delay)
    await play_random_audio(voice_client)

async def play_audio(wav_filename, voice_client, delete_file=False):
    try:
        audio_source = FFmpegPCMAudio(wav_filename)
        
        if voice_client.is_playing():
            voice_client.stop()
        
        voice_client.play(
            audio_source,
            after=lambda e: handle_playback_end(e, wav_filename, delete_file)
        )
        
    except Exception as e:
        print(f"Erro ao tocar áudio: {e}")

def handle_playback_end(error, wav_filename, delete_file):
    if error:
        print(f"Erro durante reprodução: {error}")
    
    if delete_file and os.path.exists(wav_filename):
        try:
            os.remove(wav_filename)
            print(f"Arquivo removido: {wav_filename}")
        except Exception as e:
            print(f"Erro ao remover arquivo: {e}")

def stop_playing_audio():
    global timeout_task, timeout_task2
    
    if timeout_task is not None:
        timeout_task.cancel()
        timeout_task = None
    
    if timeout_task2 is not None:
        timeout_task2.cancel()
        timeout_task2 = None
    
    print("Reprodução e gravação interrompidas")

async def create_audio_file_from_text(text):
    try:
        treated_text = fix_text(text)
        audio =  elevenlabs.text_to_speech.convert(
            voice_id="4tRn1lSkEn13EVTuqb0g",
            optimize_streaming_latency=0,
            output_format="mp3_44100_128",
            text=treated_text,
            model_id="eleven_flash_v2_5",
            voice_settings=VoiceSettings(
                stability=0.0,
                similarity_boost=0.0,
                style=0.0,
                use_speaker_boost=True,
            ),
        )
        
        filename = f"YUIBOT {int(asyncio.get_event_loop().time()*1000)}.mp3"
        with open(filename, 'wb') as f:
            async for chunk in audio:
                if chunk:
                    f.write(chunk)
        return filename
    except Exception as e:
        print(f"Erro ao criar áudio: {e}")
        return None
    
async def leave_voice_channel(ctx):
    user = ctx.author
    user_channel = user.voice.channel
    bot_voice = ctx.guild.voice_client

    if not user.voice or not user.voice.channel:
        return await ctx.send("Você não ta em nenhum canal de voz mano wtf boy.")

    if not bot_voice:
        return await ctx.send("Sair daonde bro? não to em nenhum canal de voz.")

    if bot_voice.channel != user_channel:
        return await ctx.send("Tu tem que ta na call pra isso mano...")

    await bot_voice.disconnect()
    await ctx.send(f"👋 bye bye, nao gostei de ficar na call: **{user_channel.name}**.")




