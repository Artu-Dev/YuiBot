import { existsSync, mkdirSync } from "fs";
import dotenv from "dotenv";

dotenv.config();

class Config {
    // ========== CONSTANTES ==========
    static ALLOWED_MESSAGE_BOT_ID = "974297735559806986";
    
    // ========== STATUS ==========
    static ACTIVITY_STATUS = "Yui Mizuno aqui mano";

    // ========== DIRETÓRIOS ==========
    static DATA_DIR = "data";
    static AUDIO_DIR = "recordings";

    // ========== MÉTODOS ==========
    static setupDirectories() {
        if (!existsSync(this.DATA_DIR)) {
            mkdirSync(this.DATA_DIR, { recursive: true });
        }
        if (!existsSync(this.AUDIO_DIR)) {
            mkdirSync(this.AUDIO_DIR, { recursive: true });
        }
    }
}

export default Config;

// Export the constant for direct use
export const ALLOWED_MESSAGE_BOT_ID = Config.ALLOWED_MESSAGE_BOT_ID;
