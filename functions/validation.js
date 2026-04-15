import { log } from "../bot.js";

const DISCORD_ID_REGEX = /^\d{15,20}$/;

/**
 * Validates a Discord user ID
 * @param {string} userId - The user ID to validate
 * @returns {boolean} True if valid
 */
export const isValidUserId = (userId) => {
  return DISCORD_ID_REGEX.test(userId);
};

/**
 * Validates a Discord guild ID
 * @param {string} guildId - The guild ID to validate
 * @returns {boolean} True if valid
 */
export const isValidGuildId = (guildId) => {
  return DISCORD_ID_REGEX.test(guildId);
};

/**
 * Validates a Discord channel ID
 * @param {string} channelId - The channel ID to validate
 * @returns {boolean} True if valid
 */
export const isValidChannelId = (channelId) => {
  return DISCORD_ID_REGEX.test(channelId);
};

/**
 * Safely parses JSON with default fallback
 * @param {string} json - JSON string to parse
 * @param {*} defaultValue - Default value if parse fails
 * @returns {*} Parsed object or default value
 */
export const safeJsonParse = (json, defaultValue = null) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    log(`❌ Erro ao parsear JSON: ${error.message}`, "Validation", 31);
    return defaultValue;
  }
};

/**
 * Validates a configuration option value
 * @param {string} key - Config key
 * @param {*} value - Value to validate
 * @returns {*} Validated value or null if invalid
 */
export const validateConfigValue = (key, value) => {
  const validators = {
    prefix: (v) => typeof v === "string" && v.length > 0 && v.length <= 5,
    limitChar: (v) => typeof v === "number" && v > 0 && v <= 100000,
    speakMessage: (v) => typeof v === "boolean",
    generateMessage: (v) => typeof v === "boolean",
    maxSavedAudios: (v) => typeof v === "number" && v > 0 && v <= 1000,
  };

  const validator = validators[key];
  if (!validator) {
    log(`⚠️  Unknown config key: ${key}`, "Validation", 33);
    return null;
  }

  return validator(value) ? value : null;
};

/**
 * Validates character amount for transactions
 * @param {number} amount - Amount to validate
 * @param {number} available - Available amount
 * @returns {boolean} True if valid transaction
 */
export const isValidCharAmount = (amount, available = Infinity) => {
  return (
    typeof amount === "number" &&
    amount > 0 &&
    Number.isInteger(amount) &&
    amount <= available
  );
};
