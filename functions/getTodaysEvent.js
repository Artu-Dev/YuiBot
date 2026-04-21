import dayjs from "dayjs";
import {
  getDailyEventFromDB,
  getHolidaysForYear,
  saveDailyEvent,
  saveHolidays,
} from "../database.js";
import { log } from "../bot.js";
import { isValidGuildId } from "./validation.js";
import { randomEventsData } from "../data/eventsData.js";

const DAILY_EVENT_CACHE = new Map();

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
  const year = dayjs(today).year();
  const holidays = await loadHolidays(year);

  const holidayName = holidays.get(today);
  if (holidayName) {
    const multiplier = Math.random() < 0.5 ? 0.5 : 1.5;
    log(`🎉 Feriado detectado: ${holidayName} → ${multiplier}x`, "DailyEvent", 35);
    return `holiday_${multiplier}:::${holidayName}`;
  }

  const month = dayjs(today).month();
  const day = dayjs(today).date();

  if (month === 9) return "halloween";
  if (month === 11 && day >= 25) return "natal";
  if (Math.random() < 0.8) return "normal";

  const random = randomEventsData[Math.floor(Math.random() * randomEventsData.length)];
  return random.key;
}


export async function generateAndCacheDailyEvent(guildId) {
  if (!guildId || !isValidGuildId(guildId)) return "normal";

  const today = dayjs().format("YYYY-MM-DD");

  const cached = DAILY_EVENT_CACHE.get(guildId);
  if (cached?.date === today) return cached.eventKey;

  try {
    const eventKey = await generateDailyEventKey(today);

    saveDailyEvent(guildId, eventKey);
    DAILY_EVENT_CACHE.set(guildId, { eventKey, date: today });

    log(`📅 Evento gerado para ${guildId}: ${eventKey}`, "DailyEvent", 36);
    return eventKey;
  } catch (error) {
    log(`❌ Erro ao gerar evento para ${guildId}: ${error.message}`, "DailyEvent", 31);
    return "normal";
  }
}

export async function getCurrentDailyEvent(guildId) {
  if (!guildId || !isValidGuildId(guildId)) return createNormalEvent();

  const today = dayjs().format("YYYY-MM-DD");

  const cached = DAILY_EVENT_CACHE.get(guildId);
  if (cached?.date === today) return getEventDataByKey(cached.eventKey);

  try {
    const eventKey = getDailyEventFromDB(guildId);
    if (eventKey) {
      DAILY_EVENT_CACHE.set(guildId, { eventKey, date: today });
      return getEventDataByKey(eventKey);
    }
  } catch (error) {
    log(`⚠️ Erro ao buscar evento do DB para ${guildId}: ${error.message}`, "DailyEvent", 33);
  }

  return createNormalEvent();
}

export function getEventDataByKey(eventKey) {
  if (!eventKey || eventKey === "normal") return createNormalEvent();

  if (eventKey.startsWith("holiday_")) {
    const [keyPart, holidayName = "Feriado Nacional"] = eventKey.split(":::");
    const multiplier = parseFloat(keyPart.split("_")[1]);
    const bonus = multiplier > 1
      ? `Bônus de **${multiplier}x** nos chars!`
      : `Penalidade de **${multiplier}x** nos chars.`;

    return {
      eventKey,
      name: `${holidayName} 🎉`,
      description: bonus,
      charMultiplier: multiplier,
      casinoMultiplier: 1.0,
      robSuccess: null,
    };
  }

  if (eventKey === "halloween") {
    return {
      eventKey: "halloween",
      name: "Halloween do MEDO!! 👻",
      description: "É Halloween! Chars valem mais hoje. Cuidado com os fantasmas...",
      charMultiplier: 1.5,
      casinoMultiplier: 1.0,
      robSuccess: null,
    };
  }

  if (eventKey === "natal") {
    return {
      eventKey: "natal",
      name: "Final de Ano da Yui 🎄",
      description: "Boas festas! Gasta menos chars e o cassino paga mais!",
      charMultiplier: 0.5,
      casinoMultiplier: 2.0,
      robSuccess: null,
    };
  }

  const eventData = randomEventsData.find((e) => e.key === eventKey);
  if (eventData) {
    return {
      eventKey: eventData.key,
      name: eventData.name,
      description: eventData.description,
      charMultiplier: eventData.charMultiplier,
      casinoMultiplier: eventData.casinoMultiplier,
      robSuccess: eventData.robSuccess ?? null,
    };
  }

  return createNormalEvent();
}

// =============== RESET DO CACHE ===============
export function resetDailyEventCache() {
  const size = DAILY_EVENT_CACHE.size;
  DAILY_EVENT_CACHE.clear();
  log(`🔄 Cache de eventos resetado (${size} servidores)`, "DailyEvent", 32);
}

// =============== FERIADOS ===============
async function loadHolidays(year) {
  const cached = getHolidaysForYear(year);
  if (cached.size > 0) return cached;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    const map = new Map(data.map((h) => [h.date.slice(0, 10), h.name]));

    saveHolidays(map, year);
    log(`✅ ${map.size} feriados carregados para ${year}`, "Feriados", 36);
    return map;
  } catch (e) {
    log(`❌ Falha ao carregar feriados: ${e.message}`, "Feriados", 31);
    return new Map();
  }
}