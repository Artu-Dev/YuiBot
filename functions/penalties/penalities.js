import { getLastAuthorMessage, reduceChars, setUserProperty } from "../../database.js";
import { getOrCreateWebhook } from "../utils.js";
import { invertMessage } from "../ai/generateResponse.js";
import { hasEffect } from "../effects.js";
import ms from 'ms';
import { log } from "../../bot.js";
import dayjs from "dayjs";
import { penaltiesData, randomWordsData } from "../../data/penaltiesData.js";

export const randomWords = randomWordsData;

export const penalities = penaltiesData;

// ==================== CONSTANTES ====================
const INVERT_TIMEOUT_MS = ms('5s');
const WARNING_DELETE_TIMEOUT_MS = ms('10s');
const ECO_DELETE_TIMEOUT_MS = ms('5s');
const SLOWMODE_COOLDOWN_MS = ms('10s');

// ==================== UTILITÁRIOS INTERNOS ====================
async function tryInvertMessage(text) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), INVERT_TIMEOUT_MS)
    );

    return await Promise.race([
      invertMessage(text),
      timeoutPromise,
    ]);
  } catch (error) {
    const simple = text.split(" ").reverse().join(" ");
    if (error.message !== "timeout") {
      log(`❌ Erro ao inverter mensagem: ${error.message}`, "Penality", 31);
    }
    return simple;
  }
}

async function sendModifiedMessage(message, content) {
  let newMessage = content;
  if (typeof content !== "string" && content.length > 2000) {
    newMessage = content.slice(0, 1997) + "...";
  }
  const myWebHook = await getOrCreateWebhook(message.channel, message.author);
  await message.delete().catch(() => {});
  await myWebHook.send({
    content: newMessage,
    username: message.member?.displayName || message.author.username,
    avatarURL: message.author.displayAvatarURL(),
  });
}

async function sendWarning(message, warning) {
  await message.delete().catch(() => {});
  const warningMessage = await message.channel.send(
    `<@${message.author.id}> ${warning}`
  );
  setTimeout(() => {
    warningMessage.delete().catch(() => {});
  }, WARNING_DELETE_TIMEOUT_MS);
}

const GIF_KEYWORDS = [
  '://tenor.com',
  '://media.tenor.com',
  '://giphy.com',
  '://klipy.com',
  '://imgur.com',
  '://i.imgur.com',
  '://redgif.com',
  '.gif'
];
const GIF_URL_REGEX = /(https?:\/\/[^\s]+)/gi;

function hasGifKeyword(text = "") {
  const lower = (text || "").toLowerCase();
  return GIF_KEYWORDS.some(keyword => lower.includes(keyword));
}

export function isGifOnlyMessage(message) {
  const content = (message.content || "").trim();
  const urls = content.match(GIF_URL_REGEX) || [];
  const textWithoutUrls = content.replace(GIF_URL_REGEX, "").trim();
  const hasNonUrlText = textWithoutUrls.length > 0;

  const hasGifLink = urls.some(hasGifKeyword);

  const isGifOnly = hasGifLink && !hasNonUrlText;

  return isGifOnly;
}

function isAttachmentOnly(message) {
  const content = (message.content || "").trim();
  const hasAttachments = message.attachments.size > 0;
  return hasAttachments && content.length === 0;
}

export async function handlePenalities(message, userData) {
  const isGifOnly = isGifOnlyMessage(message);
  const isMediaOnly = isAttachmentOnly(message);

  if (isMediaOnly || isGifOnly) {
    return false;
  }

  // ===== VERIFICAR IMMUNITY =====
  const { guildId, userId } = message;
  const actualGuildId = guildId || message.guild?.id;
  const actualUserId = userId || message.author?.id;
  
  if (hasEffect(actualUserId, actualGuildId, 'immunity')) {
    return false; 
  }

  if (Number(userData.charLeft) > 0 && userData.penalitySetByAdmin !== 1) return false;

  const penality = userData.penality;
  if (!penality) return false;

  const content = message.content;
  let isPunished = false;
  let warning = "";

  // ===== HATER DE VOGAIS =====
  if (penality === "hater_vogais" && /[aeiou]/i.test(content)) {
    isPunished = true;
    warning = "Você não pode usar vogais!";

  // ===== PALAVRA OBRIGATÓRIA =====
  } else if (penality === "palavra_obrigatoria") {
    const required = userData.penalityWord || "";
    if (!content.endsWith(required)) {
      isPunished = true;
      warning = `Sua mensagem precisa terminar com: ${required}`;
    }

  // ===== COMO DIMINUI A FONTE? =====
  } else if (
    penality === "como_diminui_a_fonte" &&
    content !== content.toUpperCase()
  ) {
    isPunished = true;
    warning = "Você só pode usar MAIÚSCULAS!";

  // ===== TIMIDEZ =====
  } else if (
    penality === "timidez"
  ) {
    const palavras = content.trim().split(/\s+/);
    if (palavras.length > 1) {
      isPunished = true;
      warning = "Você só pode enviar uma única palavra!";
    }

  // ===== REDIGIDO =====
  } else if (
    penality === "redigido"
  ) {
    const textPunished =
      (message.content || "")
        .split("")
        .map((char) => (char === " " ? " " : `||${char}||`))
        .join("") || "...";

    await sendModifiedMessage(message, textPunished);
    return false;

  // ===== SENTIDO INVERTIDO =====
  } else if (penality === "sentido_invertido") {
    let invertedText = message.content || "";
    invertedText = await tryInvertMessage(invertedText);

    await sendModifiedMessage(message, invertedText);
    return false;

  // ===== SLOWMODE =====
  } else if (penality === "slowmode") {
    const now = dayjs().valueOf();

    const lastMessageTime = getLastAuthorMessage(
      message.channel.id,
      message.guild.id,
      message.author.id
    );
    
    const lastTime = lastMessageTime ? Number(lastMessageTime) : 0;
    const timeSinceLast = now - lastTime;

    if (timeSinceLast < SLOWMODE_COOLDOWN_MS) {
        isPunished = true;

        const expiryTimeMs = lastTime + SLOWMODE_COOLDOWN_MS;
        const expiryUnix = Math.floor(expiryTimeMs / 1000);

        warning = `Você está em slowmode! Aguarde <t:${expiryUnix}:R> antes de enviar outra mensagem.`;
    }
  // ===== IRRELEVÂNCIA =====
  } else if (penality === "irrelevancia") {
    setTimeout(() => {
      message.delete().catch(() => {});
    }, ECO_DELETE_TIMEOUT_MS);

  // ===== APENAS GIFS =====
  } else if (penality === "gif_only") {
    const isGifOnly = isGifOnlyMessage(message);
    if (!isGifOnly) {
      isPunished = true;
      warning = "Você só pode enviar GIFs! Nada de texto.";
    }
  }

  if (isPunished) {
    await sendWarning(message, warning);
    return true;
  }

  return false;
}