import {
  addUserProperty,
  unlockAchievement,
  setUserProperty,
  getOrCreateUser,
  dbBot,
} from "../database.js";

import { gerar_conquista } from "./image.js";

const isOnlyCaps = (text) => /^[A-Z\s]+$/.test(text);
const isQuestionMessage = (text) => text.endsWith("?");
const isNightOwlHour = () => {
  const hour = new Date().getHours();
  return hour >= 2 && hour < 6;
};

const updateUserStats = (userId, guildId, updates) => {
  for (const [prop] of Object.entries(updates)) {
    addUserProperty(prop, userId, guildId);
  }
};

const giveAchievement = async (message, userId, achievementKey, authorUserObj) => {
  const guildId = message.guild.id;
  const achievement = achievements[achievementKey];

  if (!achievement) {
    console.error(`Achievement com chave ${achievementKey} não encontrado.`);
    return;
  }

  const isNew = unlockAchievement(userId, guildId, achievementKey);
  if (!isNew) return;

  const size = achievement.description.length > 22 ? "small" : "normal";
  const userData = getOrCreateUser(userId, authorUserObj.displayName, guildId);
  setUserProperty(
    "charLeft",
    userId,
    guildId,
    (userData.charLeft || 0) + achievement.charPoints
  );

  const buffer = await gerar_conquista(authorUserObj, achievement, size);

  await message.channel.send({
    files: [{ attachment: buffer, name: "achievement.png" }],
  });
  await message.channel.send(
    `**${authorUserObj.displayName}** ganhou **${achievement.charPoints}** caracteres como recompensa`
  );
};

const checkAllAchievements = async (message, userId, stats, authorUserObj) => {
  for (const [key, ach] of Object.entries(achievements)) {
    if (ach.check(stats)) {
      await giveAchievement(message, userId, key, authorUserObj);
    }
  }
};

const handleMentions = async (message, userId) => {
  if (!message.mentions.users.size) return;

  const guildId = message.guild.id;

  for (const [mentionedId, mentionedUser] of message.mentions.users) {
    const mentionedDisplayName =
      message.guild.members.cache.get(mentionedId)?.displayName ||
      mentionedUser.username;

    if (!mentionedUser.bot) {
      addUserProperty("mentions_sent", userId, guildId);
      const userStats = getOrCreateUser(
        userId,
        message.author.displayName,
        guildId
      );
      if (achievements.stalker.check(userStats)) {
        await giveAchievement(
          message,
          userId,
          "stalker",
          message.author
        );
      }
    }

    if (mentionedId !== userId) {
      addUserProperty("mentions_received", mentionedId, guildId);
      const mentionedStats = getOrCreateUser(
        mentionedId,
        mentionedDisplayName,
        guildId
      );
      if (achievements.popular.check(mentionedStats)) {
        await giveAchievement(
          message,
          mentionedId,
          "popular",
          mentionedUser
        );
      }
    }
  }
};

export const handleAchievements = async (message) => {
  const userId = message.author.id;
  const channelId = message.channel.id;
  const content = message.content?.trim() || "";
  const now = Date.now();
  const guildId = message.guild?.id;
  const displayName = message.member?.displayName || message.author.username;

  let stats = getOrCreateUser(userId, displayName, guildId);
  const updates = {};

  // Night owl
  if (isNightOwlHour()) updates.night_owl_messages = true;

  // Stats gerais
  updates.messages_sent = 1;
  if (isOnlyCaps(content)) updates.caps_lock_messages = 1;
  if (isQuestionMessage(content)) updates.question_marks = 1;

  // BOM DIA
  if (/bom dia/i.test(content)) updates.morning_messages = 1;

  // MENSAGEM KKKKKKKKKKK
  if (/k{10,}/i.test(content)) updates.laught_messages = 1;

  // "PORRA" CONTADOR
  const porraCount = (content.match(/porra/gi) || []).length;
  if (porraCount > 0) updates.porra_count = porraCount;

  // PERGUNTA LONGA
  if (content.endsWith("?") && content.length >= 100)
    updates.long_questions = 1;

  // CAPS STREAK (controle temporário)
  if (!stats._caps_temp) stats._caps_temp = 0;
  if (/^[A-Z\s]+$/.test(content)) stats._caps_temp++;
  else stats._caps_temp = 0;
  setUserProperty("caps_streak", userId, guildId, stats._caps_temp);

  // MENSAGEM 03:33
  const date = new Date();
  if (date.getHours() === 3 && date.getMinutes() === 33)
    updates.specific_time_messages = 1;

  // MENSAGENS IGNORADAS (se ninguém respondeu)
  if (!message.reference) updates.messages_without_reply = 1;
  else setUserProperty("messages_without_reply", userId, guildId, 0);

  // Se for comando do bot
  if (message.content.startsWith(dbBot.data.configs.prefix))
    updates.bot_commands_used = 1;

  updateUserStats(userId, guildId, updates);
  stats = getOrCreateUser(userId, displayName, guildId);

  await handleMentions(message, userId);

  // Checar achievements gerais
  await checkAllAchievements(message, userId, stats, message.author);

  // Ghost achievement (30 dias sem mensagem)
  const diffDays =
    (now - (stats.last_message_time ?? now)) / (1000 * 60 * 60 * 24);
  if (diffDays >= 30)
    await giveAchievement(message, userId, "ghost", message.author);
  const diffYears = diffDays / 365;
  if (diffYears >= 2)
    await giveAchievement(
      message,
      userId,
      "reincarnation",
      message.author
    );

  setUserProperty("last_message_time", userId, guildId, now);
};

