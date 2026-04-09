import { getChannels, saveMessageContext, getOrCreateUser, isGuildAiSilenced, getServerConfig, checkAnnouncedEvent } from "../database.js";
import { handleAchievements } from "../functions/achievements.js";
import { generateAiRes } from "../functions/generateRes.js";
import { limitChar } from "../functions/limitChar.js";
import { sayInCall } from "../functions/sayInCall.js";
import { parseMessage, replaceMentions, contextFromMessage, safeReplyToMessage, messageContainsDailyWord } from "../functions/utils.js";
import { randomResend } from "../functions/randomActions.js";
import { ALLOWED_MESSAGE_BOT_ID } from "../constants.js";
import ms from 'ms';
import { getTodaysEvent } from "../functions/getTodaysEvent.js";
import dayjs from "dayjs";
import {EmbedBuilder} from "discord.js";
import 'dayjs/locale/pt-br.js';
dayjs.locale('pt-br');

export const name = "messageCreate";
const AI_COOLDOWN_MS        = ms('12s');
const COOLDOWN_CLEANUP_MS   = ms('1m');
const COOLDOWN_TTL_FACTOR   = 5;

const RESEND_CHANCE         = 0.01;
const MENTION_REPLY_CHANCE  = 0.5;
const RANDOM_REPLY_CHANCE   = 0.05;

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

  const { guildId, userId, channelId, displayName, text, mentions } = parseMessage(message, client);

  if (!guildId || !userId || !channelId) return;

  if (await tryHandleCommand(message, client, text)) return;

  const channelSet = new Set(getChannels(guildId));
  if (!channelSet.has(channelId)) return;

  const userData = getOrCreateUser(userId, displayName, guildId);
  if (!userData) return;

  const imageUrl = extractImageUrl(message);
  
  await announceEvent(message, guildId);

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
  const prefix = getServerConfig(message.guildId, 'prefix') || "$";
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
  if (isGuildAiSilenced(message.guildId)) return;

  const genOn = getServerConfig(message.guildId, 'generateMessage') !== false;

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
  if (isGuildAiSilenced(message.guildId)) return;

  message.channel.sendTyping().catch(() => {});

  let aiResponse;
  try {
    aiResponse = await generateAiRes(message);
  } catch (err) {
    console.error("❌ Erro na geração de resposta AI:", err.message);
    return;
  }

  const replyText =
    typeof aiResponse === "string" ? aiResponse.trim() : String(aiResponse ?? "").trim();
  if (!replyText) {
    console.warn("replyWithAi: texto vazio após geração; enviando fallback.");
    try {
      await safeReplyToMessage(
        message,
        "Travei aqui e não saiu texto nenhum — tenta de novo daqui a pouco.",
      );
    } catch (e) {
      console.error("❌ Fallback reply falhou:", e.message);
    }
    return;
  }

  try {
    await safeReplyToMessage(message, replyText);
  } catch (err) {
    console.error("❌ Erro ao enviar resposta da IA:", err.message);
  }

  if (getServerConfig(message.guildId, 'speakMessage') && !isGuildAiSilenced(message.guildId)) {
    try {
      await sayInCall(message, replyText);
    } catch (error) {
      console.error("❌ Erro ao reproduzir áudio no call:", error.message);
    }
  }
}

async function announceEvent(message, guildId) {
  const event = await getTodaysEvent(guildId);

  if (checkAnnouncedEvent(guildId)) return;

  if (event && event.key !== "normal") {

    const embed = new EmbedBuilder()
      .setColor(0xff00ff)
      .setTitle(`Evento de ${dayjs().format('dddd')}`)
      .setDescription(`**${event.name}**\n${event.description}`)

    message.channel.send({ embeds: [embed] }).catch((e) => {
      console.error("❌ Erro ao anunciar evento:", e.message);
    });
  }
}