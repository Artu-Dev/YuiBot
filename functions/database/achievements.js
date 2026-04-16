import { db } from "../../database.js";
import { isValidUserId, isValidGuildId } from "../../functions/validation.js";

export function getAchievements(userId, guildId) {
  const row = db.queries.getAchievements.get(userId, guildId);
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.achievements_unlocked);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

export function unlockAchievement(userId, guildId, achievementKey) {
  return db.transaction(() => {
    const row = db.queries.getAchievements.get(userId, guildId);
    let current = {};
    if (row?.achievements_unlocked) {
      try {
        const parsed = JSON.parse(row.achievements_unlocked);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed;
        }
      } catch {}
    }
    if (current[achievementKey]) return false;
    current[achievementKey] = true;
    db.prepare("UPDATE users SET achievements_unlocked = ? WHERE id = ? AND guild_id = ?")
      .run(JSON.stringify(current), userId, guildId);
    return true;
  })();
}

export function resetAchievement(userId, guildId, achievementKey) {
  return db.transaction(() => {
    const row = db.queries.getAchievements.get(userId, guildId);
    let current = {};
    if (row?.achievements_unlocked) {
      try {
        const parsed = JSON.parse(row.achievements_unlocked);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed;
        }
      } catch {}
    }
    if (!current[achievementKey]) return false;
    delete current[achievementKey];
    db.prepare("UPDATE users SET achievements_unlocked = ? WHERE id = ? AND guild_id = ?")
      .run(JSON.stringify(current), userId, guildId);
    return true;
  })();
}
