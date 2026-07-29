import type { Invoice } from '../domain/invoice.js';

export function assertValidInvoiceBatch(
  invoices: readonly Invoice[],
): void {
  const invoiceIds = new Set<string>();

  for (const invoice of invoices) {
    if (!invoice.id.trim()) {
      throw new Error('Invoice id must not be empty');
    }

    if (invoiceIds.has(invoice.id)) {
      throw new Error(`Duplicate invoice id: ${invoice.id}`);
    }

    invoiceIds.add(invoice.id);
  }
}
