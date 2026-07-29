import { describe, expect, it } from 'vitest';

import {
  calculateOutstandingAmount,
  type Invoice,
} from '../../src/domain/invoice.js';
import { createMoney } from '../../src/domain/money.js';

describe('calculateOutstandingAmount', () => {
  it('returns EUR 60.00 when EUR 40.00 of EUR 100.00 is paid', () => {
    const invoice: Invoice = {
      id: 'inv-100',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'open',
      totalAmount: createMoney(10_000, 'EUR'),
      paidAmount: createMoney(4_000, 'EUR'),
      customerEmail: 'customer@example.com',
      remindersEnabled: true,
    };

    expect(calculateOutstandingAmount(invoice)).toEqual(
      createMoney(6_000, 'EUR'),
    );
  });

  it('returns zero when the invoice is fully paid', () => {
    const invoice: Invoice = {
      id: 'inv-101',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'paid',
      totalAmount: createMoney(10_000, 'EUR'),
      paidAmount: createMoney(10_000, 'EUR'),
      remindersEnabled: true,
    };

    expect(calculateOutstandingAmount(invoice)).toEqual(createMoney(0, 'EUR'));
  });

  it('returns zero when the invoice is overpaid', () => {
    const invoice: Invoice = {
      id: 'inv-102',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'paid',
      totalAmount: createMoney(10_000, 'EUR'),
      paidAmount: createMoney(12_000, 'EUR'),
      remindersEnabled: true,
    };

    expect(calculateOutstandingAmount(invoice)).toEqual(createMoney(0, 'EUR'));
  });

  it('rejects different currencies', () => {
    const invoice: Invoice = {
      id: 'inv-103',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'open',
      totalAmount: createMoney(10_000, 'EUR'),
      paidAmount: createMoney(4_000, 'GBP'),
      remindersEnabled: true,
    };

    expect(() => calculateOutstandingAmount(invoice)).toThrow(
      'Total and paid amounts must use the same currency',
    );
  });

  it('does not change the source money objects', () => {
    const totalAmount = createMoney(10_000, 'EUR');
    const paidAmount = createMoney(4_000, 'EUR');
    const invoice: Invoice = {
      id: 'inv-104',
      dueDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'open',
      totalAmount,
      paidAmount,
      remindersEnabled: true,
    };

    calculateOutstandingAmount(invoice);

    expect(totalAmount).toEqual(createMoney(10_000, 'EUR'));
    expect(paidAmount).toEqual(createMoney(4_000, 'EUR'));
  });
});
