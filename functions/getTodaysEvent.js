import dayjs from "dayjs";
import { 
  getDailyEventFromDB, 
  getHolidaysForYear, 
  saveDailyEvent
} from "../database.js";
import { log } from "../bot.js";
import { isValidGuildId } from "./validation.js";

const randomEvents = [
  {
    key: "no_limit",
    name: "Dia Livre",
    charMultiplier: 0,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Hoje vocês não perdem caracteres por falar!!!",
  },
  {
    key: "half_chars",
    name: "Dia da economia",
    charMultiplier: 0.5,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Caracteres gastam só metade hoje!",
  },
  {
    key: "char_1_5x",
    name: "Dia da inflação",
    charMultiplier: 1.5,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Caracteres gastam 1.5x mais",
  },
  {
    key: "char_2x",
    name: "Dia AMALDIÇOADO",
    charMultiplier: 2.0,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Caracteres gastam o DOBRO hoje",
  },
  {
    key: "casino_2x",
    name: "Dia do Tigrinho",
    charMultiplier: 1.0,
    casinoMultiplier: 2.0,
    robSuccess: null,
    description: "Cassinos pagam 2x mais!",
  },
  {
    key: "rob_100",
    name: "Dia do Roubo",
    charMultiplier: 1.0,
    casinoMultiplier: 1.0,
    robSuccess: 1.0,
    description: "Roubo 100% garantido hoje!",
  },
  {
    key: "rob_0",
    name: "Dia da honestidade",
    charMultiplier: 1.0,
    casinoMultiplier: 1.0,
    robSuccess: 0,
    description: "A taxa de sucesso de roubo hoje é de 0%!",
  },
  {
    key: "normal",
    name: "Dia Normal",
    charMultiplier: 1.0,
    casinoMultiplier: 1.0,
    robSuccess: null,
    description: "Tudo normal hoje",
  },
];

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

  if (dayjs().month() === 9) {
    const base = randomEvents[Math.floor(Math.random() * randomEvents.length)];
    return {
      eventKey: "halloween",
      charMultiplier: base.charMultiplier || 1.5,
      casinoMultiplier: base.casinoMultiplier,
      robSuccess: base.robSuccess,
      name: "Halloween do MEDO!!",
      description: "Evento especial de Halloween! 👻",
    };
  }

  if (dayjs().month() === 11 && dayjs().date() >= 25) {
    return {
      eventKey: "natal",
      charMultiplier: 0.5,
      casinoMultiplier: 2.0,
      robSuccess: null,
      name: "Final de ano da Yui",
      description: "Final de ano!! Gasta menos chars e cassino paga mais!",
    };
  }

  if (Math.random() < 0.8) {
    return createNormalEvent();
  }

  const random = randomEvents[Math.floor(Math.random() * randomEvents.length)];
  return {
    eventKey: random.key,
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
  if (event) return event;

  event = await generateDailyEvent(today);
  saveDailyEvent(guildId, event);

  return event;
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