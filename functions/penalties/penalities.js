import { getLastAuthorMessage, reduceChars, setUserProperty } from "../../database.js";
import { getOrCreateWebhook } from "../utils.js";
import { invertMessage } from "../ai/generateResponse.js";
import { hasEffect } from "../effects.js";
import ms from 'ms';
import { log } from "../../bot.js";
import dayjs from "dayjs";
import { penaltiesData, randomWordsData } from "../../data/penaltiesData.js";
import { getRandomOverlayAvatar } from "../canvasApi.js";

export const randomWords = randomWordsData;

export const penalities = penaltiesData;

// ==================== CONSTANTES ====================
const INVERT_TIMEOUT_MS = ms('5s');
const WARNING_DELETE_TIMEOUT_MS = ms('10s');
const ECO_DELETE_TIMEOUT_MS = ms('5s');
const SLOWMODE_COOLDOWN_MS = ms('10s');



// ==================== UTILITÁRIOS INTERNOS ====================

async function sendModifiedMessage(message, content) {
  await message.delete().catch(() => {});

  let newMessage = content;
  if (typeof content !== "string" && content.length > 2000) {
    newMessage = content.slice(0, 1997) + "...";
  }
  const myWebHook = await getOrCreateWebhook(message.channel, message.author);
  const avatarURL = message.author.displayAvatarURL({ size: 256, extension: "png" });
  let filteredAvatarUrl;

  if(Math.random() < 0.2) {
    try {
      filteredAvatarUrl = await getRandomOverlayAvatar(avatarURL);

      await message.delete().catch(() => {});
      await myWebHook.send({
        content: newMessage,
        username: message.member?.displayName || message.author.username,
        avatarURL: filteredAvatarUrl ,
      });
      return true;
    } catch (err) {
      log(`⚠️ Não foi possível aplicar filtro ao avatar, enviando sem filtro: ${err.message}`, "Penality", 33);
    }
  }

  await myWebHook.send({
    content: newMessage,
    username: message.member?.displayName || message.author.username,
    avatarURL: avatarURL,
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

  const penaltyKey = userData.penalty;
  if (Number(userData.charLeft) > 0 && userData.penaltySetByAdmin !== 1) {
    return false;
  }

  if (!penaltyKey || !penaltiesData[penaltyKey]) {
    return false;
  }

  const content = message.content;
  let isPunished = false;
  let warning = "";

  // ===== HATER DE VOGAIS =====
  if (penaltyKey === "hater_vogais" && /[aeiou]/i.test(content)) {
    isPunished = true;
    warning = "Você não pode usar vogais!";

  // ===== PALAVRA OBRIGATÓRIA =====
  } else if (penaltyKey === "palavra_obrigatoria") {
    const required = userData.penaltyWord || "";
    if (!content.endsWith(required)) {
      isPunished = true;
      warning = `Sua mensagem precisa terminar com: ${required}`;
    }

  // ===== COMO DIMINUI A FONTE? =====
  } else if (
    penaltyKey === "como_diminui_a_fonte" &&
    content !== content.toUpperCase()
  ) {
    isPunished = true;
    warning = "Você só pode usar MAIÚSCULAS!";

  // ===== TIMIDEZ =====
  } else if (
    penaltyKey === "timidez"
  ) {
    const palavras = content.trim().split(/\s+/);
    if (palavras.length > 1) {
      isPunished = true;
      warning = "Você só pode enviar uma única palavra!";
    }

  // ===== REDIGIDO =====
  } else if (
    penaltyKey === "redigido"
  ) {
    const textPunished =
      (message.content || "")
        .split("")
        .map((char) => (char === " " ? " " : `||${char}||`))
        .join("") || "...";

    await sendModifiedMessage(message, textPunished);
    return false;

  // ===== SENTIDO INVERTIDO =====
  } else if (penaltyKey === "sentido_invertido") {
    let invertedText = message.content || "";
    invertedText = await invertMessage(invertedText);

    await sendModifiedMessage(message, invertedText);
    return false;

  // ===== SLOWMODE =====
  } else if (penaltyKey === "slowmode") {
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

        const remainingMs = SLOWMODE_COOLDOWN_MS - timeSinceLast;
        let remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

        warning = `⏳ Você está em **slowmode**! Aguarde **${remainingSeconds}** segundos antes de enviar outra mensagem.`;
    }
  } else if (penaltyKey === "irrelevancia") {
    isPunished = true;
    setTimeout(() => {
      message.delete().catch(() => {});
    }, ECO_DELETE_TIMEOUT_MS);
    return true;

  // ===== APENAS GIFS =====
  } else if (penaltyKey === "gif_only") {
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