import { isGuildAiSilenced, getServerConfig } from "../../../database.js";
import { generateAiRes } from "../../ai/generateResponse.js";
import { sayInCall } from "../../voice/tts.js";
import { safeReplyToMessage } from "../../utils.js";
import { log } from "../../../bot.js";

/**
 * Handler para respostas de IA
 * Responsabilidades:
 * - Gerar resposta via generateAiRes
 * - Enviar resposta formatada
 * - Opcional: falar no call via TTS
 */

export async function replyWithAi(message) {
  if (isGuildAiSilenced(message.guildId)) return;

  message.channel.sendTyping().catch(() => {});

  let aiResponse;
  try {
    aiResponse = await generateAiRes(message);
  } catch (err) {
    log("❌ Erro na geração de resposta AI: " + err.message, "AI", 31);
    return;
  }

  const replyText = typeof aiResponse === "string" 
    ? aiResponse.trim() 
    : String(aiResponse ?? "").trim();

  if (!replyText) {
    log("⚠️ Resposta AI vazia, enviando fallback.", "AI", 33);
    try {
      await safeReplyToMessage(message, "Travei aqui e não saiu texto nenhum — tenta de novo daqui a pouco.");
    } catch (e) {
      log("❌ Fallback reply falhou: " + e.message, "AI", 31);
    }
    return;
  }

  try {
    await safeReplyToMessage(message, replyText);
  } catch (err) {
    log(`❌ Erro ao enviar resposta da IA: ${err.message}`, "AI", 31);
  }

  // Opcional: falar no call
  if (getServerConfig(message.guildId, 'speakMessage') && !isGuildAiSilenced(message.guildId)) {
    try {
      await sayInCall(message, replyText);
    } catch (error) {
      log(`❌ Erro ao reproduzir áudio no call: ${error.message}`, "Áudio", 31);
    }
  }
}
