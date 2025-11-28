
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    TOKEN = os.getenv("DISCORD_TOKEN")
    PREFIX = "$"
    ACTIVITY_STATUS = "Yui Mizuno aqui mano"
    
    CHAR_LIMIT_MONTHLY = 2000
    SILENCE_THRESHOLD = 180

    DATA_DIR = "data"
    AUDIO_DIR = "recordings"

    @classmethod
    def setup_directories(cls):
        os.makedirs(cls.DATA_DIR, exist_ok=True)
        os.makedirs(cls.AUDIO_DIR, exist_ok=True)

    