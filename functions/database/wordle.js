import Database from "better-sqlite3";
import {db} from "../../database.js";
import { log } from "../../bot.js";

const palavrasDb = new Database("./data/lexico.db", { readonly: true });

function loadWordleDictionary() {
  try {
    const rows = palavrasDb.prepare("SELECT palavra FROM palavras_wordle").all();
    const set = new Set(
      rows
        .map((row) => String(row.palavra || "").trim().toUpperCase())
        .filter((word) => word.length === 5)
    );
    if (set.size > 0) return set;
    throw new Error("Dicionário vazio");
  } catch (error) {
    log("erro ao carregar palavras_wordle: " + error.message, "Database wordle", 31);
    return new Set([
      "ABRIR","ACASO","ACENO","ACIMA","AFAGO","AFETO","AGORA","AGUDO","AINDA",
      "ALADO","ALEGA","ALGUM","ALMAS","ALOCA","ALUNO","AMADO","AMAGO","AMIGO",
      "AMORA","AMPLA","ANDAR","ANELO","ANIMA","ANIMO","ANJOS","ANTES","APELO",
      "APOIA","ARCAR","ARCAS","ARCOS","ARDOR","ARENA","ARMAS","AROMA","ARTES",
      "ASILO","ASSAR","ASTRO","ATACA","ATADO","ATEAR","ATRAS","ATRIZ","ATROZ",
      "AVARO","AVEIA","AVIDO","AVISO","BARRO","BEIJO","BICHO","BINGO","BLOCO",
      "BOATO","BOLHA","BOLSO","BOMBA","BONDE","BORDO","BRACO","BRADO","BRAVO",
      "BREVE","BRIGA","BROCA","BRUXA","BURRO","BUSCA","CABER","CACHO","CALCA",
      "CALMA","CALDO","CALOR","CAMPO","CANAL","CANTO","CARGA","CARGO","CARNE",
      "CARRO","CARTA","CAUSA","COBRA","COLAR","CONDE","CONTO","CORDA","CORPO",
      "CORTE","CORVO","COURO","CRAVO","CRIAR","CRIME","CRISE","CULPA","CURAR",
      "DANCA","DARDO","DEUSA","DIABO","DISCO","DOLAR","DUPLA","DURAR","ELITE",
      "ESCOA","ETAPA","FALHA","FALSA","FARSA","FATAL","FATIA","FAVOR","FERRO",
      "FIRMA","FIXAR","FLORA","FLUIR","FOLHA","FORCA","FORTE","FOSSO","FRACO",
      "FRADE","FRASE","FRETE","FRUTO","FUGIR","FUMAR","FUNDO","FUROR","FURTO",
      "GAITA","GAROA","GARRA","GEADA","GEMER","GENIO","GERAL","GESSO","GIRAR",
      "GLOBO","GOLFE","GOLPE","GORDO","GOSTO","GRACA","GRANA","GRATO","GRAVE",
      "GREVE","GRITO","GRUPO","GUIAR","HAVER","HEROI","HONRA","HOTEL","HUMOR",
      "IDEAL","IRADO","JANJO","JAULA","JOGAR","JURAR","JUSTO","LABIO","LACRE",
      "LANCE","LARGO","LASER","LAZER","LENTO","LEQUE","LETAL","LIDAR","LIMAO",
      "LINHO","LONGE","LUGAR","LUNAR","LUTAR","MAIOR","MALHA","MANHA","MARCO",
      "MARES","MASSA","MATIZ","MELAO","MENOR","METAL","METRO","MILHO","MINAR",
      "MISSA","MISTO","MOEDA","MOLDE","MOLHO","MONTE","MORAL","MORTO","MOSCA",
      "MOTOR","MULTA","MUNDO","MUSGO","NACAO","NADAR","NEGRO","NINHO","NIVEL",
      "NOBRE","NOITE","NORTE","NOTAR","OLHAR","OLIVA","ORDEM","OTIMO","OUVIR",
      "PACTO","PADRE","PALCO","PALHA","PAPEL","PARDO","PASTA","PEITO","PENAS",
      "PESCA","PICAR","PILHA","PINGO","PISAR","PLANO","PLENO","POLVO","PONTE",
      "PORTA","PORTE","POTRO","PRAZO","PRIMO","PROVA","PULGA","PUNHO","RACHA",
      "RAIOS","RAIVA","RASGO","RAZAO","REINO","RENDA","REZAR","RIGOR","RITMO",
      "ROLAR","RONCO","ROSTO","ROUBO","RUGIR","RURAL","SABAO","SABRE","SALDO",
      "SALVO","SENSO","SERVO","SIGLA","SIGNO","SINAL","SOLAR","SOMAR","SOPRO",
      "SORTE","SUAVE","SULCO","SUMIR","SURDO","SURTO","TALHA","TANGO","TARDE",
      "TEMPO","TENOR","TERCO","TERMO","TERRA","TIGRE","TINTO","TIRAR","TOCAR",
      "TOMBO","TOQUE","TORCE","TORTO","TOSCO","TOTAL","TOTEM","TRAPO","TREVO",
      "TRIGO","TRONO","TUMOR","TURMA","TURNO","TUTOR","UNIAO","USINA","VAGAR",
      "VALOR","VAPOR","VERDE","VERSO","VICIO","VIGOR","VIOLA","VIRAR","VISTA",
      "VOTAR","VULTO","ZINCO","ZOMBA",
    ]);
  }
}

export const DICTIONARY = loadWordleDictionary();

export function getOrCreateDailyWord(guildId, wordArray) {
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
    word = wordArray[Math.floor(Math.random() * wordArray.length)];
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

function todayString() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}


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

export function getOrCreateDailyDueto(guildId, wordArray) {
  const today = todayString();
  const row   = db.prepare(
    `SELECT word1, word2 FROM dueto_daily WHERE guild_id = ? AND date = ?`
  ).get(guildId, today);

  if (row) return [row.word1, row.word2];

  let word1, word2;
  do {
    word1 = wordArray[Math.floor(Math.random() * wordArray.length)];
    word2 = wordArray[Math.floor(Math.random() * wordArray.length)];
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