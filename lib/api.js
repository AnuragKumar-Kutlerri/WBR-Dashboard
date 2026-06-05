// Client-side API helpers with JWT-bearer auth.
// Token is stored in localStorage under 'wbr_token'.

const TOKEN_KEY = 'wbr_token';

function token() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` };
}

// Reads the role out of the stored JWT for UI gating only. This is NOT a
// security check — the server enforces admin access on every admin route.
export function getRole() {
  const t = token();
  if (!t) return null;
  try {
    const part = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part)).role || 'user';
  } catch {
    return null;
  }
}

export function isAdmin() {
  return getRole() === 'admin';
}

function handle401(res) {
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
  }
}

export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function fetchSheets() {
  const res = await fetch('/api/sheets', { headers: authHeaders() });
  handle401(res);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load sheet list');
  }
  const data = await res.json();
  return data.sheets || [];
}

export async function fetchWeekData(week) {
  const res = await fetch('/api/data/' + encodeURIComponent(week), { headers: authHeaders() });
  handle401(res);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load week data');
  }
  return await res.json();
}

// Upload any subset of { wbr, loyalty, catering } File objects for one
// (period, week). Re-uploading a role overwrites just that file.
export async function uploadWeek(files, period, week) {
  const form = new FormData();
  form.append('period', String(period));
  form.append('week', String(week));
  for (const role of ['wbr', 'loyalty', 'catering']) {
    if (files[role]) form.append(role, files[role]);
  }
  // No Content-Type header — the browser sets the multipart boundary itself.
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}` },
    body: form,
  });
  handle401(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

// Delete one file (role given) or the whole week (role omitted).
export async function deleteWeek(weekKey, role) {
  const qs = `week=${encodeURIComponent(weekKey)}${role ? `&file=${encodeURIComponent(role)}` : ''}`;
  const res = await fetch('/api/admin/upload?' + qs, { method: 'DELETE', headers: authHeaders() });
  handle401(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Delete failed');
  return data;
}
