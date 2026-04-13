import dayjs from "dayjs";
import { db, getTodayEvent, setTodayEvent } from "../database.js";

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

let holidaysCache = new Map();

async function loadHolidays(year) {
  if (holidaysCache.size > 0) return;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    data.forEach((h) => {
      holidaysCache.set(h.date, h.name);
    });

    console.log(`✅ ${data.length} feriados brasileiros carregados para ${year}`);
  } catch (e) {
    console.error("❌ Falha ao carregar feriados:", e.message);
  }
}

export async function getTodaysEvent(guildId) {
  const today = dayjs().format("YYYY-MM-DD");
  const year = dayjs().year();

  await loadHolidays(year);

  let event = getTodayEvent(guildId, today);

  if (!event) {
    const isHoliday = holidaysCache.get(today);
    let newEvent;

    if (isHoliday) {
      // Evento especial de feriado
      const multiplier = Math.random() < 0.5 ? 0.5 : 1.5;

      newEvent = {
        guildId,
        date: today,
        eventKey: "holiday_special",
        charMultiplier: multiplier,
        casinoMultiplier: 1.0,
        robSuccess: null,
        name: `Feriado: ${isHoliday}`,
        description: `Dia de feriado! Bônus geral de ${multiplier}x`,
      };
    } 
    else if (dayjs().month() === 9) {
      // Outubro → Halloween
      const randomEvent = { ...randomEvents[Math.floor(Math.random() * randomEvents.length)] };
      
      newEvent = {
        ...randomEvent,
        eventKey: "halloween",
        name: "Halloween do MEDO!!",
        description: "Evento especial de Halloween! 👻",
        charMultiplier: randomEvent.charMultiplier || 1.5,
      };
    } 
    else if (dayjs().month() === 11 && dayjs().date() >= 25) {
      newEvent = {
        guildId,
        date: today,
        eventKey: "natal",
        charMultiplier: 0.5,
        casinoMultiplier: 2.0,
        robSuccess: null,
        name: "Final de ano da Yui",
        description: "Final de ano!! Gasta menos chars e cassino paga mais!",
      };
    } 
    else {
      if (Math.random() < 0.8) {
        newEvent = {
          guildId,
          date: today,
          eventKey: "normal",
          charMultiplier: 1.0,
          casinoMultiplier: 1.0,
          robSuccess: null,
          name: "Dia Normal",
          description: "Tudo normal hoje",
        };
      } else {
        const randomEvent = randomEvents[Math.floor(Math.random() * randomEvents.length)];
        newEvent = {
          guildId,
          date: today,
          eventKey: randomEvent.key,
          charMultiplier: randomEvent.charMultiplier,
          casinoMultiplier: randomEvent.casinoMultiplier,
          robSuccess: randomEvent.robSuccess,
          name: randomEvent.name,
          description: randomEvent.description,
        };
      }
    }

    setTodayEvent(
      guildId,
      today,
      newEvent.eventKey,
      newEvent.charMultiplier,
      newEvent.casinoMultiplier,
      newEvent.robSuccess,
      newEvent.name,
      newEvent.description
    );

    event = newEvent;
  }

  return event;
}