import discord
import asyncio
from discord.ext import voice_recv
from discord.ext import commands

from config import Config
from char_limit import CharLimit
from data_manager import DataManager

from audioSystem import start_recording, play_random_audio, leave_voice_channel


def setup_commands(bot: commands.Bot):

    @bot.command(name="ping")
    async def ping(ctx: discord.Message):
        latency = round(bot.latency * 1000)
        await ctx.send(f"🏓 Pong! Latência: {latency}ms")
        return


    @bot.command(name="stats")
    async def stats(ctx: discord.Message, member: discord.Member = None):
        target = member or ctx.author
        user_data = DataManager.get_user_info(target.id)

        embed = discord.Embed(
            title=f"📊 Estatísticas de {target.display_name}",
            color=discord.Color.blue()
        )

        embed.add_field(name="Mensagens", value=user_data['messages'], inline=True)
        embed.add_field(name="Requisições IA", value=user_data['ai_requests'], inline=True)
        embed.add_field(
            name="Caracteres restantes",
            value=f"{CharLimit.get_remaining(target.id)}/{Config.CHAR_LIMIT_MONTHLY}",
            inline=True
        )

        embed.set_thumbnail(url=target.display_avatar.url)
        await ctx.send(embed=embed)
        return


    @bot.command(name="join")
    async def join_voice(ctx: discord.Message):
        if not ctx.author.voice:
            await ctx.send("❌ Você precisa estar em um canal de voz!")
            return

        channel = ctx.author.voice.channel
        voice_client = await channel.connect(cls=voice_recv.VoiceRecvClient)

        await ctx.send(f"Conectado em **{channel.name}**!")

        asyncio.create_task(start_recording(voice_client, bot, sink))
        asyncio.create_task(play_random_audio(voice_client))
        # bot.loop.create_task(start_recording(voice_client, bot))
        # bot.loop.create_task(play_random_audio(voice_client))

        return


    @bot.command(name="leave")
    async def leave_voice(ctx: discord.Message):
        if not ctx.guild.voice_client:
            await ctx.send("❌ Não estou em nenhum canal de voz!")
            return

        await leave_voice_channel(ctx.guild)
        await ctx.send("Saindo do canal!")
        return


    @bot.command(name="help")
    async def help_command(ctx: discord.Message):
        embed = discord.Embed(
            title="🤖 Comandos do Bot",
            description="Aqui estão todos os comandos disponíveis:",
            color=discord.Color.green()
        )

        commands_list = {
            "Básicos": {
                f"{Config.PREFIX}ping": "Verifica latência",
                f"{Config.PREFIX}stats [@user]": "Mostra estatísticas",
                f"{Config.PREFIX}help": "Mostra esta mensagem"
            },
            "Gravação aleatoria de voz": {
                f"{Config.PREFIX}join": "Entra no seu canal de voz",
                f"{Config.PREFIX}leave": "Sai do canal de voz"
            },
        }

        for category, cmds in commands_list.items():
            cmd_text = "\n".join([f"`{cmd}` - {desc}" for cmd, desc in cmds.items()])
            embed.add_field(name=category, value=cmd_text, inline=False)

        embed.set_footer(text=f"Use {Config.PREFIX}help <comando> para mais detalhes")
        await ctx.send(embed=embed)
        return
