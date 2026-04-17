import { db } from "../../database.js";
import { isValidUserId, isValidGuildId } from "../../functions/validation.js";
import dayjs from "dayjs";

const DAILY_INTEREST_RATE = 0.01; 

export function depositToBank(userId, guildId, amount) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return false;
  if (amount <= 0) return false;

  try {
    const today = dayjs().format("YYYY-MM-DD");
    const user = db.prepare("SELECT bank_balance FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    const currentBalance = user?.bank_balance ?? 0;
    
    db.prepare("UPDATE users SET bank_balance = ?, last_bank_interest = ? WHERE id = ? AND guild_id = ?")
      .run(currentBalance + amount, today, userId, guildId);
    
    return true;
  } catch {
    return false;
  }
}

export function withdrawFromBank(userId, guildId, amount) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return false;
  if (amount <= 0) return false;

  try {
    const user = db.prepare("SELECT bank_balance FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    const currentBalance = user?.bank_balance ?? 0;
    
    if (currentBalance < amount) return false;
    
    const today = dayjs().format("YYYY-MM-DD");
    db.prepare("UPDATE users SET bank_balance = ?, last_bank_interest = ? WHERE id = ? AND guild_id = ?")
      .run(currentBalance - amount, today, userId, guildId);
    
    return true;
  } catch {
    return false;
  }
}

export function getBankBalance(userId, guildId) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return 0;
  const user = db.prepare("SELECT bank_balance FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
  return user?.bank_balance ?? 0;
}

export function applyDailyBankInterest(userId, guildId) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return false;

  try {
    const today = dayjs().format("YYYY-MM-DD");
    const user = db.prepare("SELECT bank_balance, last_bank_interest FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    
    if (!user || user.bank_balance <= 0) return false;
    
    const lastInterest = user.last_bank_interest ?? "";
    
    if (lastInterest === today) return false;
    
    const interest = Math.max(1, Math.floor(user.bank_balance * DAILY_INTEREST_RATE));
    const newBalance = user.bank_balance + interest;
    
    db.prepare("UPDATE users SET bank_balance = ?, last_bank_interest = ? WHERE id = ? AND guild_id = ?")
      .run(newBalance, today, userId, guildId);
    
    return interest;
  } catch {
    return false;
  }
}

export function getCreditInfo(userId, guildId) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return null;
  const user = db.prepare("SELECT credit_limit, credit_debt FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
  
  if (!user) return null;
  
  return {
    limit: user.credit_limit ?? 0,
    debt: user.credit_debt ?? 0,
    available: Math.max(0, (user.credit_limit ?? 0) - (user.credit_debt ?? 0)),
  };
}

export function addCreditDebt(userId, guildId, amount) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return false;
  if (amount <= 0) return false;

  try {
    const user = db.prepare("SELECT credit_limit, credit_debt FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!user) return false;

    const currentDebt = user.credit_debt ?? 0;
    const creditLimit = user.credit_limit ?? 0;
    
    if (currentDebt + amount > creditLimit) return false;
    
    db.prepare("UPDATE users SET credit_debt = credit_debt + ? WHERE id = ? AND guild_id = ?")
      .run(amount, userId, guildId);
    
    return true;
  } catch {
    return false;
  }
}

export function payCredit(userId, guildId, amount) {
  if (!isValidUserId(userId) || !isValidGuildId(guildId)) return false;
  if (amount <= 0) return false;

  try {
    const user = db.prepare("SELECT credit_debt FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!user) return false;

    const currentDebt = user.credit_debt ?? 0;
    const newDebt = Math.max(0, currentDebt - amount);
    
    db.prepare("UPDATE users SET credit_debt = ? WHERE id = ? AND guild_id = ?")
      .run(newDebt, userId, guildId);
    
    return true;
  } catch {
    return false;
  }
}
