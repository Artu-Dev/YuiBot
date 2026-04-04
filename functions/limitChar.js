import { dbBot, db, reduceChars, setUserProperty, addChars } from "../database.js";
import { parseMessage, safeReplyToMessage } from "./utils.js";
import { readFileSync } from "fs";
import path from "path";
import { penalities, handlePenalities } from "./penalities.js";

const randomWords = [
  "meu labubu", "papai", "meu xibiu", "amor", "porra", "?",
  "pneumoultramicroscopicosilicovulcanoconiose", "capeta",
  "seu merda", "seu bosta", "caralho", "puta",
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

  if (randomWordBanned && text.toLowerCase().includes(randomWordBanned.toLowerCase())) {
    const poorestUsers = db.prepare(`
      SELECT id, charLeft, display_name 
      FROM users 
      WHERE guild_id = ? AND id != ? AND charLeft > 0 
      ORDER BY charLeft ASC 
      LIMIT 10
    `).all(guildId, userId);

    const poolCap = 500;
    const userChars = Math.max(0, Number(userData.charLeft) || 0);
    const budget = Math.min(poolCap, userChars);
    let totalDistributed = 0;

    if (poorestUsers.length > 0 && budget > 0) {
      const n = poorestUsers.length;
      const base = Math.floor(budget / n);
      let remainder = budget - base * n;

      for (let i = 0; i < n; i++) {
        const add = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        addChars(poorestUsers[i].id, guildId, add);
        totalDistributed += add;
      }

      reduceChars(userId, guildId, totalDistributed);

      await safeReplyToMessage(
        message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}**\n**${totalDistributed}** dos seus caracteres foram redistribuídos para quem tem menos saldo no servidor.`
      );
    } else if (poorestUsers.length === 0) {
      await safeReplyToMessage(
        message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}** — não tinha ninguém com saldo pra receber a redistribuição, então nada foi cobrado.`
      );
    } else {
      await safeReplyToMessage(
        message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}** — você tá sem caracteres pra redistribuir.`
      );
    }

    console.log(
      `[Palavra] ${displayName} acionou a palavra do dia. ${totalDistributed} chars redistribuídos ("${randomWordBanned}").`
    );
    return;
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

  const oldValue = Number(userData.charLeft) || 0;
  const newValue = reduceChars(userId, guildId, textSize);

  const getTier = (value) => {
    if (value > 1000) return "green";
    if (value > 500) return "yellow";
    return "red";
  };

  const tierEmoji = {
    green: "🟢",
    yellow: "🟡",
    red: "🔴",
  };

  const oldTier = getTier(oldValue);
  const newTier = getTier(newValue);

  if (newTier !== oldTier) {
    const emoji = tierEmoji[newTier];
    if (emoji) {
      try {
        await message.react(emoji);
      } catch (error) {
        if (error.code === 10008) {
          console.warn("Não foi possível reagir: mensagem foi deletada.");
        } else {
          console.error("Erro ao reagir na mensagem:", error);
        }
      }
    }
  }

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

      await safeReplyToMessage(
        message,
        `!${displayName} seus caracteres acabaram e voce recebeu a penalidade: ${randomPenality.nome}`
      );
      await safeReplyToMessage(message, `${randomPenality.description}${randomWord}`);

      setTimeout(() => {
        message.delete().catch(() => {});
      }, 5000);
    }
  } else {
    const penalitiesList = JSON.parse(userData.penalities);
    if (penalitiesList.length > 0) {
      setUserProperty("penalities", userId, guildId, JSON.stringify([]));
      setUserProperty("penalityWord", userId, guildId, "");
      await safeReplyToMessage(
        message,
        `${displayName} seus caracteres voltaram ao positivo! como seu nome saiu do Serasa, Suas penalidades foram removidas.`
      );
    }
  }
};