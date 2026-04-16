/**
 * Coordenador central de handlers do messageCreate
 * Orquestra todos os handlers em sequência
 */

export { handleCommand } from "./commands.js";
export { handleAchievementsCheck } from "./achievements.js";
export { processMessageContext } from "./messageContext.js";
export { handleRandomActions, initCooldownCleanup, cleanupCooldowns } from "./randomActions.js";
export { replyWithAi } from "./aiResponse.js";
export { announceEventIfNeeded } from "./events.js";
export { extractImageUrl } from "./utils.js";
