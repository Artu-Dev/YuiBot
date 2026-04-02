import {
  addUserProperty,
  unlockAchievement,
  setUserProperty,
  getOrCreateUser,
  dbBot,
  getLastMessageAuthor,
} from "../database.js";
import { gerar_conquista } from "./image.js";
import { parseMessage } from "./utils.js";
import {readFileSync} from "fs"

const swearsFile = readFileSync("./data/negativas.txt", "utf-8");
const swearsList = swearsFile
  .split("\n")
  .map(word => word.trim().toLowerCase())
  .filter(word => word.length > 0);

const setPalavroes = new Set(swearsList); 

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

const handleMentions = async (message) => {
  if (!message.mentions.users.size) return;
  const {guildId, userId, displayName, mentions} = parseMessage(message)


  for (const mentionedId of mentions.users) {
    const mentionedUser = message.mentions.users.get(mentionedId);
    if (!mentionedUser) continue;

    const mentionedDisplayName =
      message.guild.members.cache.get(mentionedId)?.displayName ||
      mentionedUser.username;

    if (!mentionedUser.bot) {
      addUserProperty("mentions_sent", userId, guildId);
      const userStats = getOrCreateUser(
        userId,
        displayName,
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

const checkSwears = (text) => {
  if (text.length > 2) { 
    const tokens = text.toLowerCase().split(/[\s,.;!?]+/);
    
    let swearsCount = 0;
    
    for (const token of tokens) {
      if (setPalavroes.has(token)) {
        swearsCount++;
      }
    }

    return swearsCount;
  }
}

export const handleAchievements = async (message) => {
  const now = new Date();
  const {displayName, guildId, text, channelId, userId } = parseMessage(message)
  const lastAuthor = getLastMessageAuthor(channelId, guildId);

  let stats = getOrCreateUser(userId, displayName, guildId);
  const updates = {};

  // Night owl
  if (isNightOwlHour()) updates.night_owl_messages = true;

  // Stats gerais
  updates.messages_sent = 1;
  if (isOnlyCaps(text)) updates.caps_lock_messages = 1;
  if (isQuestionMessage(text)) updates.question_marks = 1;

  // BOM DIA (6h - 12h)
  if (now.getHours() >= 6 && now.getHours() < 12 && /bom dia/i.test(text))
    updates.morning_messages = 1;


  // MENSAGEM KKKKKKKKKKK
  if (/k{10,}/i.test(text)) updates.laught_messages = 1;

  // palavroes CONTADOR
  const swearsCount = checkSwears(text);
  if (swearsCount > 0) updates.swears_count = swearsCount;

  // PERGUNTA LONGA
  if (text.endsWith("?") && text.length >= 100) updates.long_questions = 1;

  // CAPS STREAK (controle temporário)
  if (!stats._caps_temp) stats._caps_temp = 0;
  if (/^[A-Z\s]+$/.test(text)) stats._caps_temp++;
  else stats._caps_temp = 0;
  setUserProperty("caps_streak", userId, guildId, stats._caps_temp);

  // MENSAGEM 03:33
  const date = new Date();
  if (date.getHours() === 3 && date.getMinutes() === 33)
    updates.specific_time_messages = 1;

  // E-GIRL / OTAKU
  if (/(uwu|owo|nya+)/i.test(text)) updates.otaku_messages = 1;

  // GRINGO FALSIFICADO
  if (/\b(bro|wtf|lmao|fr|literally)\b/i.test(text)) updates.gringo_messages = 1;

  // SUSPENSE (muitas reticências)
  if ((text.match(/\.\.\./g) || []).length >= 2) updates.suspense_messages = 1;

  // TEXTÃO DO ENEM
  if (text.length >= 600) updates.textao_messages = 1;

  // MONÓLOGO (falar sozinho)
  if (lastAuthor === userId) {
    if (!stats._monologo_temp) stats._monologo_temp = 1;
    stats._monologo_temp++;
  } else {
    stats._monologo_temp = 1;
  }
  setUserProperty("monologo_streak", userId, guildId, stats._monologo_temp);

  // Se for comando do bot
  if (message.content.startsWith(dbBot.data.configs.prefix))
    updates.bot_commands_used = 1;

  updateUserStats(userId, guildId, updates);
  stats = getOrCreateUser(userId, displayName, guildId);

  await handleMentions(message);

  // Checar achievements gerais
  await checkAllAchievements(message, userId, stats, message.author);

  // Ghost achievement (30 dias sem mensagem)

  const lastMessageTime = stats.last_message_time ?? now.getTime();
  const diffMs = now.getTime() - lastMessageTime;

  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays >= 30) {
    await giveAchievement(message, userId, "ghost", message.author);
  }
  
  const diffYears = diffDays / 365;
  if (diffYears >= 2) {
    await giveAchievement(
      message,
      userId,
      "reincarnation",
      message.author
    );
  }

  setUserProperty("last_message_time", userId, guildId, now.getTime());
};


export const achievements = {
  ghost: {
    id: 1,
    name: "Fantasma",
    charPoints: 800,
    emoji: "👻",
    description: "Ficou 30 dias sem mandar mensagem e voltou",
    check: () => false,
  },

  caps_addict: {
    id: 3,
    charPoints: 400,
    name: "VICIADO EM CAPS LOCK",
    emoji: "📢",
    description: "Mandou 50 mensagens gritando",
    check: (stats) => stats.caps_lock_messages >= 50,
  },

  night_owl: {
    id: 5,
    charPoints: 800,
    name: "Coruja Noturna",
    emoji: "🦉",
    description: "Mandou 100 mensagens na madrugada (2h-6h)",
    check: (stats) => stats.night_owl_messages >= 100,
  },

  popular: {
    id: 6,
    charPoints: 1000,
    name: "Popularzinho",
    emoji: "⭐",
    description: "Recebeu 200 menções",
    check: (stats) => stats.mentions_received >= 200,
  },

  stalker: {
    id: 7,
    charPoints: 600,
    name: "Stalker",
    emoji: "👀",
    description: "Mencionou os outros 300 vezes",
    check: (stats) => stats.mentions_sent >= 300,
  },

  question_everything: {
    id: 8,
    charPoints: 500,
    name: "O Curioso",
    emoji: "❓",
    description: "Fez 150 perguntas no chat",
    check: (stats) => stats.question_marks >= 150,
  },

  chatterbox: {
    id: 11,
    charPoints: 1200,
    name: "Tagarela",
    emoji: "💬",
    description: "Enviou 1.000 mensagens",
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
    charPoints: 100,
    name: "Bom Dia Grupo",
    emoji: "☀️",
    description: "Mandou um 'bom dia' igual idoso no zap",
    check: (stats) => stats.morning_messages >= 1,
  },

  monologo: {
    id: 14,
    charPoints: 250,
    name: "Esquizofrenia",
    emoji: "🗣️",
    description: "Mandou 5 mensagens seguidas falando sozinho",
    check: (stats) => stats.monologo_streak >= 5,
  },

  devil_message: {
    id: 15,
    charPoints: 1500,
    name: "O Capiroto",
    emoji: "😈",
    description: "Mandou mensagem exatamente às 03:33",
    check: (stats) => stats.specific_time_messages >= 1,
  },

  reincarnation: {
    id: 16,
    charPoints: 5000,
    name: "Reencarnação",
    emoji: "🧟‍♂️",
    description: "Voltou dos mortos depois de 1 ano offline",
    check: () => false, 
  },

  chat_legend: {
    id: 17,
    charPoints: 4000,
    name: "Toca na Grama",
    emoji: "🌱",
    description: "Enviou 10.000 mensagens (vai viver a vida)",
    check: (stats) => stats.messages_sent >= 10000,
  },

  urgency: {
    id: 18,
    charPoints: 100,
    name: "Calma Calabreso",
    emoji: "🚨",
    description: "Mandou 3 mensagens seguidas em CAPS LOCK",
    check: (stats) => stats.caps_streak >= 3,
  },

  philosopher: {
    id: 19,
    charPoints: 150,
    name: "Filósofo",
    emoji: "🧠",
    description: "Fez uma pergunta imensa (mais de 100 caracteres)",
    check: (stats) => stats.long_questions >= 1,
  },

  funny_today: {
    id: 20,
    charPoints: 50,
    name: "Tá Engrasado Hj",
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
    name: "Escravo de Bot",
    emoji: "🤖",
    description: "Usou 50 comandos meus",
    check: (stats) => stats.bot_commands_used >= 50,
  },

  otaku_fedido: {
    id: 23,
    charPoints: 200,
    name: "Otaku Fedido",
    emoji: "🌸",
    description: "Usou 'uwu', 'owo' ou 'nya' 10 vezes (tome banho)",
    check: (stats) => stats.otaku_messages >= 10,
  },

  gringo_falsificado: {
    id: 24,
    charPoints: 200,
    name: "Gringo do Paraguai",
    emoji: "🇺🇸",
    description: "Usou 20 gírias em inglês tipo 'bro', 'wtf' ou 'lmao'",
    check: (stats) => stats.gringo_messages >= 20,
  },

  misterioso: {
    id: 25,
    charPoints: 150,
    name: "Senhor Suspense",
    emoji: "🌫️",
    description: "Enviou 15 mensagens cheias de reticências...",
    check: (stats) => stats.suspense_messages >= 15,
  },

  textao_enem: {
    id: 26,
    charPoints: 300,
    name: "Redação do Enem",
    emoji: "📝",
    description: "Mandou um textão com mais de 600 caracteres",
    check: (stats) => stats.textao_messages >= 1,
  },
};