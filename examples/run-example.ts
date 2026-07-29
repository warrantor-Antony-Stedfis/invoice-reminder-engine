import {
  createMoney,
  InMemoryReminderHistoryStore,
  InMemoryReminderSender,
  processReminders,
  type Invoice,
  type ReminderRule,
} from '../src/index.js';

const now = new Date('2026-07-18T12:00:00.000Z');

const rules: readonly ReminderRule[] = [
  { stage: 'friendly-reminder', offsetDays: -3 },
  { stage: 'payment-reminder', offsetDays: 1 },
  { stage: 'first-notice', offsetDays: 7 },
];

const invoices: readonly Invoice[] = [
  {
    id: 'inv-open',
    dueDate: new Date('2026-07-10T00:00:00.000Z'),
    status: 'open',
    totalAmount: createMoney(10_000, 'EUR'),
    paidAmount: createMoney(4_000, 'EUR'),
    customerEmail: 'customer@example.com',
    remindersEnabled: true,
  },
  {
    id: 'inv-paid',
    dueDate: new Date('2026-07-10T00:00:00.000Z'),
    status: 'paid',
    totalAmount: createMoney(10_000, 'EUR'),
    paidAmount: createMoney(10_000, 'EUR'),
    customerEmail: 'paid@example.com',
    remindersEnabled: true,
  },
  {
    id: 'inv-disabled',
    dueDate: new Date('2026-07-10T00:00:00.000Z'),
    status: 'open',
    totalAmount: createMoney(10_000, 'EUR'),
    paidAmount: createMoney(4_000, 'EUR'),
    customerEmail: 'disabled@example.com',
    remindersEnabled: false,
  },
];

const historyStore = new InMemoryReminderHistoryStore();
const sender = new InMemoryReminderSender();
const input = { invoices, now, rules };
const dependencies = { historyStore, sender };

const firstRun = await processReminders(input, dependencies);
const secondRun = await processReminders(input, dependencies);

console.log(
  JSON.stringify(
    {
      firstRun,
      secondRun,
      deliveries: sender.getDeliveries(),
      history: historyStore.getRecords(),
    },
    null,
    2,
  ),
);
