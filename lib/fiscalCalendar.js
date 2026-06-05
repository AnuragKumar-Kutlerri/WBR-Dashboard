// Fiscal calendar (4-4-5 retail style) for FY2026.
// Encodes each period's start date and week count; from these we derive every
// week-start date so a week-folder label ("Week of May 11") can be mapped to its
// fiscal { period, weekInPeriod }. Pure module — safe on server and client.
//
// Source: WBR fiscal calendar table (P1 starts 2025-12-29; 5-week periods are
// P3, P6, P9, P12; all others are 4 weeks; 52 weeks total).

const PERIODS = [
  { period: 1,  start: [2025, 12, 29], weeks: 4 },
  { period: 2,  start: [2026, 1, 26],  weeks: 4 },
  { period: 3,  start: [2026, 2, 23],  weeks: 5 },
  { period: 4,  start: [2026, 3, 30],  weeks: 4 },
  { period: 5,  start: [2026, 4, 27],  weeks: 4 },
  { period: 6,  start: [2026, 5, 25],  weeks: 5 },
  { period: 7,  start: [2026, 6, 29],  weeks: 4 },
  { period: 8,  start: [2026, 7, 27],  weeks: 4 },
  { period: 9,  start: [2026, 8, 24],  weeks: 5 },
  { period: 10, start: [2026, 9, 28],  weeks: 4 },
  { period: 11, start: [2026, 10, 26], weeks: 4 },
  { period: 12, start: [2026, 11, 23], weeks: 5 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

// All 52 week starts, keyed by "month-day" → { period, weekInPeriod }.
// Within a single fiscal year each (month, day) week-start is unique.
const WEEK_INDEX = (() => {
  const idx = {};
  for (const p of PERIODS) {
    const base = Date.UTC(p.start[0], p.start[1] - 1, p.start[2]);
    for (let k = 0; k < p.weeks; k++) {
      const d = new Date(base + k * 7 * DAY_MS);
      const key = `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
      idx[key] = { period: p.period, weekInPeriod: k + 1 };
    }
  }
  return idx;
})();

// Map a week label/folder name (e.g. "Week of May 11") to { period, weekInPeriod }.
// Returns null when the text has no month+day or doesn't line up with a week start.
export function weekInfoForLabel(text) {
  if (!text) return null;
  const m = /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/.exec(String(text));
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const day = parseInt(m[2], 10);
  if (!month || !day) return null;
  return WEEK_INDEX[`${month}-${day}`] || null;
}

// ── Inverse lookups: (period, week) → date / label ──────────────────────────
// Used by the admin upload flow, where the admin picks a period and week rather
// than a date. Only valid for the FY2026 periods encoded above.

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Number of weeks in a fiscal period (4 or 5). Returns null for unknown periods.
export function weeksInPeriod(period) {
  const p = PERIODS.find(x => x.period === period);
  return p ? p.weeks : null;
}

// All valid period numbers in fiscal order.
export function listPeriods() {
  return PERIODS.map(p => p.period);
}

// (period, weekInPeriod) → { year, month, day } of that week's start date.
// Returns null when the period is unknown or the week is out of range.
export function weekStartFor(period, weekInPeriod) {
  const p = PERIODS.find(x => x.period === period);
  if (!p) return null;
  if (!(weekInPeriod >= 1 && weekInPeriod <= p.weeks)) return null;
  const base = Date.UTC(p.start[0], p.start[1] - 1, p.start[2]);
  const d = new Date(base + (weekInPeriod - 1) * 7 * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// (period, weekInPeriod) → "Week of May 11". Round-trips with weekInfoForLabel.
// Returns null for invalid inputs.
export function labelFor(period, weekInPeriod) {
  const s = weekStartFor(period, weekInPeriod);
  if (!s) return null;
  return `Week of ${MONTH_NAMES[s.month]} ${s.day}`;
}
