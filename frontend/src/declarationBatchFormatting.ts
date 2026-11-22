import type { ShippingDocument } from './types';

export function formatShippingDocuments(documents: ShippingDocument[] | undefined): string {
  return (documents ?? [])
    .map((document) => {
      const number = document.number?.trim();
      return [
        document.name?.trim(),
        number && `№ ${number}`,
        document.date && `от ${document.date.split('-').reverse().join('.')}`,
      ]
        .filter(Boolean)
        .join(' ');
    })
    .filter(Boolean)
    .join(', ');
}
