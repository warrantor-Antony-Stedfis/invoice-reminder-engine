import { describe, expect, it } from 'vitest';

import type { Invoice } from '../../src/domain/invoice.js';
import { createMoney } from '../../src/domain/money.js';
import {
  evaluateReminderDecision,
  type ReminderRule,
} from '../../src/domain/reminder-policy.js';

const rules: readonly ReminderRule[] = [
  { stage: 'friendly-reminder', offsetDays: -3 },
  { stage: 'payment-reminder', offsetDays: 1 },
  { stage: 'first-notice', offsetDays: 7 },
  { stage: 'second-notice', offsetDays: 14 },
  { stage: 'final-notice', offsetDays: 30 },
];

const invoice: Invoice = {
  id: 'inv-200',
  dueDate: new Date('2026-07-10T15:00:00.000Z'),
  status: 'open',
  totalAmount: createMoney(10_000, 'EUR'),
  paidAmount: createMoney(4_000, 'EUR'),
  customerEmail: 'customer@example.com',
  remindersEnabled: true,
};

describe('evaluateReminderDecision', () => {
  it('skips four days before the due date', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-07-06T23:59:59.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'skip', reason: 'not-due' });
  });

  it('selects the friendly reminder three days before the due date', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-07-07T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'send', stage: 'friendly-reminder' });
  });

  it('still selects the friendly reminder on the due date', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-07-10T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'send', stage: 'friendly-reminder' });
  });

  it('selects the payment reminder one day after the due date', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-07-11T23:59:59.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'send', stage: 'payment-reminder' });
  });

  it('selects the first notice eight days after the due date', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-07-18T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'send', stage: 'first-notice' });
  });

  it('selects the final notice thirty-five days after the due date', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'send', stage: 'final-notice' });
  });

  it('does not depend on rule order', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-07-18T00:00:00.000Z'),
        rules: [...rules].reverse(),
        sentStages: [],
      }),
    ).toEqual({ type: 'send', stage: 'first-notice' });
  });

  it('skips when the selected stage was already sent', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-07-18T00:00:00.000Z'),
        rules,
        sentStages: ['first-notice'],
      }),
    ).toEqual({ type: 'skip', reason: 'already-sent' });
  });

  it('sends a newly reached stage when an older stage was sent', () => {
    expect(
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-07-18T00:00:00.000Z'),
        rules,
        sentStages: ['friendly-reminder', 'payment-reminder'],
      }),
    ).toEqual({ type: 'send', stage: 'first-notice' });
  });

  it('skips when reminders are disabled', () => {
    expect(
      evaluateReminderDecision({
        invoice: { ...invoice, remindersEnabled: false },
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'skip', reason: 'reminders-disabled' });
  });

  it('skips a paid invoice', () => {
    expect(
      evaluateReminderDecision({
        invoice: { ...invoice, status: 'paid' },
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'skip', reason: 'invoice-not-open' });
  });

  it('skips a cancelled invoice', () => {
    expect(
      evaluateReminderDecision({
        invoice: { ...invoice, status: 'cancelled' },
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'skip', reason: 'invoice-not-open' });
  });

  it('skips an invoice without an outstanding balance', () => {
    expect(
      evaluateReminderDecision({
        invoice: { ...invoice, paidAmount: createMoney(10_000, 'EUR') },
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'skip', reason: 'no-outstanding-balance' });
  });

  it('skips an invoice without a customer email', () => {
    const { customerEmail: _customerEmail, ...invoiceWithoutEmail } = invoice;

    expect(
      evaluateReminderDecision({
        invoice: invoiceWithoutEmail,
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'skip', reason: 'missing-customer-email' });
  });

  it('skips an invoice with a blank customer email', () => {
    expect(
      evaluateReminderDecision({
        invoice: { ...invoice, customerEmail: '   ' },
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toEqual({ type: 'skip', reason: 'missing-customer-email' });
  });

  it('rejects an invalid current date', () => {
    expect(() =>
      evaluateReminderDecision({
        invoice,
        now: new Date(Number.NaN),
        rules,
        sentStages: [],
      }),
    ).toThrow(new RangeError('now must be a valid Date'));
  });

  it('rejects an invalid due date', () => {
    expect(() =>
      evaluateReminderDecision({
        invoice: { ...invoice, dueDate: new Date(Number.NaN) },
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules,
        sentStages: [],
      }),
    ).toThrow(new RangeError('invoice dueDate must be a valid Date'));
  });

  it('rejects a fractional offset', () => {
    expect(() =>
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules: [{ stage: 'friendly-reminder', offsetDays: -3.5 }],
        sentStages: [],
      }),
    ).toThrow(
      new RangeError(
        'offsetDays for friendly-reminder must be a safe integer',
      ),
    );
  });

  it('rejects an unsafe offset', () => {
    expect(() =>
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules: [
          {
            stage: 'friendly-reminder',
            offsetDays: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
        sentStages: [],
      }),
    ).toThrow(
      new RangeError(
        'offsetDays for friendly-reminder must be a safe integer',
      ),
    );
  });

  it('rejects duplicate offsets with an exact error message', () => {
    expect(() =>
      evaluateReminderDecision({
        invoice,
        now: new Date('2026-08-14T00:00:00.000Z'),
        rules: [
          { stage: 'friendly-reminder', offsetDays: 1 },
          { stage: 'payment-reminder', offsetDays: 1 },
        ],
        sentStages: [],
      }),
    ).toThrow(
      new RangeError(
        'Reminder rules must not contain duplicate offsetDays: 1',
      ),
    );
  });
});
