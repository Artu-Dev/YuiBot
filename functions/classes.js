import { user } from "@elevenlabs/elevenlabs-js/api/index.js";
import { reduceChars, setUserProperty } from "../database.js";
import { classesData } from "../data/classesData.js";

export const CLASSES = classesData;

export const CLASS_KEYS_ORDERED = Object.keys(CLASSES).sort((a, b) => {
  if (a === 'none') return -1;
  if (b === 'none') return 1;
  return CLASSES[a].unlockCost - CLASSES[b].unlockCost;
});

export function getClassModifier(userClass = "none", key) {
  if (!CLASSES[userClass]) return 0;
  return CLASSES[userClass]?.modifiers?.[key] || 0;
}

export function canUnlockClass(userData, className) {
  const targetClass = CLASSES[className];
  if (!targetClass) return false;
  if (userData.charLeft < targetClass.unlockCost) return false;
  return true;
}

export function unlockClass(userId, guildId, className) {
  const targetClass = CLASSES[className];
  if (!targetClass) return false;
  reduceChars(userId, guildId, targetClass.unlockCost);
  setUserProperty('user_class', userId, guildId, className);
  return true;
}

export function applyClassModifier(baseValue, modifierType, userClass) {
  const mod = getClassModifier(userClass, modifierType);
  const multiplier = 1 + mod;

  if (modifierType === "robCost") {
    return Math.max(0, Math.round(baseValue * multiplier));
  }

  return Math.max(0, baseValue * multiplier);
}

export function formatModifier(value) {
  const percent = Math.round(value * 100);
  return value >= 0 ? `+${percent}%` : `${percent}%`;
}