import { describe, expect, it } from 'vitest';

import { InMemoryReminderHistoryStore } from '../../src/adapters/in-memory-reminder-history-store.js';

describe('InMemoryReminderHistoryStore', () => {
  it('starts with empty history', async () => {
    const store = new InMemoryReminderHistoryStore();

    await expect(store.getSentStages('inv-1')).resolves.toEqual([]);
    expect(store.getRecords()).toEqual([]);
  });

  it('returns a recorded stage', async () => {
    const store = new InMemoryReminderHistoryStore();

    await store.recordSent({
      invoiceId: 'inv-1',
      stage: 'friendly-reminder',
      sentAt: new Date('2026-07-07T12:00:00.000Z'),
    });

    await expect(store.getSentStages('inv-1')).resolves.toEqual([
      'friendly-reminder',
    ]);
  });

  it('does not duplicate the same stage for an invoice', async () => {
    const store = new InMemoryReminderHistoryStore();

    await store.recordSent({
      invoiceId: 'inv-1',
      stage: 'friendly-reminder',
      sentAt: new Date('2026-07-07T12:00:00.000Z'),
    });
    await store.recordSent({
      invoiceId: 'inv-1',
      stage: 'friendly-reminder',
      sentAt: new Date('2026-07-08T12:00:00.000Z'),
    });

    expect(store.getRecords()).toHaveLength(1);
  });

  it('preserves stage recording order for an invoice', async () => {
    const store = new InMemoryReminderHistoryStore();

    await store.recordSent({
      invoiceId: 'inv-1',
      stage: 'friendly-reminder',
      sentAt: new Date('2026-07-07T12:00:00.000Z'),
    });
    await store.recordSent({
      invoiceId: 'inv-1',
      stage: 'first-notice',
      sentAt: new Date('2026-07-18T12:00:00.000Z'),
    });

    await expect(store.getSentStages('inv-1')).resolves.toEqual([
      'friendly-reminder',
      'first-notice',
    ]);
  });

  it('keeps histories independent between invoices', async () => {
    const store = new InMemoryReminderHistoryStore();

    await store.recordSent({
      invoiceId: 'inv-1',
      stage: 'friendly-reminder',
      sentAt: new Date('2026-07-07T12:00:00.000Z'),
    });
    await store.recordSent({
      invoiceId: 'inv-2',
      stage: 'first-notice',
      sentAt: new Date('2026-07-18T12:00:00.000Z'),
    });

    await expect(store.getSentStages('inv-1')).resolves.toEqual([
      'friendly-reminder',
    ]);
    await expect(store.getSentStages('inv-2')).resolves.toEqual([
      'first-notice',
    ]);
  });

  it('stores sentAt as a separate Date', async () => {
    const store = new InMemoryReminderHistoryStore();
    const sentAt = new Date('2026-07-07T12:00:00.000Z');

    await store.recordSent({
      invoiceId: 'inv-1',
      stage: 'friendly-reminder',
      sentAt,
    });
    sentAt.setUTCFullYear(2030);

    expect(store.getRecords()[0]?.sentAt).toEqual(
      new Date('2026-07-07T12:00:00.000Z'),
    );
  });

  it('does not expose internal records', async () => {
    const store = new InMemoryReminderHistoryStore();

    await store.recordSent({
      invoiceId: 'inv-1',
      stage: 'friendly-reminder',
      sentAt: new Date('2026-07-07T12:00:00.000Z'),
    });

    const records = store.getRecords();
    Object.assign(records[0]!, { invoiceId: 'changed' });
    records[0]!.sentAt.setUTCFullYear(2030);

    expect(store.getRecords()).toEqual([
      {
        invoiceId: 'inv-1',
        stage: 'friendly-reminder',
        sentAt: new Date('2026-07-07T12:00:00.000Z'),
      },
    ]);
  });
});
