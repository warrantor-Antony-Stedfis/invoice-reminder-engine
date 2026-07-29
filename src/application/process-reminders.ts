import type { Invoice } from '../domain/invoice.js';
import { calculateOutstandingAmount } from '../domain/invoice.js';
import type {
  ReminderRule,
  ReminderSkipReason,
  ReminderStage,
} from '../domain/reminder-policy.js';
import type { ReminderHistoryStore } from '../ports/reminder-history-store.js';
import type { ReminderSender } from '../ports/reminder-sender.js';
import { assertValidInvoiceBatch } from './assert-valid-invoice-batch.js';
import { buildReminderPlan } from './build-reminder-plan.js';

export type ReminderProcessingItem =
  | Readonly<{
      invoiceId: string;
      outcome: 'sent';
      stage: ReminderStage;
    }>
  | Readonly<{
      invoiceId: string;
      outcome: 'skipped';
      reason: ReminderSkipReason;
    }>
  | Readonly<{
      invoiceId: string;
      outcome: 'failed';
      stage: ReminderStage;
      error: string;
    }>;

export type ReminderProcessingSummary = Readonly<{
  total: number;
  sent: number;
  skipped: number;
  failed: number;
}>;

export type ReminderProcessingResult = Readonly<{
  items: readonly ReminderProcessingItem[];
  summary: ReminderProcessingSummary;
}>;

export type ProcessRemindersInput = Readonly<{
  invoices: readonly Invoice[];
  now: Date;
  rules: readonly ReminderRule[];
}>;

export type ProcessRemindersDependencies = Readonly<{
  historyStore: ReminderHistoryStore;
  sender: ReminderSender;
}>;

export async function processReminders(
  input: ProcessRemindersInput,
  dependencies: ProcessRemindersDependencies,
): Promise<ReminderProcessingResult> {
  assertValidInvoiceBatch(input.invoices);

  const sentStageEntries = await Promise.all(
    input.invoices.map(async (invoice) => {
      const sentStages = await dependencies.historyStore.getSentStages(
        invoice.id,
      );

      return [invoice.id, sentStages] as const;
    }),
  );
  const sentStagesByInvoice = new Map(sentStageEntries);
  const plan = buildReminderPlan({
    invoices: input.invoices,
    now: input.now,
    rules: input.rules,
    sentStagesByInvoice,
  });
  const items: ReminderProcessingItem[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, planItem] of plan.items.entries()) {
    const invoice = input.invoices[index]!;

    if (planItem.decision.type === 'skip') {
      skipped += 1;
      items.push({
        invoiceId: planItem.invoiceId,
        outcome: 'skipped',
        reason: planItem.decision.reason,
      });
      continue;
    }

    const stage = planItem.decision.stage;

    try {
      const recipient = invoice.customerEmail?.trim();
      if (!recipient) {
        throw new Error('Send decision requires a customer email');
      }

      await dependencies.sender.send({
        idempotencyKey: `${invoice.id}:${stage}`,
        invoiceId: invoice.id,
        recipient,
        stage,
        outstandingAmount: calculateOutstandingAmount(invoice),
      });
      await dependencies.historyStore.recordSent({
        invoiceId: invoice.id,
        stage,
        sentAt: new Date(input.now.getTime()),
      });

      sent += 1;
      items.push({ invoiceId: invoice.id, outcome: 'sent', stage });
    } catch (error: unknown) {
      failed += 1;
      items.push({
        invoiceId: invoice.id,
        outcome: 'failed',
        stage,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    items,
    summary: {
      total: items.length,
      sent,
      skipped,
      failed,
    },
  };
}
