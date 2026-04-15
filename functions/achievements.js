import {
  addUserProperty,
  addUserPropertyByAmount,
  setUserProperty,
  unlockAchievement,
  getOrCreateUser,
  getPreviousMessageAuthor,
  getProhibitedWords,
  getServerConfig,
  getRecentMessagesArray,
} from "../database.js";

import { gerar_conquista } from "./image.js";
import { parseMessage } from "./utils.js";
import { achievements, achievementsByUpdate } from "../functions/achievmentsData.js";
import { log } from "../bot.js";

const setPalavroes = getProhibitedWords();

const isOnlyCaps = (text) => /^[A-Z\s]+$/.test(text);
const isQuestionMessage = (text) => text.endsWith("?");
const isNightOwlHour = () => {
  const hour = new Date().getHours();
  return hour >= 2 && hour < 6;
};

// ====================== FUNÇÃO CORRIGIDA ======================
const updateUserStats = (userId, guildId, updates) => {
  for (const [prop, value] of Object.entries(updates)) {
    if (typeof value === "number" && value > 0) {
      addUserProperty(prop, userId, guildId, value);
    } else if (value === true || value === 1) {
      addUserProperty(prop, userId, guildId);
    }
  }
};

export const giveAchievement = async (message, userId, achievementKey, authorUserObj) => {
  const guildId = message.guild.id;
  const achievement = achievements[achievementKey];

  if (!achievement) {
    log(`❌ Achievement com chave ${achievementKey} não encontrado.`, "Achievements", 31);
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
    relevant.forEach((key) => keysToCheck.add(key));
  }

  for (const key of keysToCheck) {
    const achievement = achievements[key];
    if (achievement && achievement.check(stats)) {
      await giveAchievement(message, userId, key, authorUserObj);
    }
  }
};

const handleMentions = async (message, guildId, userId, displayName, stats) => {
  if (!message.mentions.users.size) return;

  const stalkerAch = achievements["stalker"];
  const popularAch = achievements["popular"];

  for (const mentionedId of message.mentions.users.keys()) {
    if (mentionedId === userId) continue;

    const mentionedUser = message.mentions.users.get(mentionedId);
    if (!mentionedUser || mentionedUser.bot) continue;

    const mentionedMember = message.guild.members.cache.get(mentionedId);
    const mentionedDisplayName =
      mentionedMember?.displayName || mentionedUser.globalName || mentionedUser.username;

    addUserProperty("mentions_sent", userId, guildId);

    if (stalkerAch && stalkerAch.check(stats)) {
      await giveAchievement(message, userId, "stalker", message.author);
    }

    addUserProperty("mentions_received", mentionedId, guildId);

    const mentionedStats = getOrCreateUser(mentionedId, mentionedDisplayName, guildId);

    if (popularAch && popularAch.check(mentionedStats)) {
      await giveAchievement(message, mentionedId, "popular", mentionedUser);
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

  let user = getOrCreateUser(userId, displayName, guildId);
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

  if ((text.match(/\.\.\./g) || []).length >= 2) updates.suspense_messages = 1;
  if (text.length >= 600) updates.textao_messages = 1;

  if (now.getHours() === 3 && now.getMinutes() === 33) updates.specific_time_messages = 1;

  if (message.content.startsWith(getServerConfig(message.guild?.id, "prefix") || "$"))
    updates.bot_commands_used = 1;

  const lastMessages = getRecentMessagesArray(channelId, guildId, 5);

  const capStreak =
    lastMessages.length > 0 &&
    lastMessages.every((msg) => msg.author === displayName && isOnlyCaps(msg.content))
      ? lastMessages.length
      : 0;

  setUserProperty("caps_streak", userId, guildId, capStreak);
  if (capStreak >= 5) updates.caps_streak = true;

  const previousAuthor = getPreviousMessageAuthor(channelId, guildId);
  const prevMonologo = Number(user.monologo_streak) || 0;
  const newMonologoStreak = previousAuthor === userId ? prevMonologo + 1 : 1;

  setUserProperty("monologo_streak", userId, guildId, newMonologoStreak);
  if (newMonologoStreak >= 3) updates.monologo_streak = true; 

  updateUserStats(userId, guildId, updates);

  user = getOrCreateUser(userId, displayName, guildId);

  await handleMentions(message, guildId, userId, displayName, user);
  await checkRelevantAchievements(message, userId, user, message.author, updates);

  // === Ghost / Reincarnation ===
  const lastMessageTime = user.last_message_time ? Number(user.last_message_time) : null;
  if (lastMessageTime) {
    const diffMs = now.getTime() - lastMessageTime;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 30) await giveAchievement(message, userId, "ghost", message.author);
    if (diffDays / 365 >= 2) await giveAchievement(message, userId, "reincarnation", message.author);
  }

  setUserProperty("last_message_time", userId, guildId, now.getTime());
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