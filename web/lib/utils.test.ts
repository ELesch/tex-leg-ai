import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, formatDate, truncate, parseBillId, formatBillId, getBillTypeLabel, debounce } from './utils';

describe('cn (className merger)', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active')).toBe('base active');
    expect(cn('base', false && 'active')).toBe('base');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('merges tailwind classes properly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('handles object syntax', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });
});

describe('formatDate', () => {
  it('formats Date object', () => {
    // Use a date with explicit time to avoid timezone issues
    const date = new Date('2024-01-15T12:00:00');
    const result = formatDate(date);
    expect(result).toMatch(/Jan 15, 2024/);
  });

  it('formats date string', () => {
    // Use explicit time to avoid timezone shifting
    const result = formatDate('2024-03-20T12:00:00');
    expect(result).toMatch(/Mar 20, 2024/);
  });

  it('formats ISO date string', () => {
    const result = formatDate('2024-12-25T10:30:00Z');
    // Allow for timezone variation (could be 24 or 25 depending on local timezone)
    expect(result).toMatch(/Dec 2\d, 2024/);
  });
});

describe('truncate', () => {
  it('returns original string if shorter than maxLength', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('returns original string if equal to maxLength', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('truncates string longer than maxLength', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
  });

  it('handles maxLength of 3', () => {
    expect(truncate('Hello', 3)).toBe('...');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });
});

describe('parseBillId', () => {
  it('parses HB bill ID', () => {
    expect(parseBillId('HB 123')).toEqual({ type: 'HB', number: 123 });
  });

  it('parses SB bill ID', () => {
    expect(parseBillId('SB 45')).toEqual({ type: 'SB', number: 45 });
  });

  it('parses HJR bill ID', () => {
    expect(parseBillId('HJR 10')).toEqual({ type: 'HJR', number: 10 });
  });

  it('parses SJR bill ID', () => {
    expect(parseBillId('SJR 5')).toEqual({ type: 'SJR', number: 5 });
  });

  it('parses HCR bill ID', () => {
    expect(parseBillId('HCR 12')).toEqual({ type: 'HCR', number: 12 });
  });

  it('parses SCR bill ID', () => {
    expect(parseBillId('SCR 8')).toEqual({ type: 'SCR', number: 8 });
  });

  it('parses lowercase bill ID', () => {
    expect(parseBillId('hb 789')).toEqual({ type: 'HB', number: 789 });
  });

  it('parses bill ID without space', () => {
    expect(parseBillId('HB123')).toEqual({ type: 'HB', number: 123 });
  });

  it('returns null for invalid bill ID', () => {
    expect(parseBillId('XYZ 123')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseBillId('')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(parseBillId('education')).toBeNull();
  });
});

describe('formatBillId', () => {
  it('formats HB bill ID', () => {
    expect(formatBillId('hb123')).toBe('HB 123');
  });

  it('formats SB bill ID', () => {
    expect(formatBillId('sb45')).toBe('SB 45');
  });

  it('formats bill ID with space', () => {
    expect(formatBillId('HB 789')).toBe('HB 789');
  });

  it('returns original for invalid bill ID', () => {
    expect(formatBillId('invalid')).toBe('invalid');
  });

  it('returns original for empty string', () => {
    expect(formatBillId('')).toBe('');
  });
});

describe('getBillTypeLabel', () => {
  it('returns correct label for HB', () => {
    expect(getBillTypeLabel('HB')).toBe('House Bill');
  });

  it('returns correct label for SB', () => {
    expect(getBillTypeLabel('SB')).toBe('Senate Bill');
  });

  it('returns correct label for HJR', () => {
    expect(getBillTypeLabel('HJR')).toBe('House Joint Resolution');
  });

  it('returns correct label for SJR', () => {
    expect(getBillTypeLabel('SJR')).toBe('Senate Joint Resolution');
  });

  it('returns correct label for HCR', () => {
    expect(getBillTypeLabel('HCR')).toBe('House Concurrent Resolution');
  });

  it('returns correct label for SCR', () => {
    expect(getBillTypeLabel('SCR')).toBe('Senate Concurrent Resolution');
  });

  it('handles lowercase type', () => {
    expect(getBillTypeLabel('hb')).toBe('House Bill');
  });

  it('returns original for unknown type', () => {
    expect(getBillTypeLabel('XYZ')).toBe('XYZ');
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only executes once for rapid calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('uses last call arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('resets timer on each call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
