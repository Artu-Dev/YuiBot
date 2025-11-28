# import discord 
# from discord.ext import commands, tasks
# import asyncio
# import random
# import json
# import os
# from datetime import datetime, timedelta
# from collections import defaultdict
# from typing import Optional, List, Dict
# import aiohttp
# from config import Config
# from data_manager import DataManager
# from char_limit import CharLimit
# from ai_system import AISystem
# from audioSystem import start_recording, play_random_audio, stop_playing_audio

# Config.setup_directories()

# intents = discord.Intents.all()
# intents.message_content = True
# intents.members = True
# intents.voice_states = True

# bot = commands.Bot(
#     command_prefix='!',
#     intents=intents,
#     help_command=None
# )

# data_manager = DataManager()
# char_limit = CharLimit()



# ai_system = AISystem()

# # =====================================================
# # SISTEMA DE ÁUDIO
# # =====================================================

# class AudioSystem2:
#     def __init__(self):
#         self.recordings = []
#         self.recording_active = {}
    
#     async def join_voice(self, voice_channel: discord.VoiceChannel) -> Optional[discord.VoiceClient]:
#         try:
#             if voice_channel.guild.voice_client:
#                 return voice_channel.guild.voice_client
            
#             vc = await voice_channel.connect()
#             print(f"✅ Conectado ao canal: {voice_channel.name}")
#             return vc
        
#         except Exception as e:
#             print(f"❌ Erro ao conectar: {e}")
#             return None
    
#     async def leave_voice(self, guild: discord.Guild):
#         if guild.voice_client:
#             await guild.voice_client.disconnect()
#             print(f"✅ Desconectado da call: {guild.name}")
    
#     def start_recording(self, guild_id: int):
#         self.recording_active[guild_id] = True
#         # TODO: Implementar lógica de gravação real
#         print(f"🔴 Gravação iniciada no servidor {guild_id}")
    
#     def stop_recording(self, guild_id: int):
#         self.recording_active[guild_id] = False
#         print(f"⏹️ Gravação parada no servidor {guild_id}")
    
#     async def play_random_clip(self, voice_client: discord.VoiceClient):
#         if not self.recordings:
#             print("Nenhum clipe disponível ainda")
#             return
        
#         clip = random.choice(self.recordings)
#         # TODO: Implementar reprodução real
#         print(f"🔊 Tocando clipe: {clip}")

# audio_system2 = AudioSystem2()

# # =====================================================

# @bot.event
# async def on_ready():
#     print(f"""
# ╔════════════════════════════════════════╗
# ║   BOT ONLINE! 🤖                       ║
# ║   Nome: {bot.user.name}                 
# ║   ID: {bot.user.id}                     
# ║   Servidores: {len(bot.guilds)}         
# ╚════════════════════════════════════════╝
#     """)
    
#     cleanup_old_data.start()
    
#     await bot.change_presence(
#         activity=discord.Activity(
#             type=discord.ActivityType.listening,
#             name=f"{Config.PREFIX}help | que isso mano..."
#         )
#     )

# @bot.event
# async def on_message(message: discord.Message):
#     if message.author.bot:
#         return
    
#     should_respond = (
#         bot.user.mentioned_in(message) or 
#         random.random() < 0.05 
#     )
    
#     if should_respond and len(message.content) > 0:
#         async with message.channel.typing():
#             response = await ai_system.generate_response(
#                 message.content,
#                 message.author.id
#             )
            
#             if response:
#                 await message.reply(response)
                
#                 if message.author.voice:
#                     # TODO: Implementar TTS e falar na call
#                     pass
    
#     ctx = await bot.get_context(message)
#     if(ctx.valid):
#         await bot.process_commands(message)
#         return

#     await char_limit.handle_char_limit(message)

#     await bot.process_commands(message)


# @bot.event
# async def on_voice_state_update(member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
    
#     if member.bot:
#         return
    
#     if after.channel and not before.channel:
#         print(f"🎤 {member.name} entrou em {after.channel.name}")
        
#         if random.random() < 0.2:
#             await audio_system2.join_voice(after.channel)
    
#     elif before.channel and not after.channel:
#         print(f"👋 {member.name} saiu de {before.channel.name}")
        
#         if len(before.channel.members) == 1: 
#             await audio_system2.leave_voice(member.guild)

# # ===========================================

# @bot.command(name='ping')
# async def ping(ctx):
#     latency = round(bot.latency * 1000)
#     await ctx.send(f"🏓 Pong! Latência: {latency}ms")
#     return

# @bot.command(name='charinfo')
# async def stats(ctx, member: discord.Member = None):
#     target = member or ctx.author
#     user_data = data_manager.get_user_info(target.id)
    
#     embed = discord.Embed(
#         title=f"📊 Estatísticas de {target.display_name}",
#         color=discord.Color.blue()
#     )
    
