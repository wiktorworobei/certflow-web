import { emptyParty, type Party, type Product, type SaveDeclaration } from './types';
import { emptyEvidence } from './evidenceTypes';
import type { DeclarationCatalogProduct } from './marking/lib/honest-sign/catalogTypes';
import type { PermitDocument } from './marking/lib/honest-sign/catalogPermitTypes';

export const catalogProductFields = [
  ['name', 'Наименование продукции'], ['identification', 'Модель, марка, артикул и другие признаки'],
  ['tnVed', 'ТН ВЭД'], ['okpd2', 'ОКПД2'], ['gtin', 'GTIN'], ['storageConditions', 'Условия хранения'],
] as const;
export function catalogProductData(item: DeclarationCatalogProduct): Partial<Product> {
  return { name: item.name, identification: item.identification, tnVed: item.tnved, okpd2: item.okpd2, gtin: item.gtin, storageConditions: item.storageConditions };
}
const present = (value?: string | null) => value?.trim() || undefined;
export function catalogIsoDate(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}
function partyWithName(party: Party, name?: string | null): Party {
  const next = present(name); if (!next) return party;
  if (party.name.trim().replace(/\s+/g, ' ').toLowerCase() === next.replace(/\s+/g, ' ').toLowerCase()) return { ...party, name: next };
  return { ...emptyParty(), country: '', name: next };
}
export function importCatalogDeclaration(current: SaveDeclaration, item: DeclarationCatalogProduct, document: PermitDocument,
  retrievedAtUtc: string, ownerInn?: string): SaveDeclaration {
  if (document.attributeId !== 23557) throw new Error('Выберите декларацию о соответствии.');
  const product = { ...current.product };
  for (const [field] of catalogProductFields) { const value = present(catalogProductData(item)[field]); if (value) product[field] = value; }
  if (present(document.productName)) product.name = document.productName!.trim();
  if (present(document.identification)) product.identification = document.identification!.trim();
  if (document.tnved && /^\d{4,10}$/.test(document.tnved.trim())) product.tnVed = document.tnved.trim();
  const regulations = present(document.regulations)?.split(/\r?\n|;/).map(value => value.trim()).filter(Boolean);
  return { ...current, product,
    applicant: partyWithName(current.applicant, document.applicantName), manufacturer: partyWithName(current.manufacturer, document.manufacturerName),
    regulations: regulations?.length ? [...new Set(regulations)] : current.regulations,
    adoptedAt: catalogIsoDate(document.fromDate) ?? current.adoptedAt, validUntil: catalogIsoDate(document.toDate) ?? current.validUntil,
    evidence: { ...(current.evidence ?? emptyEvidence()), catalogDeclaration: {
      gtin: item.gtin, ownerInn: present(ownerInn) ?? null, number: document.number,
      fromDate: catalogIsoDate(document.fromDate), toDate: catalogIsoDate(document.toDate), status: document.status,
      statusGroup: document.statusGroup, retrievedAtUtc,
    } },
  };
}
