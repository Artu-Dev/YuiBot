import { db } from "../../database.js";
import dayjs from "dayjs";
import { isValidGuildId } from "../../functions/validation.js";

export const getDailyEventFromDB = (guildId) => {
  if (!guildId || !isValidGuildId(guildId)) return null;
  const today = dayjs().format("YYYY-MM-DD");
  const row = db.prepare("SELECT eventKey FROM daily_events WHERE guildId = ? AND date = ?").get(guildId, today);
  return row ? row.eventKey : null;
};

export const saveDailyEvent = (guildId, eventKey) => {
  if (!guildId || !isValidGuildId(guildId)) return;
  const today = dayjs().format("YYYY-MM-DD");
  db.prepare(`
    INSERT OR REPLACE INTO daily_events
      (guildId, date, eventKey, hasBeenAnnounced)
    VALUES (?, ?, ?, 0)
  `).run(guildId, today, eventKey ?? "normal");
};

export const shouldAnnounceDailyEvent = (guildId) => {
  if (!guildId || !isValidGuildId(guildId)) return false;
  const today = dayjs().format("YYYY-MM-DD");
  const row = db.prepare("SELECT hasBeenAnnounced FROM daily_events WHERE guildId = ? AND date = ?").get(guildId, today);
  return !row || row.hasBeenAnnounced === 0;
};

export const markDailyEventAsAnnounced = (guildId) => {
  if (!guildId || !isValidGuildId(guildId)) return;
  const today = dayjs().format("YYYY-MM-DD");
  db.prepare("UPDATE daily_events SET hasBeenAnnounced = 1 WHERE guildId = ? AND date = ?").run(guildId, today);
};

export const getHolidaysForYear = (year) => {
  const rows = db.prepare("SELECT date, name FROM holidays_cache WHERE year = ?").all(year);
  return new Map(rows.map(r => [r.date, r.name]));
};

export const saveHolidays = (holidays, year) => {
  const insert = db.prepare("INSERT OR REPLACE INTO holidays_cache (date, name, year) VALUES (?, ?, ?)");
  const insertAll = db.transaction((holidays) => {
    for (const [date, name] of holidays.entries()) {
      insert.run(date, name, year);
    }
  });
  insertAll(holidays);
};
