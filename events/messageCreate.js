import { ALLOWED_MESSAGE_BOT_ID } from "../data/config.js";
import { parseMessage } from "../functions/utils.js";
import { handleCommand } from "../functions/handlers/messageCreate/commands.js";
import { handleAchievementsCheck } from "../functions/handlers/messageCreate/achievements.js";
import { processMessageContext } from "../functions/handlers/messageCreate/messageContext.js";
import { handleRandomActions, initCooldownCleanup, cleanupCooldowns } from "../functions/handlers/messageCreate/randomActions.js";
import { announceEventIfNeeded } from "../functions/handlers/messageCreate/events.js";
import { extractImageUrl } from "../functions/handlers/messageCreate/utils.js";

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