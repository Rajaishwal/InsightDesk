// istDate.js — India-time (Asia/Kolkata) calendar helpers.
// Attendance dates and "today" are IST calendar days. Never derive a day with toISOString() —
// that is UTC, so from 00:00 to 05:30 IST it still reports the previous day.
// Leave start/end dates are the exception: they are stored as UTC-midnight calendar dates, so use utcDateKey for those.

export const IST_TZ = 'Asia/Kolkata';

const ymdFormat = new Intl.DateTimeFormat('en-CA', { timeZone: IST_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "YYYY-MM-DD" of the IST calendar day containing `d` (default: now). */
export const istDateKey = (d = new Date()) => ymdFormat.format(new Date(d));

/** "YYYY-MM-DD" of a value stored as a UTC-midnight calendar date (Leave.startDate / endDate). */
export const utcDateKey = (d) => new Date(d).toISOString().slice(0, 10);

/** Shift a "YYYY-MM-DD" key by n calendar days. */
export const addDaysKey = (ds, n) => {
  const d = new Date(`${ds}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Day of week for a "YYYY-MM-DD" key (0 = Sun … 6 = Sat). */
export const dowOfKey = (ds) => new Date(`${ds}T00:00:00Z`).getUTCDay();

/** Instant at which an IST calendar day starts / ends. */
export const istDayStart = (ds = istDateKey()) => new Date(`${ds}T00:00:00.000+05:30`);
export const istDayEnd   = (ds = istDateKey()) => new Date(`${ds}T23:59:59.999+05:30`);

/** { year, month (0-based), day } of the IST calendar day containing `d`. */
export const istParts = (d = new Date()) => {
  const [year, month, day] = istDateKey(d).split('-').map(Number);
  return { year, month: month - 1, day };
};

// A work session can run past midnight (check in 11 PM, out 1 AM), so "currently checked in" is the latest
// open record from the last 16h — not just today's date. Older open records are forgotten check-outs, not live sessions.
export const OPEN_SESSION_MAX_HOURS = 16;

export const findOpenAttendance = (Attendance, userId) =>
  Attendance.findOne({
    userId,
    status: 'checked-in',
    checkInTime: { $gte: new Date(Date.now() - OPEN_SESSION_MAX_HOURS * 3600 * 1000) },
  }).sort({ checkInTime: -1 });
