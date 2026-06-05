import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { requireAdmin } from '@/lib/auth';
import { parseWeekBuffers } from '@/lib/xlsxParser';
import { weekKey, blobPath, parseWeekKey, ROLES } from '@/lib/week';
import { labelFor, weeksInPeriod } from '@/lib/fiscalCalendar';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
const XLSX_CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// POST: upsert any subset of { wbr, loyalty, catering } for one (period, week).
// Re-uploading a role overwrites only that file; the others are left untouched.
export async function POST(request) {
  if (!requireAdmin(request)) return bad('Admin access required', 403);

  let form;
  try {
    form = await request.formData();
  } catch {
    return bad('Expected a multipart form upload');
  }

  const period = parseInt(form.get('period'), 10);
  const week = parseInt(form.get('week'), 10);
  const max = weeksInPeriod(period);
  if (!max) return bad('Please choose a valid period');
  if (!(week >= 1 && week <= max)) return bad(`Week must be between 1 and ${max} for this period`);

  const key = weekKey(period, week);
  const label = labelFor(period, week);

  // Collect the provided files (any subset of the three roles).
  const provided = [];
  for (const role of ROLES) {
    const file = form.get(role);
    if (!file || typeof file.arrayBuffer !== 'function') continue;
    if (!/\.xlsx?$/i.test(file.name || '')) return bad(`${role} must be an .xlsx or .xls spreadsheet`);
    if (typeof file.size === 'number' && file.size > MAX_BYTES) return bad(`${role} file is too large (max 10 MB)`);
    provided.push({ role, file });
  }
  if (provided.length === 0) return bad('Please choose at least one spreadsheet to upload');

  // Validate each file actually parses before storing — never let a broken
  // workbook reach users. Each role is parsed in its own buffer slot.
  for (const { role, file } of provided) {
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      parseWeekBuffers({ [role]: buffer }, label);
    } catch {
      return bad(`Could not read the ${role} spreadsheet — please check the file and try again`);
    }
    file._buffer = buffer; // reuse below to avoid re-reading
  }

  const written = [];
  for (const { role, file } of provided) {
    try {
      await put(blobPath(key, role), file._buffer, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: XLSX_CT,
      });
      written.push(role);
    } catch (err) {
      console.error('Blob upload failed:', err.message);
      return bad('Upload failed while saving the file', 500);
    }
  }

  return NextResponse.json({ key, label, written });
}

// DELETE: ?week=P6-W1 removes the whole week; add &file=catering to remove just
// one role. Only blob-canonical week keys are accepted, which structurally
// protects the committed data/ folders (their route param is a folder name).
export async function DELETE(request) {
  if (!requireAdmin(request)) return bad('Admin access required', 403);

  const url = new URL(request.url);
  const key = url.searchParams.get('week') || '';
  const file = url.searchParams.get('file') || '';

  if (!parseWeekKey(key)) return bad('Only uploaded weeks can be deleted');

  const roles = file ? [file] : ROLES;
  if (file && !ROLES.includes(file)) return bad('Invalid file role');

  try {
    for (const role of roles) {
      await del(blobPath(key, role)).catch(() => {}); // ignore missing roles
    }
  } catch (err) {
    console.error('Blob delete failed:', err.message);
    return bad('Delete failed', 500);
  }

  return NextResponse.json({ ok: true });
}
