import {
  addUserProperty,
  unlockAchievement,
  setUserProperty,
  getOrCreateUser,
  dbBot,
  getLastMessageAuthor,
  getProhibitedWords,
} from "../database.js";
import { gerar_conquista } from "./image.js";
import { parseMessage } from "./utils.js";

const setPalavroes = getProhibitedWords();

const isOnlyCaps = (text) => /^[A-Z\s]+$/.test(text);
const isQuestionMessage = (text) => text.endsWith("?");
const isNightOwlHour = () => {
  const hour = new Date().getHours();
  return hour >= 2 && hour < 6;
};

const updateUserStats = (userId, guildId, updates) => {
  for (const [prop, value] of Object.entries(updates)) {
    if (typeof value === "number") {
      addUserProperty(prop, userId, guildId, value);
    } else {
      addUserProperty(prop, userId, guildId);
    }
  }
};

export const giveAchievement = async (message, userId, achievementKey, authorUserObj) => {
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

const achievementsByUpdate = {
  night_owl_messages:   ["night_owl", "insone"],
  messages_sent:        ["chatterbox", "first_message", "chat_legend"],
  caps_lock_messages:   ["caps_addict"],
  question_marks:       ["question_everything"],
  morning_messages:     ["good_morning"],
  laught_messages:      ["funny_today"],
  swears_count:         ["dirty_mouth", "vocabulario_rico"],
  long_questions:       ["philosopher"],
  caps_streak:          ["urgency"],
  specific_time_messages: ["devil_message"],
  suspense_messages:    ["misterioso"],
  textao_messages:      ["textao_enem"],
  monologo_streak:      ["monologo"],
  bot_commands_used:    ["bot_addicted"],
  mentions_sent:        ["stalker"],
  mentions_received:    ["popular"],
};

const checkRelevantAchievements = async (message, userId, stats, authorUserObj, updates) => {
  const keysToCheck = new Set();
  
  for (const updateKey of Object.keys(updates)) {
    const relevant = achievementsByUpdate[updateKey] || [];
    relevant.forEach(key => keysToCheck.add(key));
  }
  
  for (const key of keysToCheck) {
    if (achievements[key] && achievements[key].check(stats)) {
      await giveAchievement(message, userId, key, authorUserObj);
    }
  }
};

const handleMentions = async (message, guildId, userId, displayName, stats) => {
  if (!message.mentions.users.size) return;
  const mentions = Array.from(message.mentions.users.keys());

  for (const mentionedId of mentions) {
    const mentionedUser = message.mentions.users.get(mentionedId);
    if (!mentionedUser) continue;

    const mentionedDisplayName =
      message.guild.members.cache.get(mentionedId)?.displayName ||
      mentionedUser.username;

    if (!mentionedUser.bot) {
      addUserProperty("mentions_sent", userId, guildId);
      if (achievements.stalker.check(stats)) {
        await giveAchievement(message, userId, "stalker", message.author);
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
        await giveAchievement(message, mentionedId, "popular", mentionedUser);
      }
    }
  }
};

const checkSwears = (text) => {
  if (text.length < 2) return 0;
  
  const tokens = text.toLowerCase().split(/[\s,.;!?]+/);
  let swearsCount = 0;
  for (const token of tokens) {
    if (token && setPalavroes.has(token)) swearsCount++;
  }
  return swearsCount;
};

export const handleAchievements = async (message) => {
  const now = new Date();
  const { displayName, guildId, text, channelId, userId } = parseMessage(message);

  let stats = getOrCreateUser(userId, displayName, guildId);
  const updates = {};

  if (isNightOwlHour()) updates.night_owl_messages = true;

  updates.messages_sent = 1;
  if (isOnlyCaps(text)) updates.caps_lock_messages = 1;
  if (isQuestionMessage(text)) updates.question_marks = 1;

  if (now.getHours() >= 6 && now.getHours() < 12 && /bom dia/i.test(text))
    updates.morning_messages = 1;

  if (/k{50,}/i.test(text)) updates.laught_messages = 1;

  const swearsCount = checkSwears(text);
  if (swearsCount > 0) updates.swears_count = swearsCount;

  if (text.endsWith("?") && text.length >= 100) updates.long_questions = 1;

  const prevCapsStreak = Number(stats.caps_streak) || 0;
  const newCapsStreak = /^[A-Z\s]+$/.test(text) ? prevCapsStreak + 1 : 0;
  setUserProperty("caps_streak", userId, guildId, newCapsStreak);
  updates.caps_streak = true;

  const date = new Date();
  if (date.getHours() === 3 && date.getMinutes() === 33)
    updates.specific_time_messages = 1;

  if ((text.match(/\.\.\./g) || []).length >= 2) updates.suspense_messages = 1;

  if (text.length >= 600) updates.textao_messages = 1;

  const previousAuthor = getLastMessageAuthor(channelId, guildId);
  const prevMonologo = Number(stats.monologo_streak) || 0;
  const newMonologoStreak =
    previousAuthor === userId ? prevMonologo + 1 : 1;
  setUserProperty("monologo_streak", userId, guildId, newMonologoStreak);
  updates.monologo_streak = true;

  if (message.content.startsWith(dbBot.data.configs.prefix))
    updates.bot_commands_used = 1;

  updateUserStats(userId, guildId, updates);
  stats.messages_sent = (stats.messages_sent || 0) + (updates.messages_sent || 0);
  stats.caps_lock_messages = (stats.caps_lock_messages || 0) + (updates.caps_lock_messages || 0);
  stats.question_marks = (stats.question_marks || 0) + (updates.question_marks || 0);
  stats.morning_messages = (stats.morning_messages || 0) + (updates.morning_messages || 0);
  stats.laught_messages = (stats.laught_messages || 0) + (updates.laught_messages || 0);
  stats.swears_count = (stats.swears_count || 0) + (updates.swears_count || 0);
  stats.long_questions = (stats.long_questions || 0) + (updates.long_questions || 0);
  stats.caps_streak = newCapsStreak;
  stats.specific_time_messages = (stats.specific_time_messages || 0) + (updates.specific_time_messages || 0);
  stats.suspense_messages = (stats.suspense_messages || 0) + (updates.suspense_messages || 0);
  stats.textao_messages = (stats.textao_messages || 0) + (updates.textao_messages || 0);
  stats.monologo_streak = newMonologoStreak;
  stats.bot_commands_used = (stats.bot_commands_used || 0) + (updates.bot_commands_used || 0);
  stats.night_owl_messages = (stats.night_owl_messages || 0) + (updates.night_owl_messages || 0);

  await handleMentions(message, guildId, userId, displayName, stats);
  
  await checkRelevantAchievements(message, userId, stats, message.author, updates);

  // Ghost achievement (30 dias sem mensagem)
  const lastMessageTime = stats.last_message_time
    ? Number(stats.last_message_time)
    : null;

  if (lastMessageTime) {
    const diffMs = now.getTime() - lastMessageTime;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 30) {
      await giveAchievement(message, userId, "ghost", message.author);
    }

    const diffYears = diffDays / 365;
    if (diffYears >= 2) {
      await giveAchievement(message, userId, "reincarnation", message.author);
    }
  }

  setUserProperty("last_message_time", userId, guildId, now.getTime());
};

