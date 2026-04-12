import { dbBot, db, reduceChars, setUserProperty, addChars, getRandomProhibitedWord, getServerConfig, getGuildUsers, getPoorestGuildUsers, addCharsBulk, removeUserPenality } from "../database.js";
import { parseMessage, safeReplyToMessage } from "./utils.js";
import { penalities, handlePenalities, randomWords } from "./penalities.js";
import { getTodaysEvent } from "./getTodaysEvent.js";
import dayjs from "dayjs"
import { user } from "@elevenlabs/elevenlabs-js/api/index.js";


let MULTIPLIER_CHARS = 1.0;

export const limitChar = async (message, userData) => {
  if (!userData || typeof userData !== "object") {
    console.warn("limitChar: usuário ausente (getOrCreateUser falhou?); ignorando limite.");
    return;
  }

  const { text, guildId, userId, displayName } = parseMessage(message);
  if (!getServerConfig(message.guildId, 'charLimitEnabled')) return;


  const hoje = dayjs().format("YYYY-MM-DD");
  
  let randomWordBanned = dbBot.data.configs.dailyWord;
  let lastUpdate = dbBot.data.configs.dailyWordDate;

  if (!randomWordBanned || lastUpdate !== hoje) {
    randomWordBanned = getRandomProhibitedWord();

    dbBot.data.configs.dailyWord = randomWordBanned;
    dbBot.data.configs.dailyWordDate = hoje;
    await dbBot.write();
  }

  if (
    randomWordBanned &&
    text.toLowerCase().includes(randomWordBanned.toLowerCase())
  ) {
    const poorestUsers = getPoorestGuildUsers(guildId, userId);

    const poolCap = 500;
    const userChars = Math.max(0, Number(userData.charLeft) || 0);
    const budget = Math.min(poolCap, userChars);
    let totalDistributed = 0;

    if (poorestUsers.length > 0 && budget > 0) {
      const n = poorestUsers.length;
      const base = Math.floor(budget / n);
      let remainder = budget - base * n;

      const updates = poorestUsers.map((user) => {
        const amount = base + (remainder-- > 0 ? 1 : 0);
        totalDistributed += amount;
        return { userId: user.id, guildId, amount };
      });

      addCharsBulk(updates);
      reduceChars(userId, guildId, totalDistributed);

      await safeReplyToMessage(
        message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}**\n**${totalDistributed}** dos seus caracteres foram redistribuídos para quem tem menos saldo no servidor.`,
      );
    } else if (poorestUsers.length === 0) {
      await safeReplyToMessage(
        message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}** — não tinha ninguém com saldo pra receber a redistribuição, então nada foi cobrado.`,
      );
    } else {
      await safeReplyToMessage(
        message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}** — você tá sem caracteres pra redistribuir.`,
      );
    }

    return;
  }

  if ((userData.lastDailyBonus || "") !== hoje) {
    addChars(userId, guildId, 25);
    setUserProperty("lastDailyBonus", userId, guildId, hoje);
    try {
      await message.react("➕");
    } catch (err) {
      if (err.code !== 10008) console.error("Erro ao reagir (bônus diário):", err);
    }
  }

  const GIF_URL_REGEX = /(https?:\/\/[^\s]+)/g;
  const textWithoutUrls = text.replace(GIF_URL_REGEX, "").trim();

  let textSize = textWithoutUrls.length;

  if (message.attachments.size > 0) {
    const gifAttachments = message.attachments.filter(a =>
      a.name?.toLowerCase().endsWith('.gif') || a.contentType?.includes('image/gif')
    );
    const nonGifAttachments = message.attachments.size - gifAttachments.size;
    textSize += nonGifAttachments;
    if (gifAttachments.size > 0) textSize += 1; 
  }


  const gifEmbeds = message.embeds.filter((embed) => {
    const embedUrl = (embed.url || embed.image?.url || embed.thumbnail?.url || embed.video?.url || "").toString();
    return ['image', 'gifv', 'video'].includes(embed.type) && GIF_DETECT_REGEX.test(embedUrl);
  });

  if (gifEmbeds.length > 0 && textSize === 0) {
    textSize = 1;
  }

  const event = await getTodaysEvent(message.guildId);

  MULTIPLIER_CHARS = event && event.charMultiplier ? event.charMultiplier : 1.0;

  textSize = Math.ceil(textSize * MULTIPLIER_CHARS);  
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
  

  if (event && event.charMultiplier && event.charMultiplier === 0.0) return;

  const wasPunished = await handlePenalities(message, userData);
  if (wasPunished) return;

  if (newValue <= 0) {   
    if (!userData.penality) {
      const randomPenality = penalities[Math.floor(Math.random() * penalities.length)];
      let randomWord = "";

      setUserProperty("penality", userId, guildId, randomPenality.nome);

      if (randomPenality.nome === "palavra_obrigatoria") {
        randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
        setUserProperty("penalityWord", userId, guildId, randomWord);
      }

      await safeReplyToMessage(
        message,
        `!${displayName} seus caracteres acabaram e voce recebeu a penalidade: ${randomPenality.nome}`
      );
      await message.channel.send(`${randomPenality.description}${randomWord}`);
    }
  } else {
    if (userData.penality && userData.penalitySetByAdmin !== "1") {
      removeUserPenality(userId, guildId);
      setUserProperty("penalityWord", userId, guildId, "");
      await safeReplyToMessage(
        message,
        `${displayName} seus caracteres voltaram ao positivo! como seu nome saiu do Serasa, Suas penalidades foram removidas.`
      );
    }
  }
};