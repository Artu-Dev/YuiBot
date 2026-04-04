import {
  dbBot,
  getChannels,
  saveMessageContext,
  getOrCreateUser,
} from "../database.js";
import { handleAchievements } from "../functions/achievements.js";
import { generateAiRes } from "../functions/generateRes.js";
import { limitChar } from "../functions/limitChar.js";
import { sayInCall } from "../functions/sayInCall.js";
import {
  parseMessage,
  replaceMentions,
  contextFromMessage,
  safeReplyToMessage,
  messageContainsDailyWord,
} from "../functions/utils.js";
import { randomResend } from "../functions/randomActions.js";
import { ALLOWED_MESSAGE_BOT_ID } from "../constants.js";

export const name = "messageCreate";
const AI_COOLDOWN_MS        = 12_000;
const COOLDOWN_CLEANUP_MS   = 60_000;
const COOLDOWN_TTL_FACTOR   = 5;
const RESEND_CHANCE         = 0.003;
const MENTION_REPLY_CHANCE  = 0.5;
const RANDOM_REPLY_CHANCE   = 0.006;

const aiCooldowns = new Map();

setInterval(() => {
  const expiry = Date.now() - COOLDOWN_TTL_FACTOR * AI_COOLDOWN_MS;
  for (const [userId, timestamp] of aiCooldowns) {
    if (timestamp < expiry) aiCooldowns.delete(userId);
  }
}, COOLDOWN_CLEANUP_MS);


function isOnCooldown(userId) {
  const last = aiCooldowns.get(userId) ?? 0;
  return Date.now() - last < AI_COOLDOWN_MS;
}

export const execute = async (message, client) => {
  const { author } = message;
  if (!author || (author.bot && author.id !== ALLOWED_MESSAGE_BOT_ID)) return;

  const { guildId, userId, channelId, displayName, text, mentions } =
    parseMessage(message, client);

  if (await tryHandleCommand(message, client, text)) return;

  const channelSet = new Set(getChannels(guildId));
  if (!channelSet.has(channelId)) return;

  const userData = getOrCreateUser(userId, displayName, guildId);
  const imageUrl  = extractImageUrl(message);

  await limitChar(message, userData);

  await saveMessageContext(
    channelId,
    guildId,
    displayName,
    await replaceMentions(message, text),
    userId,
    message.id,
    imageUrl
  );

  await handleRandomActions(message, userId, mentions);
  handleAchievements(message);
};

// ── Funções auxiliares ────────────────────────────────────────

async function tryHandleCommand(message, client, text) {
  const prefix = dbBot.data.configs.prefix || "$";
  const isSlash  = text.startsWith("/");
  const isPrefix = text.startsWith(prefix);

  if (!isSlash && !isPrefix) return false;

  const raw     = text.slice(isSlash ? 1 : prefix.length).trim();
  const args    = raw.split(/ +/);
  const cmdName = args.shift().toLowerCase();
  const command = client.commands.get(cmdName);

  if (!command) return true;

  if (typeof command.execute !== "function") {
    console.warn(`⚠️ Comando "${cmdName}" não tem função execute definida.`);
    return true;
  }

  try {
    await command.execute(client, contextFromMessage(message));
  } catch (error) {
    console.error(`❌ Erro ao executar comando "${cmdName}":`, error);
  }

  return true;
}


function extractImageUrl(message) {
  if (!message.attachments.size) return null;

  const imageAttachment = message.attachments.find((a) => {
    const isType = a.contentType?.startsWith("image/");
    const isExt  = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.name ?? "");
    return isType || isExt;
  });

  return imageAttachment?.url ?? null;
}

async function handleRandomActions(message, userId, mentions) {
  const genOn = dbBot.data.configs.generateMessage !== false;

  if (genOn && Math.random() < RESEND_CHANCE) {
    await randomResend(message);
    return;
  }

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
      console.error("❌ Erro na resposta AI:", error.message);
    }
  }
}

async function replyWithAi(message) {
  message.channel.sendTyping().catch(() => {});

  let aiResponse;
  try {
    aiResponse = await generateAiRes(message);
  } catch (err) {
    console.error("❌ Erro na geração de resposta AI:", err.message);
    return;
  }

  if (!aiResponse) return;

  try {
    await safeReplyToMessage(message, aiResponse);
  } catch (err) {
    console.error("❌ Erro ao enviar resposta da IA:", err.message);
  }

  if (dbBot.data.configs.speakMessage) {
    try {
      await sayInCall(message, aiResponse);
    } catch (error) {
      console.error("❌ Erro ao reproduzir áudio no call:", error.message);
    }
  }
}