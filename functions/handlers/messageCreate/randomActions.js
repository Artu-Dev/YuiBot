import { isGuildAiSilenced, getServerConfig } from "../../../database.js";
import { randomResend } from "../../randomActions.js";
import { messageContainsDailyWord } from "../../utils.js";
import { replyWithAi } from "./aiResponse.js";
import { log } from "../../../bot.js";
import ms from 'ms';

/**
 * Handler para ações aleatórias (resend, random reply, mention reply)
 * Responsabilidades:
 * - Gerenciar cooldowns de IA
 * - Decidir se vai responder aleatoriamente
 * - Coordenar com gerador de IA
 */

const AI_COOLDOWN_MS = ms('12s');
const COOLDOWN_CLEANUP_MS = ms('1m');
const COOLDOWN_TTL_FACTOR = 5;

const RESEND_CHANCE = 0.005;
const MENTION_REPLY_CHANCE = 0.5;
const RANDOM_REPLY_CHANCE = 0.01;

const aiCooldowns = new Map();
let cooldownCleanupInterval = null;

export function initCooldownCleanup() {
  if (cooldownCleanupInterval) {
    clearInterval(cooldownCleanupInterval);
  }
  cooldownCleanupInterval = setInterval(() => {
    const expiry = Date.now() - COOLDOWN_TTL_FACTOR * AI_COOLDOWN_MS;
    for (const [userId, timestamp] of aiCooldowns) {
      if (timestamp < expiry) aiCooldowns.delete(userId);
    }
  }, COOLDOWN_CLEANUP_MS);
}

export function cleanupCooldowns() {
  if (cooldownCleanupInterval) {
    clearInterval(cooldownCleanupInterval);
    cooldownCleanupInterval = null;
  }
  aiCooldowns.clear();
}

function isOnCooldown(userId) {
  const last = aiCooldowns.get(userId) ?? 0;
  return Date.now() - last < AI_COOLDOWN_MS;
}

export async function handleRandomActions(message, userId, mentions) {
  if (isGuildAiSilenced(message.guildId)) return;

  const genOn = getServerConfig(message.guildId, 'generateMessage') !== false;

  // Tentar resend aleatório
  if (genOn && Math.random() < RESEND_CHANCE) {
    try {
      await randomResend(message);
    } catch (error) {
      log(`❌ Erro no resend aleatório: ${error.message}`, "RandomActions", 31);
    }
    return;
  }

  // Decidir se vai responder
  const shouldReplyToMention = mentions.isMentioningClient && Math.random() < MENTION_REPLY_CHANCE;
  const shouldReplyRandomly =
    genOn &&
    !messageContainsDailyWord(message.content || "") &&
    Math.random() < RANDOM_REPLY_CHANCE;

  if (shouldReplyToMention || shouldReplyRandomly) {
    if (isOnCooldown(userId)) return;

    aiCooldowns.set(userId, Date.now());
    try {
      await replyWithAi(message);
    } catch (error) {
      log(`❌ Erro na resposta AI: ${error.message}`, "AI", 31);
    }
  }
}
