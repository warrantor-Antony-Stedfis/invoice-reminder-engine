import { describe, expect, it } from 'vitest';

import { createMoney } from '../../src/domain/money.js';

describe('createMoney', () => {
  it('creates EUR 100.00 as 10000 minor units', () => {
    expect(createMoney(10_000, 'EUR')).toEqual({
      minorUnits: 10_000,
      currency: 'EUR',
    });
  });

  it('creates GBP 100.00 as 10000 minor units', () => {
    expect(createMoney(10_000, 'GBP')).toEqual({
      minorUnits: 10_000,
      currency: 'GBP',
    });
  });

  it('allows zero', () => {
    expect(createMoney(0, 'USD')).toEqual({
      minorUnits: 0,
      currency: 'USD',
    });
  });

  it('rejects a negative value', () => {
    expect(() => createMoney(-1, 'EUR')).toThrow(RangeError);
  });

  it('rejects a fractional value', () => {
    expect(() => createMoney(10.5, 'EUR')).toThrow(RangeError);
  });

  it('rejects an unsafe integer', () => {
    expect(() => createMoney(Number.MAX_SAFE_INTEGER + 1, 'EUR')).toThrow(
      RangeError,
    );
  });
});
