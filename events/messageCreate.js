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

// Initialize cooldown cleanup on event startup
initCooldownCleanup();

export function cleanupMessageCreateListeners() {
  cleanupCooldowns();
}


export const execute = async (message, client) => {
  const { author } = message;
  if (!author || (author.bot && author.id !== ALLOWED_MESSAGE_BOT_ID)) return;

  const { guildId, userId, channelId, displayName } = parseMessage(message, client);
  if (!guildId || !userId || !channelId) return;

  // 1. Handle commands (prefix-based)
  const messageText = message.content?.trim() || "";
  if (await handleCommand(message, client, messageText)) return;

  // 2. Extract image if present
  const imageUrl = extractImageUrl(message);

  // 3. Announce event if needed
  await announceEventIfNeeded(message, guildId);

  // 4. Process message context (save + char limit)
  const isValidMessage = await processMessageContext(message, userId, displayName, guildId, channelId, imageUrl);
  if (!isValidMessage) return;

  // 5. Handle random actions (mention reply, resend, random reply)
  const mentions = parseMessage(message, client).mentions;
  await handleRandomActions(message, userId, mentions);

  // 6. Check achievements
  handleAchievementsCheck(message);
};