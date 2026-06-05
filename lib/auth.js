import jwt from 'jsonwebtoken';

// Verify a Bearer token from the Authorization header. Returns the decoded
// payload (e.g. { email }) on success, or null if missing/invalid/expired.
export function verifyAuth(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Verify the Bearer token and require an admin role. Returns the decoded
// payload only when role === 'admin', otherwise null.
export function requireAdmin(request) {
  const decoded = verifyAuth(request);
  if (!decoded || decoded.role !== 'admin') return null;
  return decoded;
}

// Returns the user map parsed from USERS_JSON env, normalized to
// { email: { hash, role } }. Accepts two entry shapes for backward compat:
//   "email": "<bcrypt_hash>"                 → role defaults to 'user'
//   "email": { "hash": "...", "role": "admin" }
// Empty object if the env var is missing or malformed.
export function getUsers() {
  let raw;
  try {
    raw = JSON.parse(process.env.USERS_JSON || '{}');
  } catch {
    return {};
  }
  const users = {};
  for (const [email, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      users[email] = { hash: value, role: 'user' };
    } else if (value && typeof value === 'object') {
      users[email] = { hash: value.hash, role: value.role || 'user' };
    }
  }
  return users;
}
