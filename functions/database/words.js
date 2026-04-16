import Database from "better-sqlite3";
import { log } from "../../bot.js";

const palavrasDb = new Database("./data/palavras_proibidas.db", { readonly: true });

let prohibitedWordsCache = null;

function loadProhibitedWordsSet() {
  try {
    const rows = palavrasDb.prepare("SELECT palavra FROM palavras_proibidas").all();
    return new Set(
      rows
        .map((row) => String(row.palavra || "").trim().toLowerCase())
        .filter((word) => word.length > 0)
    );
  } catch (error) {
    log("erro ao carregar palavras proibidas", "Database", 31);
    return new Set(["capeta"]);
  }
}

export function getProhibitedWords() {
  if (!prohibitedWordsCache) {
    prohibitedWordsCache = loadProhibitedWordsSet();
  }
  return prohibitedWordsCache;
}

export function reloadProhibitedWords() {
  prohibitedWordsCache = loadProhibitedWordsSet();
  log("📚 Cache de palavras proibidas recarregado.", "Database", 33);
}

export function getRandomProhibitedWord() {
  const result = palavrasDb.prepare("SELECT palavra FROM palavras_proibidas ORDER BY RANDOM() LIMIT 1").get();
  return result ? result.palavra : "capeta";
}
