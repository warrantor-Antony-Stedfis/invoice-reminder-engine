import type { ReminderStage } from '../domain/reminder-policy.js';

export type RecordSentReminderInput = Readonly<{
  invoiceId: string;
  stage: ReminderStage;
  sentAt: Date;
}>;

export interface ReminderHistoryStore {
  getSentStages(invoiceId: string): Promise<readonly ReminderStage[]>;
  recordSent(input: RecordSentReminderInput): Promise<void>;
}
