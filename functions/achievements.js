import {
  addUserProperty,
  unlockAchievement,
  setUserProperty,
  getOrCreateUser,
  dbBot,
  getLastMessageAuthor,
  getProhibitedWords,
  getServerConfig,
} from "../database.js";
import { gerar_conquista } from "./image.js";
import { parseMessage } from "./utils.js";
import { achievements, achievementsByUpdate } from "../functions/achievmentsData.js";

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
  
  const achievement = achievements.find(ach => ach.key === achievementKey);

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

const checkRelevantAchievements = async (message, userId, stats, authorUserObj, updates) => {
  const keysToCheck = new Set();
  
  for (const updateKey of Object.keys(updates)) {
    const relevant = achievementsByUpdate[updateKey] || [];
    relevant.forEach(key => keysToCheck.add(key));
  }
  
  for (const key of keysToCheck) {
    const achievement = achievements.find(ach => ach.key === key);
    if (achievement && achievement.check(stats)) {
      await giveAchievement(message, userId, key, authorUserObj);
    }
  }
};

const handleMentions = async (message, guildId, userId, displayName, stats) => {
  if (!message.mentions.users.size) return;
  const mentions = Array.from(message.mentions.users.keys());

  const stalkerAch = achievements.find((ach) => ach.key === "stalker");
  const popularAch = achievements.find((ach) => ach.key === "popular");

  for (const mentionedId of mentions) {
    const mentionedUser = message.mentions.users.get(mentionedId);
    if (!mentionedUser) continue;

    const mentionedDisplayName =
      message.guild.members.cache.get(mentionedId)?.displayName ||
      mentionedUser.username;

    if (!mentionedUser.bot) {
      addUserProperty("mentions_sent", userId, guildId);
      if (stalkerAch && stalkerAch.check(stats)) {
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
      if (popularAch && popularAch.check(mentionedStats)) {
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

  const lastMessages = getLastMessages(channelId, guildId, 5);
  const capsStreak = lastMessages.every(msg => msg.authorId === userId && /^[A-Z\s]+$/.test(msg.text)) ? lastMessages.length : 0;
  setUserProperty("caps_streak", userId, guildId, capsStreak);
  if (capsStreak >= 5) updates.caps_streak = true;

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

  if (message.content.startsWith(getServerConfig(message.guild?.id, 'prefix') || '$'))
    updates.bot_commands_used = 1;

  updateUserStats(userId, guildId, updates);
  stats = getOrCreateUser(userId, displayName, guildId);

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

export async function awardAchievementInCommand(client, data, achievementKey) {
  const achievement = achievements.find(ach => ach.key === achievementKey);
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
