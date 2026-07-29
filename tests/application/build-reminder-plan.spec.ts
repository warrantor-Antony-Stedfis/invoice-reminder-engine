import { describe, expect, it } from 'vitest';

import {
  buildReminderPlan,
  type SentStagesByInvoice,
} from '../../src/application/build-reminder-plan.js';
import type { Invoice } from '../../src/domain/invoice.js';
import { createMoney } from '../../src/domain/money.js';
import type {
  ReminderRule,
  ReminderStage,
} from '../../src/domain/reminder-policy.js';

const rules: readonly ReminderRule[] = [
  { stage: 'friendly-reminder', offsetDays: -3 },
  { stage: 'first-notice', offsetDays: 7 },
];

function createInvoice(
  id: string,
  overrides: Partial<Invoice> = {},
): Invoice {
  return {
    id,
    dueDate: new Date('2026-07-10T00:00:00.000Z'),
    status: 'open',
    totalAmount: createMoney(10_000, 'EUR'),
    paidAmount: createMoney(4_000, 'EUR'),
    customerEmail: 'customer@example.com',
    remindersEnabled: true,
    ...overrides,
  };
}

describe('buildReminderPlan', () => {
  it('returns empty items and a zero summary for an empty batch', () => {
    expect(
      buildReminderPlan({
        invoices: [],
        now: new Date('2026-07-18T00:00:00.000Z'),
        rules,
        sentStagesByInvoice: new Map(),
      }),
    ).toEqual({
      items: [],
      summary: {
        total: 0,
        send: 0,
        skipped: 0,
        skippedByReason: {
          'reminders-disabled': 0,
          'invoice-not-open': 0,
          'no-outstanding-balance': 0,
          'missing-customer-email': 0,
          'not-due': 0,
          'already-sent': 0,
        },
      },
    });
  });

  it('returns send and skip decisions for multiple invoices', () => {
    const plan = buildReminderPlan({
      invoices: [
        createInvoice('inv-send'),
        createInvoice('inv-disabled', { remindersEnabled: false }),
        createInvoice('inv-paid', { status: 'paid' }),
      ],
      now: new Date('2026-07-18T00:00:00.000Z'),
      rules,
      sentStagesByInvoice: new Map(),
    });

    expect(plan.items).toEqual([
      {
        invoiceId: 'inv-send',
        decision: { type: 'send', stage: 'first-notice' },
      },
      {
        invoiceId: 'inv-disabled',
        decision: { type: 'skip', reason: 'reminders-disabled' },
      },
      {
        invoiceId: 'inv-paid',
        decision: { type: 'skip', reason: 'invoice-not-open' },
      },
    ]);
    expect(plan.summary.total).toBe(3);
    expect(plan.summary.send).toBe(1);
    expect(plan.summary.skipped).toBe(2);
  });

  it('preserves the invoice order in plan items', () => {
    const plan = buildReminderPlan({
      invoices: [
        createInvoice('inv-third'),
        createInvoice('inv-first'),
        createInvoice('inv-second'),
      ],
      now: new Date('2026-07-18T00:00:00.000Z'),
      rules,
      sentStagesByInvoice: new Map(),
    });

    expect(plan.items.map((item) => item.invoiceId)).toEqual([
      'inv-third',
      'inv-first',
      'inv-second',
    ]);
  });

  it('applies sent-stage history separately to each invoice', () => {
    const sentStagesByInvoice: SentStagesByInvoice = new Map([
      ['inv-sent', ['first-notice']],
      ['inv-unsent', []],
    ]);

    const plan = buildReminderPlan({
      invoices: [createInvoice('inv-sent'), createInvoice('inv-unsent')],
      now: new Date('2026-07-18T00:00:00.000Z'),
      rules,
      sentStagesByInvoice,
    });

    expect(plan.items).toEqual([
      {
        invoiceId: 'inv-sent',
        decision: { type: 'skip', reason: 'already-sent' },
      },
      {
        invoiceId: 'inv-unsent',
        decision: { type: 'send', stage: 'first-notice' },
      },
    ]);
  });

  it('returns already-sent for a previously sent selected stage', () => {
    const plan = buildReminderPlan({
      invoices: [createInvoice('inv-sent')],
      now: new Date('2026-07-18T00:00:00.000Z'),
      rules,
      sentStagesByInvoice: new Map([['inv-sent', ['first-notice']]]),
    });

    expect(plan.items[0]?.decision).toEqual({
      type: 'skip',
      reason: 'already-sent',
    });
  });

  it('treats a missing history entry as an empty history', () => {
    const plan = buildReminderPlan({
      invoices: [createInvoice('inv-without-history')],
      now: new Date('2026-07-18T00:00:00.000Z'),
      rules,
      sentStagesByInvoice: new Map(),
    });

    expect(plan.items[0]?.decision).toEqual({
      type: 'send',
      stage: 'first-notice',
    });
  });

  it('counts every skip reason in the summary', () => {
    const plan = buildReminderPlan({
      invoices: [
        createInvoice('inv-disabled', { remindersEnabled: false }),
        createInvoice('inv-paid', { status: 'paid' }),
        createInvoice('inv-settled', {
          paidAmount: createMoney(10_000, 'EUR'),
        }),
        createInvoice('inv-no-email', { customerEmail: '   ' }),
      ],
      now: new Date('2026-07-18T00:00:00.000Z'),
      rules,
      sentStagesByInvoice: new Map(),
    });

    expect(plan.summary).toEqual({
      total: 4,
      send: 0,
      skipped: 4,
      skippedByReason: {
        'reminders-disabled': 1,
        'invoice-not-open': 1,
        'no-outstanding-balance': 1,
        'missing-customer-email': 1,
        'not-due': 0,
        'already-sent': 0,
      },
    });
  });

  it('counts not-due and already-sent decisions in the summary', () => {
    const plan = buildReminderPlan({
      invoices: [
        createInvoice('inv-not-due'),
        createInvoice('inv-already-sent', {
          dueDate: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ],
      now: new Date('2026-07-06T00:00:00.000Z'),
      rules,
      sentStagesByInvoice: new Map([
        ['inv-already-sent', ['friendly-reminder']],
      ]),
    });

    expect(plan.summary).toEqual({
      total: 2,
      send: 0,
      skipped: 2,
      skippedByReason: {
        'reminders-disabled': 0,
        'invoice-not-open': 0,
        'no-outstanding-balance': 0,
        'missing-customer-email': 0,
        'not-due': 1,
        'already-sent': 1,
      },
    });
  });

  it('rejects an empty invoice id', () => {
    expect(() =>
      buildReminderPlan({
        invoices: [createInvoice('')],
        now: new Date('2026-07-18T00:00:00.000Z'),
        rules,
        sentStagesByInvoice: new Map(),
      }),
    ).toThrow(new Error('Invoice id must not be empty'));
  });

  it('rejects an invoice id containing only whitespace', () => {
    expect(() =>
      buildReminderPlan({
        invoices: [createInvoice('   ')],
        now: new Date('2026-07-18T00:00:00.000Z'),
        rules,
        sentStagesByInvoice: new Map(),
      }),
    ).toThrow(new Error('Invoice id must not be empty'));
  });

  it('rejects a duplicate invoice id with an exact error message', () => {
    expect(() =>
      buildReminderPlan({
        invoices: [createInvoice('inv-duplicate'), createInvoice('inv-duplicate')],
        now: new Date('2026-07-18T00:00:00.000Z'),
        rules,
        sentStagesByInvoice: new Map(),
      }),
    ).toThrow(new Error('Duplicate invoice id: inv-duplicate'));
  });

  it('does not change invoices, rules or sent-stage histories', () => {
    const invoices = [createInvoice('inv-a'), createInvoice('inv-b')];
    const sentStages: readonly ReminderStage[] = ['first-notice'];
    const sentStagesByInvoice: SentStagesByInvoice = new Map([
      ['inv-a', sentStages],
    ]);
    const invoicesBefore = structuredClone(invoices);
    const rulesBefore = structuredClone(rules);
    const sentStagesBefore = [...sentStages];

    buildReminderPlan({
      invoices,
      now: new Date('2026-07-18T00:00:00.000Z'),
      rules,
      sentStagesByInvoice,
    });

    expect(invoices).toEqual(invoicesBefore);
    expect(rules).toEqual(rulesBefore);
    expect(sentStages).toEqual(sentStagesBefore);
    expect([...sentStagesByInvoice.entries()]).toEqual([
      ['inv-a', ['first-notice']],
    ]);
  });
});
