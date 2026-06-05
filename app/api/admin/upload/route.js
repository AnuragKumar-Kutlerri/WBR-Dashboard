import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { requireAdmin } from '@/lib/auth';
import { blobPath, parseBlobPath, parseWeekKey, ROLES } from '@/lib/week';
import { weeksInPeriod } from '@/lib/fiscalCalendar';

export const runtime = 'nodejs';

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB per file (workbooks run ~4–11 MB)
const ALLOWED_CT = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // some browsers send this for .xlsx
];

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// POST: issue a client-upload token. The browser then uploads the file bytes
// straight to Blob (bypassing Vercel's 4.5 MB function body limit). We only
// authorize the request and constrain the target path/size/type here.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad('Invalid request body');
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Auth: only the client-token request carries our Bearer header (the
        // upload-completed callback comes from Vercel and skips this branch).
        if (!requireAdmin(request)) throw new Error('Admin access required');

        const parsed = parseBlobPath(pathname);
        if (!parsed) throw new Error('Invalid upload path');
        const pk = parseWeekKey(parsed.key);
        const max = pk && weeksInPeriod(pk.period);
        if (!max || pk.week < 1 || pk.week > max) throw new Error('Invalid period/week');

        return {
          access: 'private',
          allowedContentTypes: ALLOWED_CT,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true, // re-uploading a role replaces just that file
        };
      },
      onUploadCompleted: async () => {
        // No-op. (Only fires in production; can't reach localhost.) The data
        // route validates parsing on read and surfaces any bad file there.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const msg = err?.message || 'Upload authorization failed';
    const status = /admin access/i.test(msg) ? 403 : 400;
    return bad(msg, status);
  }
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
  if (file && !ROLES.includes(file)) return bad('Invalid file role');

  const roles = file ? [file] : ROLES;
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
