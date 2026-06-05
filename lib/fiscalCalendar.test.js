import { describe, it, expect } from 'vitest';
import {
  weekInfoForLabel, labelFor, weekStartFor, weeksInPeriod, listPeriods,
} from '@/lib/fiscalCalendar';

describe('weeksInPeriod', () => {
  it('marks P3/P6/P9/P12 as 5-week periods, others 4', () => {
    for (const p of listPeriods()) {
      expect(weeksInPeriod(p)).toBe([3, 6, 9, 12].includes(p) ? 5 : 4);
    }
  });
  it('returns null for unknown periods', () => {
    expect(weeksInPeriod(99)).toBeNull();
  });
});

describe('labelFor / weekStartFor', () => {
  it('round-trips with weekInfoForLabel for every FY2026 week', () => {
    for (const p of listPeriods()) {
      for (let w = 1; w <= weeksInPeriod(p); w++) {
        const label = labelFor(p, w);
        expect(label).toMatch(/^Week of /);
        expect(weekInfoForLabel(label)).toEqual({ period: p, weekInPeriod: w });
      }
    }
  });
  it('produces known anchor labels', () => {
    expect(labelFor(6, 1)).toBe('Week of May 25');
    expect(labelFor(1, 1)).toBe('Week of December 29');
  });
  it('returns null for out-of-range input', () => {
    expect(labelFor(6, 6)).toBeNull(); // P6 has only 5 weeks
    expect(weekStartFor(99, 1)).toBeNull();
  });
});
