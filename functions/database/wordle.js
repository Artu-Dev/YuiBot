import Database from "better-sqlite3";
import { db } from "../../database.js";
import { log } from "../../bot.js";

const palavrasDb = new Database("./data/lexico.db", { readonly: true });

function loadWordle() {
  try {
    const respostas = palavrasDb.prepare("SELECT palavra FROM palavras_resposta").all()
      .map(r => String(r.palavra || "").trim().toUpperCase())
      .filter(w => w.length === 5);

    const validas = new Set(
      palavrasDb.prepare("SELECT palavra FROM palavras_validas").all()
        .map(r => String(r.palavra || "").trim().toUpperCase())
        .filter(w => w.length === 5)
    );

    if (respostas.length === 0 || validas.size === 0) throw new Error("Tabela vazia");

    log(`Wordle: ${respostas.length} respostas | ${validas.size} válidas`, "Database wordle", 32);
    return { respostas, validas };
  } catch (error) {
    const fallback = ["ABRIR","ACASO","AMIGO"];
    return { respostas: fallback, validas: new Set(fallback) };
  }
}

const { respostas: ANSWER_WORDS, validas: DICTIONARY } = loadWordle();
export { ANSWER_WORDS, DICTIONARY };

// ─── Wordle ───────────────────────────────────────────────────────────────────

export function getOrCreateDailyWord(guildId) {
  const today = todayString();
  const row = db.prepare(
    `SELECT word FROM wordle_daily WHERE guild_id = ? AND date = ?`
  ).get(guildId, today);

  if (row) return row.word;

  const yesterday = db.prepare(
    `SELECT word FROM wordle_history WHERE guild_id = ? ORDER BY id DESC LIMIT 1`
  ).get(guildId);

  let word;
  do {
    word = ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)];
  } while (word === yesterday?.word);

  db.prepare(
    `INSERT OR REPLACE INTO wordle_daily (guild_id, date, word) VALUES (?, ?, ?)`
  ).run(guildId, today, word);

  return word;
}

export function saveWordleResult({ guildId, word, won, attempts, playerIds }) {
  db.prepare(`
    INSERT INTO wordle_history (guild_id, date, word, won, attempts, players)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(guildId, todayString(), word, won ? 1 : 0, attempts, JSON.stringify(playerIds));
}

export function wordlePlayedToday(guildId) {
  const row = db.prepare(
    `SELECT id FROM wordle_history WHERE guild_id = ? AND date = ? LIMIT 1`
  ).get(guildId, todayString());
  return !!row;
}

export function updateWordleStats(userId, guildId, won) {
  if (won) {
    db.prepare(`
      UPDATE users SET
        wordle_wins        = wordle_wins + 1,
        wordle_streak      = wordle_streak + 1,
        wordle_best_streak = MAX(wordle_best_streak, wordle_streak + 1)
      WHERE id = ? AND guild_id = ?
    `).run(userId, guildId);
  } else {
    db.prepare(`
      UPDATE users SET
        wordle_losses = wordle_losses + 1,
        wordle_streak = 0
      WHERE id = ? AND guild_id = ?
    `).run(userId, guildId);
  }
}

// ─── Dueto ────────────────────────────────────────────────────────────────────

(function initDuetoDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dueto_daily (
      guild_id TEXT NOT NULL,
      date     TEXT NOT NULL,
      word1    TEXT NOT NULL,
      word2    TEXT NOT NULL,
      PRIMARY KEY (guild_id, date)
    );
    CREATE TABLE IF NOT EXISTS dueto_history (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      date     TEXT NOT NULL,
      word1    TEXT NOT NULL,
      word2    TEXT NOT NULL,
      won      INTEGER NOT NULL,
      attempts INTEGER NOT NULL,
      players  TEXT NOT NULL
    );
  `);
})();

export function getOrCreateDailyDueto(guildId) {
  const today = todayString();
  const row = db.prepare(
    `SELECT word1, word2 FROM dueto_daily WHERE guild_id = ? AND date = ?`
  ).get(guildId, today);

  if (row) return [row.word1, row.word2];

  let word1, word2;
  do {
    word1 = ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)];
    word2 = ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)];
  } while (word1 === word2);

  db.prepare(
    `INSERT OR REPLACE INTO dueto_daily (guild_id, date, word1, word2) VALUES (?, ?, ?, ?)`
  ).run(guildId, today, word1, word2);

  return [word1, word2];
}

export function duoPlayedToday(guildId) {
  const row = db.prepare(
    `SELECT id FROM dueto_history WHERE guild_id = ? AND date = ? LIMIT 1`
  ).get(guildId, todayString());
  return !!row;
}

export function saveDuoResult({ guildId, word1, word2, won, attempts, playerIds }) {
  db.prepare(`
    INSERT INTO dueto_history (guild_id, date, word1, word2, won, attempts, players)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(guildId, todayString(), word1, word2, won ? 1 : 0, attempts, JSON.stringify(playerIds));
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function todayString() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}