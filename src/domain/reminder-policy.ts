import {
  calculateOutstandingAmount,
  type Invoice,
} from './invoice.js';

export type ReminderStage =
  | 'friendly-reminder'
  | 'payment-reminder'
  | 'first-notice'
  | 'second-notice'
  | 'final-notice';

export type ReminderRule = Readonly<{
  stage: ReminderStage;
  offsetDays: number;
}>;

export type ReminderSkipReason =
  | 'reminders-disabled'
  | 'invoice-not-open'
  | 'no-outstanding-balance'
  | 'missing-customer-email'
  | 'not-due'
  | 'already-sent';

export type ReminderDecision =
  | Readonly<{
      type: 'send';
      stage: ReminderStage;
    }>
  | Readonly<{
      type: 'skip';
      reason: ReminderSkipReason;
    }>;

export type EvaluateReminderInput = Readonly<{
  invoice: Invoice;
  now: Date;
  rules: readonly ReminderRule[];
  sentStages: readonly ReminderStage[];
}>;

const millisecondsPerDay = 24 * 60 * 60 * 1_000;

export function evaluateReminderDecision(
  input: EvaluateReminderInput,
): ReminderDecision {
  if (!input.invoice.remindersEnabled) {
    return { type: 'skip', reason: 'reminders-disabled' };
  }

  if (input.invoice.status !== 'open') {
    return { type: 'skip', reason: 'invoice-not-open' };
  }

  if (calculateOutstandingAmount(input.invoice).minorUnits === 0) {
    return { type: 'skip', reason: 'no-outstanding-balance' };
  }

  if (!input.invoice.customerEmail?.trim()) {
    return { type: 'skip', reason: 'missing-customer-email' };
  }

  const nowTime = input.now.getTime();
  if (Number.isNaN(nowTime)) {
    throw new RangeError('now must be a valid Date');
  }

  const dueTime = input.invoice.dueDate.getTime();
  if (Number.isNaN(dueTime)) {
    throw new RangeError('invoice dueDate must be a valid Date');
  }

  const elapsedDays =
    Math.floor(nowTime / millisecondsPerDay) -
    Math.floor(dueTime / millisecondsPerDay);
  const seenOffsetDays = new Set<number>();

  for (const rule of input.rules) {
    if (!Number.isSafeInteger(rule.offsetDays)) {
      throw new RangeError(
        `offsetDays for ${rule.stage} must be a safe integer`,
      );
    }

    if (seenOffsetDays.has(rule.offsetDays)) {
      throw new RangeError(
        `Reminder rules must not contain duplicate offsetDays: ${rule.offsetDays}`,
      );
    }

    seenOffsetDays.add(rule.offsetDays);
  }

  let selectedRule: ReminderRule | undefined;

  for (const rule of input.rules) {
    if (
      rule.offsetDays <= elapsedDays &&
      (selectedRule === undefined ||
        rule.offsetDays > selectedRule.offsetDays)
    ) {
      selectedRule = rule;
    }
  }

  if (selectedRule === undefined) {
    return { type: 'skip', reason: 'not-due' };
  }

  if (input.sentStages.includes(selectedRule.stage)) {
    return { type: 'skip', reason: 'already-sent' };
  }

  return { type: 'send', stage: selectedRule.stage };
}
