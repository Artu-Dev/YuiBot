import { dbBot, reduceChars, setUserProperty, addChars, getRandomProhibitedWord, getServerConfig, getPoorestGuildUsers, addCharsBulk, removeUserPenality } from "../database.js";
import { parseMessage, safeReplyToMessage } from "./utils.js";
import { penalities, handlePenalities, randomWords } from "./penalties/penalities.js";
import { getCurrentDailyEvent } from "./getTodaysEvent.js";
import { getCharMultiplier, hasEffect } from "./effects.js";
import { sample } from "es-toolkit";
import dayjs from "dayjs";
import { log } from "../bot.js";

const GIF_URL_REGEX = /(https?:\/\/[^\s]+)/g;

const tierEmoji  = { green: "🟢", yellow: "🟡", red: "🔴" };
const getTier    = (v) => v > 1000 ? "green" : v > 500 ? "yellow" : "red";

export const limitChar = async (message, userData) => {
  if (!userData || typeof userData !== "object") return false;

  const { text, guildId, userId, displayName } = parseMessage(message);

  if (!getServerConfig(guildId, "charLimitEnabled")) return true;

  const hoje = dayjs().format("YYYY-MM-DD");

  let randomWordBanned = dbBot.data.configs.dailyWord;
  let lastUpdate = dbBot.data.configs.dailyWordDate;

  if (!randomWordBanned || lastUpdate !== hoje) {
    randomWordBanned = getRandomProhibitedWord();
    dbBot.data.configs.dailyWord = randomWordBanned;
    dbBot.data.configs.dailyWordDate = hoje;
    await dbBot.write();
  }

  if (randomWordBanned && text.toLowerCase().includes(randomWordBanned.toLowerCase())) {
    const poorestUsers = getPoorestGuildUsers(guildId, userId);
    const userChars = Math.max(0, Number(userData.charLeft) || 0);
    const budget = Math.min(500, userChars);
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
      await reduceChars(userId, guildId, totalDistributed, true);
      await safeReplyToMessage(message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}**\n**${totalDistributed}** dos seus caracteres foram redistribuídos para os mais pobres do servidor.`
      );
    } else if (poorestUsers.length === 0) {
      await safeReplyToMessage(message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}** — não tinha ninguém pra receber a redistribuição.`
      );
    } else {
      await safeReplyToMessage(message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}** — você não tem caracteres suficientes pra redistribuir.`
      );
    }
    return false;
  }

  const textWithoutUrls = text.replace(GIF_URL_REGEX, "").trim();
  let textSize = textWithoutUrls.length;

  const urls = text.match(GIF_URL_REGEX) || [];
  textSize += urls.length;

  if (message.attachments.size > 0) {
    const gifAttachments = message.attachments.filter((a) =>
      a.name?.toLowerCase().endsWith(".gif") || a.contentType?.includes("image/gif")
    );
    textSize += message.attachments.size - gifAttachments.size;
    if (gifAttachments.size > 0) textSize += 1;
  }

  const gifEmbeds = message.embeds.filter((embed) => {
    const url = (embed.url || embed.image?.url || embed.thumbnail?.url || embed.video?.url || "").toString();
    return ["image", "gifv", "video"].includes(embed.type) && GIF_URL_REGEX.test(url);
  });
  if (gifEmbeds.length > 0 && textSize === 0) textSize = 1;

  const event = await getCurrentDailyEvent(guildId);
  const eventMultiplier = event?.charMultiplier ?? 1.0;
  const effectsMultiplier = getCharMultiplier(userId, guildId);

  if (effectsMultiplier === 0 || eventMultiplier === 0) return true;

  textSize = Math.ceil(textSize * eventMultiplier * effectsMultiplier);

  const oldValue = Number(userData.charLeft) || 0;
  const newValue = await reduceChars(userId, guildId, textSize, true);
  userData.charLeft = newValue;

  if (getTier(newValue) !== getTier(oldValue)) {
    const emoji = tierEmoji[getTier(newValue)];
    if (emoji) {
      try {
        await message.react(emoji);
      } catch (error) {
        if (error.code !== 10008)
          log(`❌ Erro ao reagir na mensagem: ${error.message}`, "LimitChar", 31);
      }
    }
  }

  if (newValue <= 0 && hasEffect(userId, guildId, "credit_card_active") && !userData.penalty) {
    return true;
  }

  const wasPunished = await handlePenalities(message, userData);
  if (wasPunished) return false;

  if (newValue <= 0 && !userData.penalty) {
    const randomKey = sample(Object.keys(penalities));
    const randomPenality = penalities[randomKey];
    let randomWord = "";

    setUserProperty("penalty", userId, guildId, randomKey);

    if (randomKey === "palavra_obrigatoria") {
      randomWord = sample(randomWords);
      setUserProperty("penaltyWord", userId, guildId, randomWord);
    }

    await safeReplyToMessage(message,
      `!${displayName} seus caracteres acabaram! Você recebeu a penalidade: **${randomPenality.nome}**`
    );
    await message.channel.send(`${randomPenality.description} ${randomWord}`);

  } else if (userData.penaltySetByAdmin !== 1 && newValue > 0 && userData.penalty) {
    removeUserPenality(userId, guildId);
    setUserProperty("penaltyWord", userId, guildId, "");
    await safeReplyToMessage(message,
      `${displayName} seus caracteres voltaram ao positivo! como seu nome saiu do Serasa, Suas penalidades foram removidas.`
    );
  }

  return true;
};