// Week identity helpers for admin-uploaded data.
//
// An uploaded week is identified by its fiscal (period, week) and stored in
// Vercel Blob as up to three workbooks under a per-week prefix:
//   weeks/P6-W1/wbr.xlsx
//   weeks/P6-W1/loyalty.xlsx
//   weeks/P6-W1/catering.xlsx
// Each file is uploaded, re-uploaded, and deleted independently. Files are
// renamed to their canonical role so blob parsing is deterministic (no
// filename-keyword guessing like the committed data/ folders use).

export const BLOB_PREFIX = 'weeks/';

// The three workbook roles a week can contain, mapped to the buffer keys
// parseWeekBuffers expects.
export const ROLES = ['wbr', 'loyalty', 'catering'];

// (period, week) → stable key "P6-W1". Returns null for invalid input.
export function weekKey(period, week) {
  const p = Number(period);
  const w = Number(week);
  if (!Number.isInteger(p) || !Number.isInteger(w) || p < 1 || w < 1) return null;
  return `P${p}-W${w}`;
}

// "P6-W1" → { period, week }. Returns null when the key is malformed.
export function parseWeekKey(key) {
  const m = /^P(\d+)-W(\d+)$/.exec(String(key || ''));
  if (!m) return null;
  return { period: parseInt(m[1], 10), week: parseInt(m[2], 10) };
}

// Blob storage path for one role of a week: "weeks/P6-W1/catering.xlsx".
// Returns null for an invalid key or unknown role.
export function blobPath(key, role) {
  if (!parseWeekKey(key)) return null;
  if (!ROLES.includes(role)) return null;
  return `${BLOB_PREFIX}${key}/${role}.xlsx`;
}

// Parse a blob pathname ("weeks/P6-W1/catering.xlsx") → { key, role }.
// Returns null when the path doesn't match the canonical layout.
export function parseBlobPath(pathname) {
  const m = /^weeks\/(P\d+-W\d+)\/(wbr|loyalty|catering)\.xlsx$/.exec(String(pathname || ''));
  if (!m) return null;
  return { key: m[1], role: m[2] };
}
