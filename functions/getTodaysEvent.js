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

async function generateDailyEvent(today) {
  const year = dayjs().year();
  const holidays = await loadHolidays(year);
  const isHoliday = holidays.get(today);

  if (isHoliday) {
    const multiplier = Math.random() < 0.5 ? 0.5 : 1.5;
    return {
      eventKey: "holiday_special",
      charMultiplier: multiplier,
      casinoMultiplier: 1.0,
      robSuccess: null,
      name: `Feriado: ${isHoliday}`,
      description: `Dia de feriado! Bônus geral de ${multiplier}x`,
    };
  }

  // Halloween (outubro / mês 9)
  if (dayjs().month() === 9) {
    const base = randomEventsData[Math.floor(Math.random() * randomEventsData.length)];
    return {
      eventKey: "halloween",
      charMultiplier: base.charMultiplier || 1.5,
      casinoMultiplier: base.casinoMultiplier,
      robSuccess: base.robSuccess,
      name: "Halloween do MEDO!! 👻",
      description: "Evento especial de Halloween!",
    };
  }

  // Natal (dezembro / mês 11, a partir do dia 25)
  if (dayjs().month() === 11 && dayjs().date() >= 25) {
    return {
      eventKey: "natal",
      charMultiplier: 0.5,
      casinoMultiplier: 2.0,
      robSuccess: null,
      name: "Final de ano da Yui 🎄",
      description: "Final de ano!! Gasta menos chars e cassino paga mais!",
    };
  }

  // 80% de chance de dia normal
  if (Math.random() < 0.8) {
    return createNormalEvent();
  }

  // 20% de chance de evento aleatório
  const random = randomEventsData[Math.floor(Math.random() * randomEventsData.length)];
  return {
    eventKey: random.eventKey,
    charMultiplier: random.charMultiplier,
    casinoMultiplier: random.casinoMultiplier,
    robSuccess: random.robSuccess,
    name: random.name,
    description: random.description,
  };
}

export async function getCurrentDailyEvent(guildId) {
  if (!guildId || !isValidGuildId(guildId)) {
    return createNormalEvent();
  }

  const today = dayjs().format("YYYY-MM-DD");

  let event = getDailyEventFromDB(guildId);
  
  if (event && event.date === today) {
    return event;
  }

  event = await generateDailyEvent(today);
  saveDailyEvent(guildId, event);

  return event || createNormalEvent();
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