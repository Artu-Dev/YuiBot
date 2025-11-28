from data_manager import DataManager
from config import Config
from datetime import datetime
import discord

data_manager = DataManager();

class CharLimit:
    def __init__(self):
        pass 

    def get_current_month(self) -> str:
        return datetime.now().strftime("%Y-%m")

    def get_user_usage(self, user_id: str) -> int:
        user = data_manager.get_user_info(user_id)
        if user is None:
            data_manager.create_user_if_not_exists(user_id)
            return 0
        
        used = Config.CHAR_LIMIT_MONTHLY - user["charLeft"]
        return max(0, used)


    def get_remaining(self, user_id: str) -> int:
        user = data_manager.get_user_info(user_id)
        if user is None:
            data_manager.create_user_if_not_exists(user_id)
            return Config.CHAR_LIMIT_MONTHLY

        return max(0, user["charLeft"])

    def reset_chars(self):

        import sqlite3
        from data_manager import conn, cur

        cur.execute("UPDATE users SET charLeft = charLeft + ?", (Config.CHAR_LIMIT_MONTHLY))
        conn.commit()

    async def handle_char_limit(self, message: discord.Message):
        user_id = str(message.author.id)
        text = message.content
        text_size = len(text)
        
        data_manager.create_user_if_not_exists(user_id)

        new_value = data_manager.reduce_chars(user_id, text_size)


        if new_value <= 0:
            await message.reply(
                f"⚠️ {message.author.display_name}, você **não tem mais caracteres!** ⚠️"
            )
            try:
                await message.delete()
            except:
                pass
            return
        
        if "capeta" in text.lower():
            data_manager.reduce_chars(user_id, 500)
            await message.reply("❌ Palavra proibida!!! Você perdeu **500 caracteres**! ❌")
            return

        try:
            if new_value > 1000:
                await message.add_reaction("🟢")
            elif new_value > 500:
                await message.add_reaction("🟡")
            else:
                await message.add_reaction("🔴")
        except:
            pass
