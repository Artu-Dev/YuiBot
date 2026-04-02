import { reduceChars, setUserProperty } from "../database.js";
import { getOrCreateWebhook } from "./utils.js";
import { invertMessage } from "./generateRes.js";

export const penalities = [
  { nome: "estrangeiro", description: "Voce agora nao pode usar vogais nas mensagens" },
  { nome: "palavra_obrigatoria", description: "Voce agora precisa terminar suas mensagens com: " },
  { nome: "eco", description: "suas mensagens serao apagadas em 5 segundos" },
  { nome: "screamer", description: "Voce agora só pode enviar mensagens em letras maiúsculas" },
  { nome: "poeta_binario", description: "Voce agora só pode enviar mensagens com uma única palavra" },
  { nome: "gago_digital", description: "Voce agora precisa repetir cada palavra duas vezes" },
  { nome: "redigido", description: "Todas as letras de suas mensagens agora sao spoilers!!" },
  { nome: "sentido_invertido", description: "Suas mensagens serão reescritas com o sentido invertido" },
];

export async function handlePenalities(message, userData) {
  const penalitiesList = JSON.parse(userData.penalities);
  if (!penalitiesList || penalitiesList.length === 0) return false;

  const content = message.content;
  let isPunished = false;
  let warning = "";

  const hasEco = penalitiesList.includes("eco");

  if (penalitiesList.includes("estrangeiro") && /[aeiou]/i.test(content)) {
    isPunished = true;
    warning = "Você não pode usar vogais!";
  } else if (penalitiesList.includes("palavra_obrigatoria")) {
    const required = userData.penalityWord || "";
    if (!content.endsWith(required)) {
      isPunished = true;
      warning = `Sua mensagem precisa terminar com: ${required}`;
    }
  } else if (penalitiesList.includes("screamer") && content !== content.toUpperCase()) {
    isPunished = true;
    warning = "Você só pode usar letras maiúsculas!";
  } else if (penalitiesList.includes("poeta_binario") || penalitiesList.includes("mudo")) {
    const palavras = content.trim().split(/\s+/);
    if (palavras.length > 1) {
      isPunished = true;
      warning = "Você só pode enviar uma única palavra!";
    }
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
  } else if (penalitiesList.includes("redigido")) {
    const myWebHook = await getOrCreateWebhook(message.channel, message.author);

    const textPunished =
      (message.content || "")
        .split("")
        .map((char) => (char === " " ? " " : `||${char}||`))
        .join("") || "...";

    await message.delete().catch(() => {});

    await myWebHook.send({
      content: textPunished,
      username: message.member?.displayName || message.author.username,
      avatarURL: message.author.displayAvatarURL(),
    });
    return false;
  } else if (penalitiesList.includes("sentido_invertido")) {
    const myWebHook = await getOrCreateWebhook(message.channel, message.author);

    let invertedText = message.content || "";
    try {
      invertedText = await invertMessage(invertedText);
    } catch (e) {
      console.error("Falha ao inverter mensagem:", e.message);
    }

    await message.delete().catch(() => {});

    await myWebHook.send({
      content: invertedText,
      username: message.member?.displayName || message.author.username,
      avatarURL: message.author.displayAvatarURL(),
    });
    return false;
  } else if (hasEco) {
    setTimeout(() => {
      message.delete().catch(() => {});
    }, 5000);
  }

  if (isPunished) {
    await message.delete().catch(() => {});
    const warningMessage = await message.channel.send(`<@${message.author.id}> ${warning}`);

    setTimeout(() => {
      warningMessage.delete().catch(() => {});
    }, 30000);
    return true;
  }

  return false;
}
