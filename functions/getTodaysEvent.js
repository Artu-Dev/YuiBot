import dayjs from "dayjs";
import { getTodayEvent, setTodayEvent, getHolidaysForYear, saveHolidays } from "../database.js";
import { log } from "../bot.js";

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
    log("❌ Falha ao carregar feriados:", e.message, "Utils", 31);
    return new Map();
  }
}

export async function getTodaysEvent(guildId) {
  const today = dayjs().format("YYYY-MM-DD");
  const year = dayjs().year();

  const existing = getTodayEvent(guildId);
  if (existing) return existing;

  const holidays = await loadHolidays(year);
  const isHoliday = holidays.get(today);
  let newEvent;

  if (isHoliday) {
    const multiplier = Math.random() < 0.5 ? 0.5 : 1.5;
    newEvent = {
      eventKey: "holiday_special",
      charMultiplier: multiplier,
      casinoMultiplier: 1.0,
      robSuccess: null,
      name: `Feriado: ${isHoliday}`,
      description: `Dia de feriado! Bônus geral de ${multiplier}x`,
    };
  } else if (dayjs().month() === 9) {
    const base = randomEvents[Math.floor(Math.random() * randomEvents.length)];
    newEvent = {
      eventKey: "halloween",
      charMultiplier: base.charMultiplier || 1.5,
      casinoMultiplier: base.casinoMultiplier,
      robSuccess: base.robSuccess,
      name: "Halloween do MEDO!!",
      description: "Evento especial de Halloween! 👻",
    };
  } else if (dayjs().month() === 11 && dayjs().date() >= 25) {
    newEvent = {
      eventKey: "natal",
      charMultiplier: 0.5,
      casinoMultiplier: 2.0,
      robSuccess: null,
      name: "Final de ano da Yui",
      description: "Final de ano!! Gasta menos chars e cassino paga mais!",
    };
  } else if (Math.random() < 0.8) {
    newEvent = {
      eventKey: "normal",
      charMultiplier: 1.0,
      casinoMultiplier: 1.0,
      robSuccess: null,
      name: "Dia Normal",
      description: "Tudo normal hoje",
    };
  } else {
    const random = randomEvents[Math.floor(Math.random() * randomEvents.length)];
    newEvent = {
      eventKey: random.key,
      charMultiplier: random.charMultiplier,
      casinoMultiplier: random.casinoMultiplier,
      robSuccess: random.robSuccess,
      name: random.name,
      description: random.description,
    };
  }

  setTodayEvent(guildId, today, newEvent.eventKey, newEvent.charMultiplier,
    newEvent.casinoMultiplier, newEvent.robSuccess, newEvent.name, newEvent.description);

  return newEvent;
}