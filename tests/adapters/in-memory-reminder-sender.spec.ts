import { describe, expect, it } from 'vitest';

import { InMemoryReminderSender } from '../../src/adapters/in-memory-reminder-sender.js';
import { createMoney } from '../../src/domain/money.js';
import type { ReminderDelivery } from '../../src/ports/reminder-sender.js';

const delivery: ReminderDelivery = {
  idempotencyKey: 'inv-1:first-notice',
  invoiceId: 'inv-1',
  recipient: 'customer@example.com',
  stage: 'first-notice',
  outstandingAmount: createMoney(6_000, 'EUR'),
};

describe('InMemoryReminderSender', () => {
  it('stores the first delivery', async () => {
    const sender = new InMemoryReminderSender();

    await sender.send(delivery);

    expect(sender.getDeliveries()).toEqual([delivery]);
  });

  it('does not duplicate an identical delivery', async () => {
    const sender = new InMemoryReminderSender();

    await sender.send(delivery);
    await sender.send({
      ...delivery,
      outstandingAmount: { ...delivery.outstandingAmount },
    });

    expect(sender.getDeliveries()).toHaveLength(1);
  });

  it('rejects the same key with a different recipient', async () => {
    const sender = new InMemoryReminderSender();
    await sender.send(delivery);

    await expect(
      sender.send({ ...delivery, recipient: 'other@example.com' }),
    ).rejects.toThrow(
      new Error(
        'Idempotency key reused with different delivery: inv-1:first-notice',
      ),
    );
  });

  it('rejects the same key with a different amount', async () => {
    const sender = new InMemoryReminderSender();
    await sender.send(delivery);

    await expect(
      sender.send({
        ...delivery,
        outstandingAmount: createMoney(5_000, 'EUR'),
      }),
    ).rejects.toThrow(
      new Error(
        'Idempotency key reused with different delivery: inv-1:first-notice',
      ),
    );
  });

  it('preserves first-send order for different keys', async () => {
    const sender = new InMemoryReminderSender();
    const secondDelivery: ReminderDelivery = {
      ...delivery,
      idempotencyKey: 'inv-2:first-notice',
      invoiceId: 'inv-2',
      recipient: 'second@example.com',
    };

    await sender.send(delivery);
    await sender.send(secondDelivery);

    expect(
      sender.getDeliveries().map((item) => item.idempotencyKey),
    ).toEqual([
      'inv-1:first-notice',
      'inv-2:first-notice',
    ]);
  });

  it('does not expose internal deliveries', async () => {
    const sender = new InMemoryReminderSender();
    await sender.send(delivery);

    const deliveries = sender.getDeliveries();
    Object.assign(deliveries[0]!, { recipient: 'changed@example.com' });
    Object.assign(deliveries[0]!.outstandingAmount, { minorUnits: 0 });

    expect(sender.getDeliveries()).toEqual([delivery]);
  });
});
