import { limitChar } from "../../limitChar.js";
import { saveMessageContext, getOrCreateUser, getChannels } from "../../../database.js";
import { replaceMentions } from "../../utils.js";

/**
 * Handler para processamento de mensagem
 * Responsabilidades:
 * - Validar se mensagem é em canal do bot
 * - Verificar limite de caracteres
 * - Salvar contexto de mensagem
 */

export async function processMessageContext(message, userId, displayName, guildId, channelId, imageUrl) {
  const channelSet = new Set(getChannels(guildId));
  if (!channelSet.has(channelId)) return false;

  const userData = getOrCreateUser(userId, displayName, guildId);
  if (!userData) return false;


  const validCharsMessage = await limitChar(message, userData);
  if (!validCharsMessage) return false;

  try {
    await saveMessageContext(
      channelId,
      guildId,
      displayName,
      await replaceMentions(message, message.content),
      userId,
      message.id,
      imageUrl
    );
  } catch (error) {
    console.error('[saveMessageContext] Erro:', error);
  }

  return true;
}
