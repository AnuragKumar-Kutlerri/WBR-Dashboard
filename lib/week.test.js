import { describe, it, expect } from 'vitest';
import { weekKey, parseWeekKey, blobPath, parseBlobPath } from '@/lib/week';

describe('weekKey', () => {
  it('builds a stable key', () => {
    expect(weekKey(6, 1)).toBe('P6-W1');
    expect(weekKey('6', '1')).toBe('P6-W1');
  });
  it('rejects invalid input', () => {
    expect(weekKey(0, 1)).toBeNull();
    expect(weekKey(6, 0)).toBeNull();
    expect(weekKey('x', 1)).toBeNull();
  });
});

describe('parseWeekKey', () => {
  it('round-trips with weekKey', () => {
    expect(parseWeekKey('P6-W1')).toEqual({ period: 6, week: 1 });
    expect(parseWeekKey(weekKey(12, 5))).toEqual({ period: 12, week: 5 });
  });
  it('rejects malformed keys', () => {
    expect(parseWeekKey('Week of May 11')).toBeNull();
    expect(parseWeekKey('../etc')).toBeNull();
    expect(parseWeekKey('')).toBeNull();
  });
});

describe('blobPath / parseBlobPath', () => {
  it('builds canonical role paths', () => {
    expect(blobPath('P6-W1', 'wbr')).toBe('weeks/P6-W1/wbr.xlsx');
    expect(blobPath('P6-W1', 'catering')).toBe('weeks/P6-W1/catering.xlsx');
  });
  it('rejects bad key or role', () => {
    expect(blobPath('bad', 'wbr')).toBeNull();
    expect(blobPath('P6-W1', 'evil')).toBeNull();
  });
  it('parses a path back to key + role', () => {
    expect(parseBlobPath('weeks/P6-W1/loyalty.xlsx')).toEqual({ key: 'P6-W1', role: 'loyalty' });
  });
  it('rejects traversal / non-canonical paths', () => {
    expect(parseBlobPath('weeks/../secret.xlsx')).toBeNull();
    expect(parseBlobPath('weeks/P6-W1/random.xlsx')).toBeNull();
    expect(parseBlobPath('other/P6-W1/wbr.xlsx')).toBeNull();
  });
});
