import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { parseWeekFolder, parseWeekBuffers } from '@/lib/xlsxParser';
import { verifyAuth } from '@/lib/auth';
import { parseWeekKey } from '@/lib/week';
import { labelFor } from '@/lib/fiscalCalendar';
import { loadBlobWeek } from '@/lib/sheetsSource';

export const runtime = 'nodejs';

const DATA_DIR = path.join(process.cwd(), 'data');

// In-memory cache so we don't re-parse the same folder on every request.
// Keyed by `${week}:${mtimeFingerprint}` so cache busts automatically when files change.
const cache = new Map();

function folderFingerprint(dirPath) {
  // Concatenate mtimes of all files inside the folder so any edit busts the cache.
  if (!fs.existsSync(dirPath)) return '';
  const files = fs.readdirSync(dirPath).filter(f => /\.xlsx?$/i.test(f));
  return files.map(f => f + ':' + fs.statSync(path.join(dirPath, f)).mtimeMs).join('|');
}

export async function GET(request, { params }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { week } = await params;
    if (!week || /[\\/]/.test(week) || week.includes('..')) {
      return NextResponse.json({ error: 'Invalid week name' }, { status: 400 });
    }

    const folder = path.join(DATA_DIR, week);
    if (fs.existsSync(folder)) {
      // Committed data/ week — keyed by file mtimes.
      const cacheKey = `${week}:${folderFingerprint(folder)}`;
      if (cache.has(cacheKey)) return NextResponse.json(cache.get(cacheKey));
      const data = parseWeekFolder(folder);
      cache.set(cacheKey, data);
      return NextResponse.json(data);
    }

    // Not a committed folder → an admin-uploaded week stored in Blob.
    const pk = parseWeekKey(week);
    if (!pk) {
      return NextResponse.json({ error: 'Week not found: ' + week }, { status: 404 });
    }
    const { buffers, fingerprint } = await loadBlobWeek(week);
    const cacheKey = `${week}:${fingerprint}`; // upload time busts the cache
    if (cache.has(cacheKey)) return NextResponse.json(cache.get(cacheKey));
    const data = parseWeekBuffers(buffers, labelFor(pk.period, pk.week));
    cache.set(cacheKey, data);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/data/[week]]', err);
    const status = err.code === 'BLOB_NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
