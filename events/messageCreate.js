import { ALLOWED_MESSAGE_BOT_ID } from "../data/config.js";
import { parseMessage } from "../functions/utils.js";
import { 
  handleCommand,
  handleAchievementsCheck,
  processMessageContext,
  handleRandomActions,
  announceEventIfNeeded,
  extractImageUrl,
  initCooldownCleanup,
  cleanupCooldowns
} from "../functions/handlers/messageCreate/index.js";

export const name = "messageCreate";
export const cleanup = cleanupMessageCreateListeners;

initCooldownCleanup();

export function cleanupMessageCreateListeners() {
  cleanupCooldowns();
}


export const execute = async (message, client) => {
  const { author } = message;
  if (!author || (author.bot && author.id !== ALLOWED_MESSAGE_BOT_ID)) return;

  const { guildId, userId, channelId, displayName } = parseMessage(message, client);
  if (!guildId || !userId || !channelId) return;

  const messageText = message.content?.trim() || "";
  if (await handleCommand(message, client, messageText)) return;

  const imageUrl = extractImageUrl(message);

  await announceEventIfNeeded(message, guildId);

  const isValidMessage = await processMessageContext(message, userId, displayName, guildId, channelId, imageUrl);
  if (!isValidMessage) return;

  const mentions = parseMessage(message, client).mentions;
  await handleRandomActions(message, userId, mentions);

  handleAchievementsCheck(message);
};