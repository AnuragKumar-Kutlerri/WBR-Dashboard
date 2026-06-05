import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUsers } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const users = getUsers();
  const normalized = String(email).toLowerCase().trim();
  const user = users[normalized];
  if (!user || !user.hash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const role = user.role || 'user';
  const token = jwt.sign({ email: normalized, role }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return NextResponse.json({ token, user: { email: normalized, role } });
}
