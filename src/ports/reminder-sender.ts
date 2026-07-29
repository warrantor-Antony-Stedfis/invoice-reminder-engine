import type { Money } from '../domain/money.js';
import type { ReminderStage } from '../domain/reminder-policy.js';

export type ReminderDelivery = Readonly<{
  idempotencyKey: string;
  invoiceId: string;
  recipient: string;
  stage: ReminderStage;
  outstandingAmount: Money;
}>;

export interface ReminderSender {
  /** Reuse the idempotency key so repeated requests do not create duplicates. */
  send(delivery: ReminderDelivery): Promise<void>;
}
