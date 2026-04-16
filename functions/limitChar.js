import { dbBot, reduceChars, setUserProperty, addChars, getRandomProhibitedWord, getServerConfig, getPoorestGuildUsers, addCharsBulk, removeUserPenality } from "../database.js";
import { parseMessage, safeReplyToMessage } from "./utils.js";
import { penalities, handlePenalities, randomWords } from "./penalties/penalities.js";
import { getCurrentDailyEvent } from "./getTodaysEvent.js";
import { getCharMultiplier } from "./effects.js";
import dayjs from "dayjs";
import { log } from "../bot.js";


const GIF_URL_REGEX = /(https?:\/\/[^\s]+)/g;

export const limitChar = async (message, userData) => {
  if (!userData || typeof userData !== "object") return false;

  const { text, guildId, userId, displayName } = parseMessage(message);

  if (!getServerConfig(guildId, "charLimitEnabled")) return true;

  const hoje = dayjs().format("YYYY-MM-DD");

  // ====================== PALAVRA DO DIA ======================
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
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}**\n**${totalDistributed}** dos seus caracteres foram redistribuídos para os mais pobres do servidor.`
      );
    } else if (poorestUsers.length === 0) {
      await safeReplyToMessage(
        message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}** — não tinha ninguém pra receber a redistribuição.`
      );
    } else {
      await safeReplyToMessage(
        message,
        `⚠️ **PALAVRA DO DIA!** Você disse: **${randomWordBanned}** — você não tem caracteres suficientes pra redistribuir.`
      );
    }
    return false;
  }

  const textWithoutUrls = text.replace(GIF_URL_REGEX, "").trim();
  let textSize = textWithoutUrls.length;

  // Anexos
  if (message.attachments.size > 0) {
    const gifAttachments = message.attachments.filter((a) =>
      a.name?.toLowerCase().endsWith(".gif") || a.contentType?.includes("image/gif")
    );
    const nonGifAttachments = message.attachments.size - gifAttachments.size;

    textSize += nonGifAttachments;
    if (gifAttachments.size > 0) textSize += 1;
  }

  const gifEmbeds = message.embeds.filter((embed) => {
    const embedUrl = (embed.url || embed.image?.url || embed.thumbnail?.url || embed.video?.url || "").toString();
    return ["image", "gifv", "video"].includes(embed.type) && GIF_URL_REGEX.test(embedUrl);
  });

  if (gifEmbeds.length > 0 && textSize === 0) {
    textSize = 1;
  }

  // ====================== EVENTO ======================
  const event = await getCurrentDailyEvent(guildId);
  const eventMultiplier = event?.charMultiplier ?? 1.0;

  // ====================== EFEITOS ======================
  const effectsMultiplier = getCharMultiplier(userId, guildId);

  if (effectsMultiplier === 0 || eventMultiplier === 0) return true;

  const charMultiplier = eventMultiplier * effectsMultiplier;

  textSize = Math.ceil(textSize * charMultiplier);

  const oldValue = Number(userData.charLeft) || 0;
  const newValue = reduceChars(userId, guildId, textSize);

  const getTier = (value) => (value > 1000 ? "green" : value > 500 ? "yellow" : "red");

  const tierEmoji = { green: "🟢", yellow: "🟡", red: "🔴" };

  if (getTier(newValue) !== getTier(oldValue)) {
    const emoji = tierEmoji[getTier(newValue)];
    if (emoji) {
      try {
        await message.react(emoji);
      } catch (error) {
        if (error.code !== 10008) {
          log(`❌ Erro ao reagir na mensagem: ${error.message}`, "LimitChar", 31);
        }
      }
    }
  }

  // ====================== PENALIDADES ======================
  const wasPunished = await handlePenalities(message, userData);
  if (wasPunished) return false;

  if (newValue <= 0 && !userData.penality ) {
    const randomPenality = penalities[Math.floor(Math.random() * penalities.length)];
    let randomWord = "";

    setUserProperty("penality", userId, guildId, randomPenality.nome);

    if (randomPenality.nome === "palavra_obrigatoria") {
      randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
      setUserProperty("penalityWord", userId, guildId, randomWord);
    }

    await safeReplyToMessage(
      message,
      `!${displayName} seus caracteres acabaram! Você recebeu a penalidade: **${randomPenality.nome}**`
    );
    await message.channel.send(`${randomPenality.description} ${randomWord}`);
  } else if (userData.penalitySetByAdmin !== 1 && newValue > 0 && userData.penality) {
    removeUserPenality(userId, guildId);
    setUserProperty("penalityWord", userId, guildId, "");
    await safeReplyToMessage(
      message,
      `${displayName} seus caracteres voltaram ao positivo! como seu nome saiu do Serasa, Suas penalidades foram removidas.`
    );
  }

  return true
};