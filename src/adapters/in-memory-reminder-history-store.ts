import type {
  RecordSentReminderInput,
  ReminderHistoryStore,
} from '../ports/reminder-history-store.js';

export class InMemoryReminderHistoryStore
  implements ReminderHistoryStore
{
  private readonly records: RecordSentReminderInput[] = [];

  async getSentStages(invoiceId: string) {
    return this.records
      .filter((record) => record.invoiceId === invoiceId)
      .map((record) => record.stage);
  }

  async recordSent(input: RecordSentReminderInput): Promise<void> {
    const alreadyRecorded = this.records.some(
      (record) =>
        record.invoiceId === input.invoiceId &&
        record.stage === input.stage,
    );

    if (alreadyRecorded) {
      return;
    }

    this.records.push({
      ...input,
      sentAt: new Date(input.sentAt.getTime()),
    });
  }

  getRecords(): readonly RecordSentReminderInput[] {
    return this.records.map((record) => ({
      ...record,
      sentAt: new Date(record.sentAt.getTime()),
    }));
  }
}
