import { reduceChars, setUserProperty } from "../database.js";
import { getOrCreateWebhook } from "./utils.js";
import { invertMessage } from "./generateRes.js";
import ms from 'ms';


export const randomWords = [
  "meu labubu", "papai", "meu xibiuzinho", "amor", "porra", "?",
  "pneumoultramicroscopicosilicovulcanoconiose", "capeta",
  "seu merda", "seu bosta", "caralho", "puta","desculpa",
];

export const penalities = [
  { nome: "estrangeiro",         description: "Voce agora nao pode usar vogais nas mensagens" },
  { nome: "palavra_obrigatoria", description: "Voce agora precisa terminar suas mensagens com: " },
  { nome: "eco",                 description: "suas mensagens serao apagadas em 5 segundos" },
  { nome: "screamer",            description: "Voce agora só pode enviar mensagens em letras maiúsculas" },
  { nome: "poeta_binario",       description: "Voce agora só pode enviar mensagens com uma única palavra" },
  { nome: "gago_digital",        description: "Voce agora precisa repetir cada palavra duas vezes" },
  { nome: "redigido",            description: "Todas as letras de suas mensagens agora sao spoilers!!" },
  { nome: "sentido_invertido",   description: "Suas mensagens serão reescritas com o sentido invertido" },
  { nome: "spoiler_maniac",      description: "Todas as letras de suas mensagens agora sao spoilers!!" },
  { nome: "mudo",                description: "Voce agora só pode enviar mensagens com uma única palavra" },


];

// ==================== CONSTANTES ====================
const INVERT_TIMEOUT_MS = ms('5s');
const WARNING_DELETE_TIMEOUT_MS = ms('30s');
const ECO_DELETE_TIMEOUT_MS = ms('5s');

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
    // Fallback: inverte palavras simples
    const simple = text.split(" ").reverse().join(" ");
    if (error.message !== "timeout") {
      console.error("Erro ao inverter mensagem:", error.message);
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

  const hasGifAttachment = message.attachments.some(a =>
    a.name?.toLowerCase().endsWith('.gif') || a.contentType?.includes('image/gif')
  );

  const hasGifLink = urls.some(hasGifKeyword);

  const hasGifEmbed = message.embeds.some(embed => {
    const embedUrl = (embed.url || embed.image?.url || embed.thumbnail?.url || embed.video?.url || "").toString();
    return (
      ['image', 'gifv', 'video'].includes(embed.type) &&
      hasGifKeyword(embedUrl)
    );
  });

  const hasGif = hasGifAttachment || hasGifLink || hasGifEmbed;
  const isGifOnly = hasGif && !hasNonUrlText;

  return isGifOnly;
}

function isAttachmentOnly(message) {
  const content = (message.content || "").trim();
  const hasAttachments = message.attachments.size > 0;
  return hasAttachments && content.length === 0;
}

export async function handlePenalities(message, userData) {
  // const isGifOnly = isGifOnlyMessage(message);
  const isAttachmentOnly = isAttachmentOnly(message);

  if (isAttachmentOnly) {
    return false;
  }

  if (Number(userData.charLeft) > 0) return false;

  const penalitiesList = JSON.parse(userData.penalities);
  if (!penalitiesList || penalitiesList.length === 0) return false;

  const content = message.content;
  let isPunished = false;
  let warning = "";

  // ===== ESTRANGEIRO: Não pode usar vogais =====
  if (penalitiesList.includes("estrangeiro") && /[aeiou]/i.test(content)) {
    isPunished = true;
    warning = "Você não pode usar vogais!";

  // ===== PALAVRA OBRIGATÓRIA: Deve terminar com palavra específica =====
  } else if (penalitiesList.includes("palavra_obrigatoria")) {
    const required = userData.penalityWord || "";
    if (!content.endsWith(required)) {
      isPunished = true;
      warning = `Sua mensagem precisa terminar com: ${required}`;
    }

  // ===== SCREAMER: Apenas letras maiúsculas =====
  } else if (
    penalitiesList.includes("screamer") &&
    content !== content.toUpperCase()
  ) {
    isPunished = true;
    warning = "Você só pode usar letras maiúsculas!";

  // ===== POETA BINÁRIO: Apenas uma palavra =====
  } else if (
    penalitiesList.includes("poeta_binario") ||
    penalitiesList.includes("mudo")
  ) {
    const palavras = content.trim().split(/\s+/);
    if (palavras.length > 1) {
      isPunished = true;
      warning = "Você só pode enviar uma única palavra!";
    }

  // ===== GAGO DIGITAL: Repetir cada palavra duas vezes =====
  } else if (penalitiesList.includes("gago_digital")) {
    const words = content.trim().split(/\s+/);
    let erroGago = false;
    for (let i = 0; i < words.length; i += 2) {
      if (!words[i + 1] || words[i] !== words[i + 1]) {
        erroGago = true;
        break;
      }
    }
    if (erroGago) {
      isPunished = true;
      warning = "Você precisa repetir cada palavra duas vezes!";
    }

  // ===== REDIGIDO: Tudo em spoilers =====
  } else if (
    penalitiesList.includes("spoiler_maniac") ||
    penalitiesList.includes("redigido")
  ) {
    const textPunished =
      (message.content || "")
        .split("")
        .map((char) => (char === " " ? " " : `||${char}||`))
        .join("") || "...";

    await sendModifiedMessage(message, textPunished);
    return false;

  // ===== SENTIDO INVERTIDO: Inverte a mensagem =====
  } else if (penalitiesList.includes("sentido_invertido")) {
    let invertedText = message.content || "";
    invertedText = await tryInvertMessage(invertedText);

    await sendModifiedMessage(message, invertedText);
    return false;

  // ===== ECO: Deleta mensagem após timeout =====
  } else if (penalitiesList.includes("eco")) {
    setTimeout(() => {
      message.delete().catch(() => {});
    }, ECO_DELETE_TIMEOUT_MS);
  }

  // Envia aviso se violou alguma regra
  if (isPunished) {
    await sendWarning(message, warning);
    return true;
  }

  return false;
}
