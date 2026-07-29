export type Currency = 'EUR' | 'GBP' | 'USD';

export type Money = Readonly<{
  minorUnits: number;
  currency: Currency;
}>;

export function createMoney(minorUnits: number, currency: Currency): Money {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new RangeError('minorUnits must be a non-negative safe integer');
  }

  return { minorUnits, currency };
}
