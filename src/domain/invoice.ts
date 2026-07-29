import { createMoney, type Money } from './money.js';

export type InvoiceStatus = 'open' | 'paid' | 'cancelled';

export type Invoice = Readonly<{
  id: string;
  dueDate: Date;
  status: InvoiceStatus;
  totalAmount: Money;
  paidAmount: Money;
  customerEmail?: string;
  remindersEnabled: boolean;
}>;

export function calculateOutstandingAmount(invoice: Invoice): Money {
  if (invoice.totalAmount.currency !== invoice.paidAmount.currency) {
    throw new Error('Total and paid amounts must use the same currency');
  }

  const minorUnits = Math.max(
    invoice.totalAmount.minorUnits - invoice.paidAmount.minorUnits,
    0,
  );

  return createMoney(minorUnits, invoice.totalAmount.currency);
}
