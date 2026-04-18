import dayjs from "dayjs";
import { 
  getDailyEventFromDB, 
  getHolidaysForYear, 
  saveDailyEvent,
  saveHolidays
} from "../database.js";
import { log } from "../bot.js";
import { isValidGuildId } from "./validation.js";
import { randomEventsData } from "../data/eventsData.js";

// =============== CACHE GLOBAL ===============

const DAILY_EVENT_CACHE = new Map();

// =============== FUNÇÕES AUXILIARES ===============
function createNormalEvent() {
  return {
    eventKey: "normal",
    name: "Dia Normal",
    description: "Tudo normal hoje",
    charMultiplier: 1.0,
    casinoMultiplier: 1.0,
    robSuccess: null,
  };
}

async function generateDailyEventKey(today) {
  const year = dayjs().year();
  const holidays = await loadHolidays(year);
  const isHoliday = holidays.get(today);

  if (isHoliday) {
    const multiplier = Math.random() < 0.5 ? 0.5 : 1.5;
    return `holiday_${multiplier}`;
  }

  // Halloween (outubro / mês 9)
  if (dayjs().month() === 9) {
    return "halloween";
  }

  // Natal (dezembro / mês 11, a partir do dia 25)
  if (dayjs().month() === 11 && dayjs().date() >= 25) {
    return "natal";
  }

  if (Math.random() < 0.8) {
    return "normal";
  }

  const random = randomEventsData[Math.floor(Math.random() * randomEventsData.length)];
  return random.key;
}

export async function generateAndCacheDailyEvent(guildId) {
  if (!guildId || !isValidGuildId(guildId)) {
    return "normal";
  }

  const today = dayjs().format("YYYY-MM-DD");

  const cached = DAILY_EVENT_CACHE.get(guildId);
  if (cached && cached.date === today) {
    return cached.eventKey;
  }

  try {
    const eventKey = await generateDailyEventKey(today);

    saveDailyEvent(guildId, eventKey);

    DAILY_EVENT_CACHE.set(guildId, { eventKey, date: today });

    log(
      `📅 Evento gerado e cacheado para ${guildId}: ${eventKey}`,
      "DailyEvent",
      36
    );

    return eventKey;
  } catch (error) {
    log(
      `❌ Erro ao gerar evento para ${guildId}: ${error.message}`,
      "DailyEvent",
      31
    );
    return "normal";
  }
}

export async function getCurrentDailyEvent(guildId) {
  if (!guildId || !isValidGuildId(guildId)) {
    return createNormalEvent();
  }

  const today = dayjs().format("YYYY-MM-DD");

  const cached = DAILY_EVENT_CACHE.get(guildId);
  if (cached && cached.date === today) {
    return getEventDataByKey(cached.eventKey);
  }

  try {
    const eventKey = getDailyEventFromDB(guildId);
    if (eventKey) {
      DAILY_EVENT_CACHE.set(guildId, { eventKey, date: today });
      return getEventDataByKey(eventKey);
    }
  } catch (error) {
    log(
      `⚠️ Erro ao buscar evento do DB para ${guildId}: ${error.message}`,
      "DailyEvent",
      33
    );
  }

  return createNormalEvent();
}


export function getEventDataByKey(eventKey) {
  if (eventKey === "normal") {
    return createNormalEvent();
  }

  const eventData = randomEventsData.find(event => event.key === eventKey);
  if (eventData) {
    return {
      eventKey: eventData.key,
      name: eventData.name,
      description: eventData.description,
      charMultiplier: eventData.charMultiplier,
      casinoMultiplier: eventData.casinoMultiplier,
      robSuccess: eventData.robSuccess,
    };
  }

  // Eventos especiais (feriados, etc.)
  if (eventKey.startsWith("holiday_")) {
    const multiplier = eventKey.includes("0.5") ? 0.5 : 1.5;
    return {
      eventKey,
      charMultiplier: multiplier,
      casinoMultiplier: 1.0,
      robSuccess: null,
      name: `Feriado Especial`,
      description: `Dia de feriado! Bônus geral de ${multiplier}x`,
    };
  }

  if (eventKey === "halloween") {
    return {
      eventKey: "halloween",
      charMultiplier: 1.5,
      casinoMultiplier: 1.0,
      robSuccess: null,
      name: "Halloween do MEDO!! 👻",
      description: "Evento especial de Halloween!",
    };
  }

  if (eventKey === "natal") {
    return {
      eventKey: "natal",
      charMultiplier: 0.5,
      casinoMultiplier: 2.0,
      robSuccess: null,
      name: "Final de ano da Yui 🎄",
      description: "Final de ano!! Gasta menos chars e cassino paga mais!",
    };
  }

  return createNormalEvent();
}

// =============== RESET DIÁRIO DO CACHE ===============
export function resetDailyEventCache() {
  const size = DAILY_EVENT_CACHE.size;
  DAILY_EVENT_CACHE.clear();
  log(
    `🔄 Cache de eventos diários resetado (${size} servidores)`,
    "DailyEvent",
    32
  );
}

async function loadHolidays(year) {
  const cached = getHolidaysForYear(year);
  if (cached.size > 0) return cached;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const map = new Map(data.map(h => [h.date, h.name]));
    saveHolidays(map, year);
    return map;
  } catch (e) {
    log(`❌ Falha ao carregar feriados: ${e.message}`, "Feriados", 31);
    return new Map();
  }
}