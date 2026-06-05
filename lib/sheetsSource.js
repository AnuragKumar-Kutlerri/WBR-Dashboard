// Unified view over the two week sources:
//   1. Committed data/ folders (read-only seed set, shipped in the repo)
//   2. Admin-uploaded weeks in Vercel Blob (per-file under weeks/<key>/)
//
// listAllSheets() merges and de-dupes them so the dashboard sees one list.
// The blob helpers are also used by the data route (to load buffers) and the
// admin route (to check existence). When Blob isn't configured, the blob calls
// degrade to empty rather than throwing, so local dev works on data/ alone.

import fs from 'fs';
import path from 'path';
import { list, get } from '@vercel/blob';
import { listWeekFolders, deriveWeekLabel } from '@/lib/xlsxParser';
import { weekInfoForLabel, labelFor } from '@/lib/fiscalCalendar';
import { BLOB_PREFIX, ROLES, weekKey, parseWeekKey, parseBlobPath } from '@/lib/week';

const DATA_DIR = path.join(process.cwd(), 'data');

// Committed weeks living as folders under data/.
function listDataWeeks() {
  return listWeekFolders(DATA_DIR).map(name => {
    const label = deriveWeekLabel(path.join(DATA_DIR, name));
    const info = weekInfoForLabel(label) || weekInfoForLabel(name);
    const key = info ? weekKey(info.period, info.weekInPeriod) : name;
    return {
      week: name, // route param for committed weeks is the folder name
      label,
      period: info ? info.period : null,
      weekInPeriod: info ? info.weekInPeriod : null,
      source: 'data',
      deletable: false,
      files: null,
      key,
    };
  });
}

// Group blob entries (weeks/<key>/<role>.xlsx) into one record per week key,
// tracking which roles are present and the latest upload time (cache fingerprint).
async function listBlobWeeks() {
  let blobs;
  try {
    ({ blobs } = await list({ prefix: BLOB_PREFIX }));
  } catch {
    return [];
  }
  const byKey = new Map();
  for (const b of blobs) {
    const parsed = parseBlobPath(b.pathname);
    if (!parsed) continue;
    const { key, role } = parsed;
    if (!byKey.has(key)) {
      byKey.set(key, { files: { wbr: false, loyalty: false, catering: false }, stamps: [] });
    }
    const rec = byKey.get(key);
    rec.files[role] = true;
    if (b.uploadedAt) rec.stamps.push(`${role}:${new Date(b.uploadedAt).getTime()}`);
  }

  const out = [];
  for (const [key, rec] of byKey) {
    const pk = parseWeekKey(key);
    if (!pk) continue;
    out.push({
      week: key, // route param for uploaded weeks is the week key (e.g. "P6-W1")
      label: labelFor(pk.period, pk.week) || key,
      period: pk.period,
      weekInPeriod: pk.week,
      source: 'blob',
      deletable: true,
      files: rec.files,
      fingerprint: rec.stamps.sort().join('|'),
      key,
    });
  }
  return out;
}

// Merged, de-duped list of every available week. Committed data/ weeks win on
// key collision. Sorted by fiscal period then week, nulls last.
export async function listAllSheets() {
  const all = [...listDataWeeks(), ...await listBlobWeeks()];
  const byKey = new Map();
  for (const s of all) {
    if (!byKey.has(s.key)) byKey.set(s.key, s);
  }
  const rank = s => (s.period == null ? Infinity : s.period * 100 + (s.weekInPeriod || 0));
  return [...byKey.values()].sort((a, b) => rank(a) - rank(b));
}

// Presence map + cache fingerprint for one uploaded week. null if it has no
// blob files at all.
export async function blobWeekInfo(key) {
  const weeks = await listBlobWeeks();
  return weeks.find(w => w.key === key) || null;
}

// Load the buffers for an uploaded week, ready for parseWeekBuffers.
// Returns { buffers: { wbr, loyalty, catering }, fingerprint }. Missing roles
// are null. Throws BLOB_NOT_FOUND if the week has no files.
export async function loadBlobWeek(key) {
  const info = await blobWeekInfo(key);
  if (!info) {
    const err = new Error('Week not found: ' + key);
    err.code = 'BLOB_NOT_FOUND';
    throw err;
  }
  const buffers = { wbr: null, loyalty: null, catering: null };
  for (const role of ROLES) {
    if (!info.files[role]) continue;
    // useCache:false — we reuse canonical paths and overwrite on re-upload, so
    // the default content cache would serve stale bytes after a re-upload.
    const result = await get(`${BLOB_PREFIX}${key}/${role}.xlsx`, { access: 'private', useCache: false });
    if (result && result.stream) {
      buffers[role] = Buffer.from(await new Response(result.stream).arrayBuffer());
    }
  }
  return { buffers, fingerprint: info.fingerprint };
}
