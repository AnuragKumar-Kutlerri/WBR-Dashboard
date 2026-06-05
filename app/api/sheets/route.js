import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { listAllSheets } from '@/lib/sheetsSource';

export const runtime = 'nodejs';

export async function GET(request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const all = await listAllSheets();
    const sheets = all.map(({ week, label, period, weekInPeriod, source, deletable, files }) => ({
      week,
      label,
      period,
      weekInPeriod,
      source,
      deletable,
      files,
    }));
    return NextResponse.json({ sheets });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
