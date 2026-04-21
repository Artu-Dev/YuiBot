import { db } from "../../database.js";
import { getUser } from "./users.js";
import { isValidUserId, isValidGuildId } from "../../functions/validation.js";
import { log } from "../../bot.js";

function logInvalidId(userId, guildId, functionName) {
  log(`[${guildId}] ⚠️  Invalid IDs in ${functionName}: userId=${userId}, guildId=${guildId}`, "Database", 31);
}

export const getUserPenality = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "getUserPenality");
    return null;
  }
  const user = getUser(userId, guildId);
  return user?.penalty || null;
};

export const setUserPenality = (userId, guildId, penalty, penaltySetByAdmin = false) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "setUserPenality");
    return false;
  }
  try {
    db.queries.addUserPenalty.run(penalty, penaltySetByAdmin ? 1 : 0, userId, guildId);
    return true;
  } catch (error) {
    log(`❌ Erro ao atualizar penalidade: ${error.message}`, "Database", 31);
    return false;
  }
};

export const removeUserPenality = (userId, guildId) => {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) {
    logInvalidId(userId, guildId, "removeUserPenality");
    return false;
  }
  try {
    db.queries.removeUserPenalty.run(userId, guildId);
    return true;
  } catch (error) {
    log(`❌ Erro ao remover penalidade: ${error.message}`, "Database", 31);
    return false;
  }
};
