import { dbBot, reduceChars, setUserProperty } from "../database.js";
import { parseMessage, getOrCreateWebhook } from "./utils.js";
import { readFileSync } from "fs";
import path from "path";
import { invertMessage } from "./generateRes.js";


const penalities = [
  { nome: "estrangeiro", description: "Voce agora nao pode usar vogais nas mensagens" },
  { nome: "palavra_obrigatoria", description: "Voce agora precisa terminar suas mensagens com: " },
  { nome: "eco", description: "suas mensagens serao apagadas em 5 segundos" },
  { nome: "screamer", description: "Voce agora só pode enviar mensagens em letras maiúsculas" },
  { nome: "poeta_binario", description: "Voce agora só pode enviar mensagens com uma única palavra" },
  { nome: "gago_digital", description: "Voce agora precisa repetir cada palavra duas vezes" },
  { nome: "spoiler_maniac", description: "Todas suas mensagens agora sao spoilers!!" },
  { nome: "sentido_invertido", description: "Suas mensagens serão reescritas com o sentido invertido" },
];

const randomWords = [
  "labubu", "papai", "xibiu", "amor", "porra", "?",
  "pneumoultramicroscopicosilicovulcanoconiose", "capeta",
  "merda", "bosta", "caralho", "puta",
];

const palavrasPath = path.join("data", "negativas.txt");
const listaPalavras = readFileSync(palavrasPath, "utf-8")
  .split("\n")
  .filter((p) => p.trim() !== "");


export const limitChar = async (message, userData) => {
  const { text, guildId, userId, displayName } = parseMessage(message);
  if (!dbBot.data.configs.charLimitEnabled) return;

  const hoje = new Date().toISOString().split("T")[0];
  let randomWordBanned = dbBot.data.configs.dailyWord;
  let lastUpdate = dbBot.data.configs.dailyWordDate;

  if (!randomWordBanned || lastUpdate !== hoje) {
    randomWordBanned =
      listaPalavras[Math.floor(Math.random() * listaPalavras.length)] || "capeta";

    dbBot.data.configs.dailyWord = randomWordBanned;
    dbBot.data.configs.dailyWordDate = hoje;
    await dbBot.write();

    console.log(`Nova palavra proibida do dia definida: ${randomWordBanned}`);
  }

  let textSize = text.length;

  if (message.attachments.size > 0) {
    textSize += message.attachments.size;
  }

  const regexlink = /(https?:\/\/[^\s]+)/g;
  const links = text.match(regexlink);
  if (links) {
    textSize += links.length * 10;
  }

  if (text.toLowerCase().includes(randomWordBanned.toLowerCase())) {
    reduceChars(userId, guildId, 500);
    await message.reply("❌Palavra proibida!!! Você perdeu 500 caracteres!!!❌");
  }

  const newValue = reduceChars(userId, guildId, textSize);

  const wasPunished = await handlePenalities(message, userData);
  if (wasPunished) return;

  if (newValue <= 0 ) {
    const penalitiesList = JSON.parse(userData.penalities);
   
    if (penalitiesList.length === 0) {
      const randomPenality =
        penalities[Math.floor(Math.random() * penalities.length)];
      let randomWord = "";

      setUserProperty("penalities", userId, guildId, JSON.stringify([randomPenality.nome]));

      if (randomPenality.nome === "palavra_obrigatoria") {
        randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
        setUserProperty("penalityWord", userId, guildId, randomWord);
      }

      await message.reply(
        `!${displayName} seus caracteres acabaram e voce recebeu a penalidade: ${randomPenality.nome}`,
      );
      await message.reply(
        `${randomPenality.description}${randomWord}`,
      );

      setTimeout(() => {
        message.delete().catch(() => {});
      }, 5000);
    }
  } else {
    const penalitiesList = JSON.parse(userData.penalities);
    if (penalitiesList.length > 0) {
      setUserProperty("penalities", userId, guildId, JSON.stringify([]));
      setUserProperty("penalityWord", userId, guildId, "");
      await message.reply(`${displayName} seus caracteres voltaram ao positivo! como seu nome saiu do Serasa, Suas penalidades foram removidas.`);
    }
  }

  // if (newValue > 1000) message.react("🟢");
  // else if (newValue > 500) message.react("🟡");
  // else message.react("🔴");
};


async function handlePenalities(message, userData) {
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
  } else if (penalitiesList.includes("spoiler_maniac")) {
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