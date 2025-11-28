from config import Config
import os
import json
import sqlite3
from typing import Optional, Dict, Any

class DataManager:
    def __init__(self, db_file: str = "data.db", bot_json_file: str = "dbBot.json", char_limit: Optional[int] = None):
        self.bot_json_file = bot_json_file
        self.conn = sqlite3.connect(db_file, check_same_thread=False)
        self.cur = self.conn.cursor()
        self.max_chars = char_limit if char_limit is not None else Config.CHAR_LIMIT_MONTHLY
        self._initialize_db()
        self.dbBot = self._load_bot_json()

    def _initialize_db(self) -> None:
        self.cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                charLeft INTEGER
            )
        """)
        self.conn.commit()

    def _load_bot_json(self) -> Dict[str, Any]:
        if not os.path.exists(self.bot_json_file):
            with open(self.bot_json_file, "w", encoding="utf-8") as f:
                json.dump({"channels": []}, f, indent=2)

        with open(self.bot_json_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_bot_json(self, data: Dict[str, Any]) -> None:
        with open(self.bot_json_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        self.dbBot = data

    def create_user_if_not_exists(self, user_id: str) -> Dict[str, Any]:
        self.cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = self.cur.fetchone()

        if user is None:
            self.cur.execute("INSERT INTO users (id, charLeft) VALUES (?, ?)",
                             (user_id, self.max_chars))
            self.conn.commit()
            return {"id": user_id, "charLeft": self.max_chars}

        return {"id": user[0], "charLeft": user[1]}

    def reduce_chars(self, user_id: str, amount: int) -> int:
        user = self.create_user_if_not_exists(user_id)
        new_value = max(0, user["charLeft"] - amount)

        self.cur.execute("UPDATE users SET charLeft = ? WHERE id = ?", (new_value, user_id))
        self.conn.commit()

        return new_value

    def get_user_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        self.cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = self.cur.fetchone()

        if user is None:
            return None

        return {"id": user[0], "charLeft": user[1]}

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass
