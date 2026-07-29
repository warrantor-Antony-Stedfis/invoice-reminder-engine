import type { Invoice } from '../domain/invoice.js';
import {
  evaluateReminderDecision,
  type ReminderDecision,
  type ReminderRule,
  type ReminderSkipReason,
  type ReminderStage,
} from '../domain/reminder-policy.js';
import { assertValidInvoiceBatch } from './assert-valid-invoice-batch.js';

export type SentStagesByInvoice = ReadonlyMap<
  string,
  readonly ReminderStage[]
>;

export type ReminderPlanItem = Readonly<{
  invoiceId: string;
  decision: ReminderDecision;
}>;

export type ReminderPlanSummary = Readonly<{
  total: number;
  send: number;
  skipped: number;
  skippedByReason: Readonly<Record<ReminderSkipReason, number>>;
}>;

export type ReminderPlan = Readonly<{
  items: readonly ReminderPlanItem[];
  summary: ReminderPlanSummary;
}>;

export type BuildReminderPlanInput = Readonly<{
  invoices: readonly Invoice[];
  now: Date;
  rules: readonly ReminderRule[];
  sentStagesByInvoice: SentStagesByInvoice;
}>;

export function buildReminderPlan(
  input: BuildReminderPlanInput,
): ReminderPlan {
  assertValidInvoiceBatch(input.invoices);

  const skippedByReason: Record<ReminderSkipReason, number> = {
    'reminders-disabled': 0,
    'invoice-not-open': 0,
    'no-outstanding-balance': 0,
    'missing-customer-email': 0,
    'not-due': 0,
    'already-sent': 0,
  };
  let send = 0;
  let skipped = 0;

  const items = input.invoices.map((invoice): ReminderPlanItem => {
    const decision = evaluateReminderDecision({
      invoice,
      now: input.now,
      rules: input.rules,
      sentStages: input.sentStagesByInvoice.get(invoice.id) ?? [],
    });

    if (decision.type === 'send') {
      send += 1;
    } else {
      skipped += 1;
      skippedByReason[decision.reason] += 1;
    }

    return { invoiceId: invoice.id, decision };
  });

  return {
    items,
    summary: {
      total: items.length,
      send,
      skipped,
      skippedByReason,
    },
  };
}
