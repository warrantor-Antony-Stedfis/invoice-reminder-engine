import { describe, expect, it } from 'vitest';

import { processReminders } from '../../src/application/process-reminders.js';
import type { Invoice } from '../../src/domain/invoice.js';
import { createMoney } from '../../src/domain/money.js';
import type {
  ReminderRule,
  ReminderStage,
} from '../../src/domain/reminder-policy.js';
import type {
  RecordSentReminderInput,
  ReminderHistoryStore,
} from '../../src/ports/reminder-history-store.js';
import type {
  ReminderDelivery,
  ReminderSender,
} from '../../src/ports/reminder-sender.js';

const rules: readonly ReminderRule[] = [
  { stage: 'friendly-reminder', offsetDays: -3 },
  { stage: 'first-notice', offsetDays: 7 },
];

const now = new Date('2026-07-18T12:00:00.000Z');

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

describe('processReminders', () => {
  it('sends an eligible invoice and records the sent stage', async () => {
    const deliveries: ReminderDelivery[] = [];
    const records: RecordSentReminderInput[] = [];
    const callOrder: string[] = [];
    const historyStore: ReminderHistoryStore = {
      async getSentStages() {
        return [];
      },
      async recordSent(input) {
        callOrder.push('recordSent');
        records.push(input);
      },
    };
    const sender: ReminderSender = {
      async send(delivery) {
        callOrder.push('send');
        deliveries.push(delivery);
      },
    };
    const invoice = createInvoice('inv-eligible', {
      customerEmail: '  customer@example.com  ',
    });

    const result = await processReminders(
      { invoices: [invoice], now, rules },
      { historyStore, sender },
    );

    expect(result).toEqual({
      items: [
        {
          invoiceId: 'inv-eligible',
          outcome: 'sent',
          stage: 'first-notice',
        },
      ],
      summary: { total: 1, sent: 1, skipped: 0, failed: 0 },
    });
    expect(deliveries).toEqual([
      {
        idempotencyKey: 'inv-eligible:first-notice',
        invoiceId: 'inv-eligible',
        recipient: 'customer@example.com',
        stage: 'first-notice',
        outstandingAmount: createMoney(6_000, 'EUR'),
      },
    ]);
    expect(callOrder).toEqual(['send', 'recordSent']);
    expect(records).toHaveLength(1);
    expect(records[0]?.invoiceId).toBe('inv-eligible');
    expect(records[0]?.stage).toBe('first-notice');
    expect(records[0]?.sentAt).toEqual(now);
    expect(records[0]?.sentAt).not.toBe(now);
  });

  it('does not send or record a skipped invoice', async () => {
    const deliveries: ReminderDelivery[] = [];
    const records: RecordSentReminderInput[] = [];
    const historyStore: ReminderHistoryStore = {
      async getSentStages() {
        return [];
      },
      async recordSent(input) {
        records.push(input);
      },
    };
    const sender: ReminderSender = {
      async send(delivery) {
        deliveries.push(delivery);
      },
    };

    const result = await processReminders(
      {
        invoices: [
          createInvoice('inv-disabled', { remindersEnabled: false }),
        ],
        now,
        rules,
      },
      { historyStore, sender },
    );

    expect(result.items).toEqual([
      {
        invoiceId: 'inv-disabled',
        outcome: 'skipped',
        reason: 'reminders-disabled',
      },
    ]);
    expect(deliveries).toEqual([]);
    expect(records).toEqual([]);
  });

  it('skips a stage already present in reminder history', async () => {
    const deliveries: ReminderDelivery[] = [];
    const records: RecordSentReminderInput[] = [];
    const historyStore: ReminderHistoryStore = {
      async getSentStages() {
        return ['first-notice'];
      },
      async recordSent(input) {
        records.push(input);
      },
    };
    const sender: ReminderSender = {
      async send(delivery) {
        deliveries.push(delivery);
      },
    };

    const result = await processReminders(
      { invoices: [createInvoice('inv-sent')], now, rules },
      { historyStore, sender },
    );

    expect(result.items).toEqual([
      {
        invoiceId: 'inv-sent',
        outcome: 'skipped',
        reason: 'already-sent',
      },
    ]);
    expect(deliveries).toEqual([]);
    expect(records).toEqual([]);
  });

  it('continues with the next invoice after a sender failure', async () => {
    const records: RecordSentReminderInput[] = [];
    const historyStore: ReminderHistoryStore = {
      async getSentStages() {
        return [];
      },
      async recordSent(input) {
        records.push(input);
      },
    };
    const sender: ReminderSender = {
      async send(delivery) {
        if (delivery.invoiceId === 'inv-failed') {
          throw new Error('Delivery unavailable');
        }
      },
    };

    const result = await processReminders(
      {
        invoices: [
          createInvoice('inv-failed'),
          createInvoice('inv-successful'),
        ],
        now,
        rules,
      },
      { historyStore, sender },
    );

    expect(result.items).toEqual([
      {
        invoiceId: 'inv-failed',
        outcome: 'failed',
        stage: 'first-notice',
        error: 'Delivery unavailable',
      },
      {
        invoiceId: 'inv-successful',
        outcome: 'sent',
        stage: 'first-notice',
      },
    ]);
    expect(records.map((record) => record.invoiceId)).toEqual([
      'inv-successful',
    ]);
  });

  it('returns failed when recording the sent stage fails', async () => {
    const deliveries: ReminderDelivery[] = [];
    const historyStore: ReminderHistoryStore = {
      async getSentStages() {
        return [];
      },
      async recordSent() {
        throw new Error('History unavailable');
      },
    };
    const sender: ReminderSender = {
      async send(delivery) {
        deliveries.push(delivery);
      },
    };

    const result = await processReminders(
      { invoices: [createInvoice('inv-history-failure')], now, rules },
      { historyStore, sender },
    );

    expect(result.items).toEqual([
      {
        invoiceId: 'inv-history-failure',
        outcome: 'failed',
        stage: 'first-notice',
        error: 'History unavailable',
      },
    ]);
    expect(deliveries).toHaveLength(1);
  });

  it('continues with the next invoice after recording history fails', async () => {
    const deliveries: ReminderDelivery[] = [];
    const historyStore: ReminderHistoryStore = {
      async getSentStages() {
        return [];
      },
      async recordSent(input) {
        if (input.invoiceId === 'inv-history-failure') {
          throw new Error('History unavailable');
        }
      },
    };
    const sender: ReminderSender = {
      async send(delivery) {
        deliveries.push(delivery);
      },
    };

    const result = await processReminders(
      {
        invoices: [
          createInvoice('inv-history-failure'),
          createInvoice('inv-successful'),
        ],
        now,
        rules,
      },
      { historyStore, sender },
    );

    expect(result).toEqual({
      items: [
        {
          invoiceId: 'inv-history-failure',
          outcome: 'failed',
          stage: 'first-notice',
          error: 'History unavailable',
        },
        {
          invoiceId: 'inv-successful',
          outcome: 'sent',
          stage: 'first-notice',
        },
      ],
      summary: {
        total: 2,
        sent: 1,
        skipped: 0,
        failed: 1,
      },
    });
    expect(deliveries.map((delivery) => delivery.invoiceId)).toEqual([
      'inv-history-failure',
      'inv-successful',
    ]);
  });

  it('counts sent, skipped and failed outcomes', async () => {
    const historyStore: ReminderHistoryStore = {
      async getSentStages() {
        return [];
      },
      async recordSent() {},
    };
    const sender: ReminderSender = {
      async send(delivery) {
        if (delivery.invoiceId === 'inv-failed') {
          throw 'unavailable';
        }
      },
    };

    const result = await processReminders(
      {
        invoices: [
          createInvoice('inv-sent'),
          createInvoice('inv-skipped', { status: 'paid' }),
          createInvoice('inv-failed'),
        ],
        now,
        rules,
      },
      { historyStore, sender },
    );

    expect(result.items[2]).toEqual({
      invoiceId: 'inv-failed',
      outcome: 'failed',
      stage: 'first-notice',
      error: 'Unknown error',
    });
    expect(result.summary).toEqual({
      total: 3,
      sent: 1,
      skipped: 1,
      failed: 1,
    });
  });

  it('rejects duplicate ids before calling dependencies', async () => {
    const historyCalls: string[] = [];
    const deliveries: ReminderDelivery[] = [];
    const records: RecordSentReminderInput[] = [];
    const historyStore: ReminderHistoryStore = {
      async getSentStages(invoiceId) {
        historyCalls.push(invoiceId);
        return [];
      },
      async recordSent(input) {
        records.push(input);
      },
    };
    const sender: ReminderSender = {
      async send(delivery) {
        deliveries.push(delivery);
      },
    };

    await expect(
      processReminders(
        {
          invoices: [
            createInvoice('inv-duplicate'),
            createInvoice('inv-duplicate'),
          ],
          now,
          rules,
        },
        { historyStore, sender },
      ),
    ).rejects.toThrow(new Error('Duplicate invoice id: inv-duplicate'));
    expect(historyCalls).toEqual([]);
    expect(deliveries).toEqual([]);
    expect(records).toEqual([]);
  });

  it('does not change invoices, rules or history arrays', async () => {
    const invoices = [createInvoice('inv-immutable')];
    const history: readonly ReminderStage[] = ['friendly-reminder'];
    const invoicesBefore = structuredClone(invoices);
    const rulesBefore = structuredClone(rules);
    const historyBefore = [...history];
    const historyStore: ReminderHistoryStore = {
      async getSentStages() {
        return history;
      },
      async recordSent() {},
    };
    const sender: ReminderSender = {
      async send() {},
    };

    await processReminders(
      { invoices, now, rules },
      { historyStore, sender },
    );

    expect(invoices).toEqual(invoicesBefore);
    expect(rules).toEqual(rulesBefore);
    expect(history).toEqual(historyBefore);
  });
});