#     embed.add_field(name="Mensagens", value=user_data['messages'], inline=True)
#     embed.add_field(name="Requisições IA", value=user_data['ai_requests'], inline=True)
#     embed.add_field(
#         name="Caracteres restantes",
#         value=f"{char_limit.get_remaining(target.id)}/{Config.CHAR_LIMIT_MONTHLY}",
#         inline=True
#     )
    
#     embed.set_thumbnail(url=target.display_avatar.url)
#     await ctx.send(embed=embed)
#     return

# @bot.command(name='join')
# async def join_voice(ctx):
#     if not ctx.author.voice:
#         await ctx.send("❌ Você precisa estar em um canal de voz!")
#         return
    
#     channel = ctx.author.voice.channel
#     voice_client = await channel.connect()

#     await ctx.send(f"✅ Conectado em **{channel.name}**!")

#     await start_recording(voice_client, bot)
#     await play_random_audio(voice_client)



#     return

# @bot.command(name='leave')
# async def leave_voice(ctx):
#     if not ctx.guild.voice_client:
#         await ctx.send("❌ Não estou em nenhum canal de voz!")
#         return
    
#     await audio_system2.leave_voice(ctx.guild)
#     await ctx.send("Saindo do canal!")
#     return

# @bot.command(name='help')
# async def help_command(ctx):
#     embed = discord.Embed(
#         title="🤖 Comandos do Bot",
#         description="Aqui estão todos os comandos disponíveis:",
#         color=discord.Color.green()
#     )
    
#     commands_list = {
#         "Básicos": {
#             f"{Config.PREFIX}ping": "Verifica latência",
#             f"{Config.PREFIX}stats [@user]": "Mostra estatísticas",
#             f"{Config.PREFIX}help": "Mostra esta mensagem"
#         },
#         "Voz": {
#             f"{Config.PREFIX}join": "Entra no seu canal de voz",
#             f"{Config.PREFIX}leave": "Sai do canal de voz"
#         },
#         "IA": {
#             f"{Config.PREFIX}ask <pergunta>": "Faz pergunta para IA"
#         }
#     }
    
#     for category, cmds in commands_list.items():
#         cmd_text = "\n".join([f"`{cmd}` - {desc}" for cmd, desc in cmds.items()])
#         embed.add_field(name=category, value=cmd_text, inline=False)
    
#     embed.set_footer(text=f"Use {Config.PREFIX}help <comando> para mais detalhes")
#     await ctx.send(embed=embed)
#     return

# # =====================================================
# # TASKS PERIÓDICAS
# # =====================================================

# @tasks.loop(hours=24)
# async def cleanup_old_data():
#     print("🧹 Limpando dados antigos...")

# # =====================================================
# # INICIALIZAÇÃO
# # =====================================================

# if __name__ == '__main__':
#     print("""
#     ╔══════════════════════════════════════╗
#     ║  🚀 INICIANDO BOT...                 ║
#     ╚══════════════════════════════════════╝
#     """)
    
#     try:
#         print(Config.TOKEN)
#         bot.run(Config.TOKEN)
#     except Exception as e:
#         print(f"❌ Erro ao iniciar bot: {e}")



import os
import random
from dotenv import load_dotenv
import discord
from discord.ext import commands, tasks
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings
import aiohttp
from config import Config
import json
from commands import setup_commands

load_dotenv()

friends = {
    "Tropinha": {
        "aliases": ["trp", "trepinha"],
        "vibe": "nerd irônico, meio hater",
        "details": "fala rápido, mora em Portugal e inventa moda o tempo todo",
        "likes": ["Pizza Tower", "Ultrakill", "nerd stuff"]
    },
    "Enzo": {
        "vibe": "friendly and funny",
        "details": "paraense, gamer, e gosta de anime de garota cavalo",
        "likes": ["Souls-like games", "Monster Hunter", "anime music"]
    },
    # ... (outros amigos - manter a mesma estrutura)
}

intents = discord.Intents.all()
intents.message_content = True
intents.members = True
intents.voice_states = True

elevenlabs = ElevenLabs(api_key=os.getenv('ELEVENLABS_API_KEY'))


client = commands.Bot(
    command_prefix=Config.PREFIX,
    intents=intents,
    help_command=None
)


@client.event
async def on_ready():
    print(f'Bot online como \033[36m{client.user}\033[0m')

@client.event
async def on_command_error(ctx, error):
    
    if isinstance(error, commands.CommandNotFound):
        await ctx.send(f"❌ Comando não encontrado. Use `{Config.PREFIX}help` para ver comandos disponíveis.")
    
    elif isinstance(error, commands.MissingRequiredArgument):
        await ctx.send(f"❌ Faltam argumentos! Use `{Config.PREFIX}help {ctx.command}` para ver como usar.")
    
    elif isinstance(error, commands.MissingPermissions):
        await ctx.send("❌ Você não tem permissão para usar este comando!")
    
    else:
        print(f"Erro não tratado: {error}")
        await ctx.send("❌ Ocorreu um erro inesperado!")

setup_commands(client)

client.run(os.getenv('DISCORD_TOKEN'))