import type {
  ReminderDelivery,
  ReminderSender,
} from '../ports/reminder-sender.js';

export class InMemoryReminderSender implements ReminderSender {
  private readonly deliveries = new Map<string, ReminderDelivery>();

  async send(delivery: ReminderDelivery): Promise<void> {
    const existing = this.deliveries.get(delivery.idempotencyKey);

    if (existing) {
      const isIdentical =
        existing.invoiceId === delivery.invoiceId &&
        existing.recipient === delivery.recipient &&
        existing.stage === delivery.stage &&
        existing.outstandingAmount.minorUnits ===
          delivery.outstandingAmount.minorUnits &&
        existing.outstandingAmount.currency ===
          delivery.outstandingAmount.currency;

      if (isIdentical) {
        return;
      }

      throw new Error(
        `Idempotency key reused with different delivery: ${delivery.idempotencyKey}`,
      );
    }

    this.deliveries.set(delivery.idempotencyKey, {
      ...delivery,
      outstandingAmount: { ...delivery.outstandingAmount },
    });
  }

  getDeliveries(): readonly ReminderDelivery[] {
    return [...this.deliveries.values()].map((delivery) => ({
      ...delivery,
      outstandingAmount: { ...delivery.outstandingAmount },
    }));
  }
}
