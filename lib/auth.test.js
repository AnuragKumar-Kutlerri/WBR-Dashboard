import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { getUsers, requireAdmin, verifyAuth } from '@/lib/auth';

const SECRET = 'test-secret';

function reqWithToken(token) {
  return { headers: { get: k => (k === 'authorization' && token ? `Bearer ${token}` : null) } };
}

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

describe('getUsers', () => {
  it('normalizes legacy string-hash entries to role user', () => {
    process.env.USERS_JSON = JSON.stringify({ 'a@x.co': 'hash1' });
    expect(getUsers()).toEqual({ 'a@x.co': { hash: 'hash1', role: 'user' } });
  });
  it('keeps object entries and their role', () => {
    process.env.USERS_JSON = JSON.stringify({ 'b@x.co': { hash: 'h2', role: 'admin' } });
    expect(getUsers()).toEqual({ 'b@x.co': { hash: 'h2', role: 'admin' } });
  });
  it('defaults object entries without a role to user', () => {
    process.env.USERS_JSON = JSON.stringify({ 'c@x.co': { hash: 'h3' } });
    expect(getUsers()['c@x.co'].role).toBe('user');
  });
  it('returns {} for malformed JSON', () => {
    process.env.USERS_JSON = 'not json';
    expect(getUsers()).toEqual({});
  });
});

describe('requireAdmin', () => {
  it('accepts a valid admin token', () => {
    const token = jwt.sign({ email: 'a@x.co', role: 'admin' }, SECRET);
    expect(requireAdmin(reqWithToken(token))).toMatchObject({ role: 'admin' });
  });
  it('rejects a user-role token', () => {
    const token = jwt.sign({ email: 'a@x.co', role: 'user' }, SECRET);
    expect(requireAdmin(reqWithToken(token))).toBeNull();
  });
  it('rejects a missing or invalid token', () => {
    expect(requireAdmin(reqWithToken(null))).toBeNull();
    expect(requireAdmin(reqWithToken('garbage'))).toBeNull();
  });
});

describe('verifyAuth', () => {
  it('returns the decoded payload for a valid token', () => {
    const token = jwt.sign({ email: 'a@x.co', role: 'user' }, SECRET);
    expect(verifyAuth(reqWithToken(token))).toMatchObject({ email: 'a@x.co' });
  });
});