export const achievements = {
  ghost: {
    id: 1,
    name: "Fantasma",
    charPoints: 5000,
    emoji: "👻",
    description: "Ficou 30 dias sem mandar mensagem",
    check: () => false,
  },

  caps_addict: {
    id: 3,
    charPoints: 600,
    name: "VICIADO EM CAPS LOCK",
    emoji: "📢",
    description: "Mandou 50 mensagens em CAPS LOCK",
    check: (stats) => stats.caps_lock_messages >= 50,
  },

  night_owl: {
    id: 5,
    charPoints: 1500,
    name: "Coruja Noturna",
    emoji: "🦉",
    description: "Mandou 100 mensagens entre 2h e 6h da manhã",
    check: (stats) => stats.night_owl_messages >= 100,
  },

  popular: {
    id: 6,
    charPoints: 2000,
    name: "Popular",
    emoji: "⭐",
    description: "Recebeu 200 menções",
    check: (stats) => stats.mentions_received >= 200,
  },

  stalker: {
    id: 7,
    charPoints: 1500,
    name: "Stalker",
    emoji: "👀",
    description: "Mencionou outras pessoas 300 vezes",
    check: (stats) => stats.mentions_sent >= 300,
  },

  question_everything: {
    id: 8,
    charPoints: 1500,
    name: "Questiona Tudo",
    emoji: "❓",
    description: "Fez 150 perguntas",
    check: (stats) => stats.question_marks >= 150,
  },

  chatterbox: {
    id: 11,
    charPoints: 2000,
    name: "Tagarela",
    emoji: "💬",
    description: "Enviou 1000 mensagens",
    check: (stats) => stats.messages_sent >= 1000,
  },
  first_message: {
    id: 12,
    charPoints: 300,
    name: "Primeiro Passo",
    emoji: "👣",
    description: "Enviou sua primeira mensagem",
    check: (stats) => stats.messages_sent >= 1,
  },

  good_morning: {
    id: 13,
    charPoints: 700,
    name: "Bom Dia Grupo",
    emoji: "☀️",
    description: "Mandou uma mensagem com 'bom dia'",
    check: (stats) => stats.morning_messages >= 1,
  },

  ignored: {
    id: 14,
    charPoints: 2000,
    name: "De Olho",
    emoji: "👁️",
    description: "Enviou 10 mensagens seguidas sem ninguém responder",
    check: (stats) => stats.messages_without_reply >= 10,
  },

  devil_message: {
    id: 15,
    charPoints: 3000,
    name: "Mensagem Maligna",
    emoji: "😈",
    description: "Enviou uma mensagem exatamente às 03:33",
    check: (stats) => stats.specific_time_messages >= 1,
  },

  reincarnation: {
    id: 16,
    charPoints: 15000,
    name: "Reencarnação",
    emoji: "🔄",
    description: "Voltou depois de 2 meses sem mandar mensagem",
    check: () => false,
  },

  chat_legend: {
    id: 17,
    charPoints: 10000,
    name: "Cara do Chat",
    emoji: "💎",
    description: "Enviou 10.000 mensagens",
    check: (stats) => stats.messages_sent >= 10000,
  },

  urgency: {
    id: 18,
    charPoints: 800,
    name: "URGENCIA",
    emoji: "🚨",
    description: "Mandou 3 mensagens seguidas em CAPS LOCK",
    check: (stats) => stats.caps_streak >= 3,
  },

  philosopher: {
    id: 19,
    charPoints: 1200,
    name: "Filosofão",
    emoji: "🧠",
    description: "Fez uma pergunta com mais de 100 caracteres",
    check: (stats) => stats.long_questions >= 1,
  },

  funny_today: {
    id: 20,
    charPoints: 500,
    name: "ta engrasado hj",
    emoji: "😂",
    description: "Digitou 'kkkkkkkkkkk'",
    check: (stats) => stats.laught_messages >= 1,
  },

  porra_mouth: {
    id: 21,
    charPoints: 1500,
    name: "Porra na boca",
    emoji: "💢",
    description: "Falou 'porra' 50 vezes",
    check: (stats) => stats.porra_count >= 50,
  },

  bot_addicted: {
    id: 22,
    charPoints: 3000,
    name: "Viciado no Bot",
    emoji: "🤖",
    description: "Usou 50 comandos do bot",
    check: (stats) => stats.bot_commands_used >= 50,
  },
};