export const achievements = {
  ghost: {
    id: 1,
    name: "Fantasma",
    charPoints: 5000,
    emoji: "👻",
    description: "30 dias sem mensagens e voltou",
    check: () => false,
  },

  caps_addict: {
    id: 3,
    charPoints: 800,
    name: "VICIADO EM CAPS LOCK",
    emoji: "📢",
    description: "50 mensagens gritando",
    check: (stats) => stats.caps_lock_messages >= 50,
  },

  night_owl: {
    id: 5,
    charPoints: 1000,
    name: "Coruja Noturna",
    emoji: "🦉",
    description: "Mandou 100 mensagens na madrugada (2h-6h)",
    check: (stats) => stats.night_owl_messages >= 100,
  },

  popular: {
    id: 6,
    charPoints: 2000,
    name: "Popularzinho",
    emoji: "⭐",
    description: "200 menções recebidas",
    check: (stats) => stats.mentions_received >= 200,
  },

  stalker: {
    id: 7,
    charPoints: 1500,
    name: "Stalker",
    emoji: "👀",
    description: "Mencionou os outros 300 vezes",
    check: (stats) => stats.mentions_sent >= 300,
  },

  question_everything: {
    id: 8,
    charPoints: 2000,
    name: "Curioso",
    emoji: "❓",
    description: "Fez 150 perguntas no chat",
    check: (stats) => stats.question_marks >= 150,
  },

  chatterbox: {
    id: 11,
    charPoints: 1850,
    name: "Tagarela",
    emoji: "💬",
    description: "1.000 mensagens enviadas",
    check: (stats) => stats.messages_sent >= 1000,
  },

  first_message: {
    id: 12,
    charPoints: 100,
    name: "Primeiro Passo",
    emoji: "👣",
    description: "Enviou sua primeira mensagem",
    check: (stats) => stats.messages_sent >= 1,
  },

  good_morning: {
    id: 13,
    charPoints: 400,
    name: "Acorda!!!",
    emoji: "☀️",
    description: "Mandou 'bom dia' no chat",
    check: (stats) => stats.morning_messages >= 1,
  },

  monologo: {
    id: 14,
    charPoints: 400,
    name: "Esquizofrenico",
    emoji: "🗣️",
    description: "10 mensagens seguidas falando sozinho",
    check: (stats) => stats.monologo_streak >= 10,
  },

  devil_message: {
    id: 15,
    charPoints: 1500,
    name: "DIABOLICO",
    emoji: "😈",
    description: "Mandou mensagem exatamente às 03:33",
    check: (stats) => stats.specific_time_messages >= 1,
  },

  reincarnation: {
    id: 16,
    charPoints: 50000,
    name: "Reencarnou",
    emoji: "🧟‍♂️",
    description: "Voltou depois de 1 ano sem mandar mensagem",
    check: () => false,
  },

  chat_legend: {
    id: 17,
    charPoints: 10000,
    name: "Inimigo da Vida Social",
    emoji: "🌱",
    description: "Enviou 10.000 mensagens",
    check: (stats) => stats.messages_sent >= 10000,
  },

  urgency: {
    id: 18,
    charPoints: 100,
    name: "Calma Calabreso",
    emoji: "🚨",
    description: "3 mensagens seguidas em CAPS",
    check: (stats) => stats.caps_streak >= 3,
  },

  philosopher: {
    id: 19,
    charPoints: 150,
    name: "Filósofo",
    emoji: "🧠",
    description: "Pergunta com mais de 100 caracteres",
    check: (stats) => stats.long_questions >= 1,
  },

  funny_today: {
    id: 20,
    charPoints: 200,
    name: "paliasso",
    emoji: "🤡",
    description: "Deu uma risada muito longa (kkkkkk)",
    check: (stats) => stats.laught_messages >= 1,
  },

  dirty_mouth: {
    id: 21,
    charPoints: 300,
    name: "Boca Suja",
    emoji: "🧼",
    description: "Falou palavrao 50 vezes",
    check: (stats) => stats.swears_count >= 50,
  },

  bot_addicted: {
    id: 22,
    charPoints: 400,
    name: "Entusiasta do Bot",
    emoji: "🤖",
    description: "50 comandos usados",
    check: (stats) => stats.bot_commands_used >= 50,
  },

  misterioso: {
    id: 25,
    charPoints: 150,
    name: "Misterioso",
    emoji: "🌫️",
    description: "15 Mensagens com reticências...",
    check: (stats) => stats.suspense_messages >= 15,
  },

  textao_enem: {
    id: 26,
    charPoints: 800,
    name: "Escritor maldito",
    emoji: "📝",
    description: "Mandou um textão com mais de 600 caracteres",
    check: (stats) => stats.textao_messages >= 1,
  },

  insone: {
    id: 27,
    charPoints: 1500,
    name: "Insonia PLUS",
    emoji: "🌑",
    description: "500 mensagens de madrugada (2h-6h).",
    check: (stats) => stats.night_owl_messages >= 500,
  },

  vocabulario_rico: {
    id: 28,
    charPoints: 1000,
    name: "Vocabulário Rico",
    emoji: "🤬",
    description: "200 palavrões ditos",
    check: (stats) => stats.swears_count >= 200,
  },

  dependente: {
    id: 29,
    charPoints: 700,
    name: "Ladrão profissional",
    emoji: "🔪",
    description: "Roubou 30 vezes no total.",
    check: (stats) => (stats.total_robberies || 0) >= 30,
  },

  apostador: {
    id: 30,
    charPoints: 500,
    name: "Apostador Ruim",
    emoji: "🎲",
    description: "Perdeu 6 roubos seguidos. Talento natural.",
    check: (stats) => (stats.consecutive_robbery_losses || 0) >= 6,
  },

  generoso: {
    id: 31,
    charPoints: 2500,
    name: "Filantropo",
    emoji: "🤲",
    description: "Doou 10.000 caracteres no total",
    check: (stats) => (stats.total_chars_donated || 0) >= 10000,
  },

  tigrinho_lenda: {
    id: 32,
    charPoints: 100,
    name: "CEO do tigrinho",
    emoji: "🎰",
    description: "Ganhou 2 jackpot's no tigre",
    check: (stats) => (stats.tiger_jackpots || 0) >= 2,
  },

  tigre_centuria: {
    id: 33,
    charPoints: 1500,
    name: "Viciado no Tigrinho",
    emoji: "🐯",
    description: "Jogou o tigre 100 vezes no total",
    check: (stats) => (stats.lifetime_tiger_spins || 0) >= 100,
  },
};

export async function awardAchievementInCommand(client, data, achievementKey) {
  const achievement = achievements[achievementKey];
  if (!achievement || typeof achievement.check !== "function") return;

  const stats = getOrCreateUser(data.userId, data.displayName, data.guildId);
  if (!achievement.check(stats)) return;

  const isNew = unlockAchievement(data.userId, data.guildId, achievementKey);
  if (!isNew) return;

  const userData = getOrCreateUser(data.userId, data.displayName, data.guildId);
  setUserProperty(
    "charLeft",
    data.userId,
    data.guildId,
    (userData.charLeft || 0) + achievement.charPoints
  );

  if (!data.channelId) return;
  const channel = await client.channels.fetch(data.channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;

  const size = achievement.description.length > 22 ? "small" : "normal";
  const authorLike = {
    displayName: data.displayName,
    username: data.username,
    displayAvatarURL: typeof data.avatarURL === "function" ? data.avatarURL : () => null,
  };

  const buffer = await gerar_conquista(authorLike, achievement, size);

  await channel.send({
    files: [{ attachment: buffer, name: "achievement.png" }],
  });
  await channel.send(
    `**${data.displayName}** ganhou **${achievement.charPoints}** caracteres como recompensa`
  );
}
