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

// ==================== FUNÇÃO HELPER ====================
function normalizeAndFindPenalityKey(penalityInput) {
  if (!penalityInput) return null;
  
  // Se for exatamente uma chave válida, retorna
  if (penaltiesData[penalityInput]) return penalityInput;
  
  // Tenta encontrar pela descrição (nome formatado)
  const inputLower = penalityInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, data] of Object.entries(penaltiesData)) {
    const keyNorm = key.toLowerCase();
    const nameLower = data.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (keyNorm === inputLower || nameLower === inputLower) {
      return key;
    }
  }
  
  return null;
}

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

  const penality = userData.penality;
  const penalityKey = normalizeAndFindPenalityKey(penality);
  
  log(`🔍 Verificando penalidades - User: ${actualUserId}, Penality: ${penality}, PenalityKey: ${penalityKey}, CharLeft: ${userData.charLeft}, Content: "${message.content.substring(0, 50)}"`, "Penality", 33);
  
  if (Number(userData.charLeft) > 0 && userData.penalitySetByAdmin !== 1) {
    log(`⚠️ Caracteres positivos (${userData.charLeft}) e não é penalidade de admin. Ignorando.`, "Penality", 33);
    return false;
  }

  if (!penalityKey) {
    log(`⚠️ Sem penalidade definida ou penalidade inválida (${penality}).`, "Penality", 33);
    return false;
  }

  const content = message.content;
  let isPunished = false;
  let warning = "";

  // ===== HATER DE VOGAIS =====
  if (penalityKey === "hater_vogais" && /[aeiou]/i.test(content)) {
    isPunished = true;
    warning = "Você não pode usar vogais!";
    log(`❌ PENALIDADE ATIVADA: hater_vogais`, "Penality", 31);

  // ===== PALAVRA OBRIGATÓRIA =====
  } else if (penalityKey === "palavra_obrigatoria") {
    const required = userData.penalityWord || "";
    if (!content.endsWith(required)) {
      isPunished = true;
      warning = `Sua mensagem precisa terminar com: ${required}`;
      log(`❌ PENALIDADE ATIVADA: palavra_obrigatoria (faltava: ${required})`, "Penality", 31);
    }

  // ===== COMO DIMINUI A FONTE? =====
  } else if (
    penalityKey === "como_diminui_a_fonte" &&
    content !== content.toUpperCase()
  ) {
    isPunished = true;
    warning = "Você só pode usar MAIÚSCULAS!";
    log(`❌ PENALIDADE ATIVADA: como_diminui_a_fonte`, "Penality", 31);

  // ===== TIMIDEZ =====
  } else if (
    penalityKey === "timidez"
  ) {
    const palavras = content.trim().split(/\s+/);
    if (palavras.length > 1) {
      isPunished = true;
      warning = "Você só pode enviar uma única palavra!";
      log(`❌ PENALIDADE ATIVADA: timidez (${palavras.length} palavras)`, "Penality", 31);
    }

  // ===== REDIGIDO =====
  } else if (
    penalityKey === "redigido"
  ) {
    const textPunished =
      (message.content || "")
        .split("")
        .map((char) => (char === " " ? " " : `||${char}||`))
        .join("") || "...";

    await sendModifiedMessage(message, textPunished);
    log(`❌ PENALIDADE ATIVADA: redigido`, "Penality", 31);
    return false;

  // ===== SENTIDO INVERTIDO =====
  } else if (penalityKey === "sentido_invertido") {
    let invertedText = message.content || "";
    invertedText = await tryInvertMessage(invertedText);

    await sendModifiedMessage(message, invertedText);
    log(`❌ PENALIDADE ATIVADA: sentido_invertido`, "Penality", 31);
    return false;

  // ===== SLOWMODE =====
  } else if (penalityKey === "slowmode") {
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
        log(`❌ PENALIDADE ATIVADA: slowmode`, "Penality", 31);
    }
  // ===== IRRELEVÂNCIA =====
  } else if (penalityKey === "irrelevancia") {
    isPunished = true;
    setTimeout(() => {
      message.delete().catch(() => {});
    }, ECO_DELETE_TIMEOUT_MS);
    log(`❌ PENALIDADE ATIVADA: irrelevancia`, "Penality", 31);
    return true;

  // ===== APENAS GIFS =====
  } else if (penalityKey === "gif_only") {
    const isGifOnly = isGifOnlyMessage(message);
    if (!isGifOnly) {
      isPunished = true;
      warning = "Você só pode enviar GIFs! Nada de texto.";
      log(`❌ PENALIDADE ATIVADA: gif_only`, "Penality", 31);
    }
  }

  if (isPunished) {
    log(`✅ Enviando aviso: "${warning}"`, "Penality", 32);
    await sendWarning(message, warning);
    return true;
  }

  return false;
}