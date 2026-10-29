import { test, expect } from '@playwright/test';
import { emptyDeclaration } from '../src/types';
import { catalogIsoDate, importCatalogDeclaration } from '../src/declarationCatalogImport';
import type { DeclarationCatalogProduct } from '../src/marking/lib/honest-sign/catalogTypes';
import type { PermitDocument } from '../src/marking/lib/honest-sign/catalogPermitTypes';

const product: DeclarationCatalogProduct = { gtin: '05011846021161', name: 'Товар карточки', brand: '', tnved: '2710', identification: '', okpd2: '', storageConditions: '', status: 'published' };
const permit: PermitDocument = { attributeId: 23557, number: 'ЕАЭС TEST-1', fromDate: '2026-10-01', toDate: '2027-10-01', productName: 'Продукция декларации', applicantName: 'Новый заявитель', manufacturerName: 'Завод', tnved: '2710198200', identification: 'Артикул 123', regulations: 'ТР ТС 030/2012; ТР ТС 030/2012', status: 'Действует', statusGroup: 1, active: null, updatedAt: null };
const retrieved = '2026-10-29T10:00:00Z';

test('NK declaration import explicitly maps source fields and clears unrelated company requisites', () => {
  const current = emptyDeclaration(); current.applicant.name = 'Прежняя компания'; current.applicant.inn = '7707083893'; current.applicant.phone = 'old phone';
  current.manufacturer.name = 'Завод'; current.manufacturer.address = 'Адрес завода'; current.product.batchDetails = 'Партия 17';
  current.product.okpd2 = '19.20'; current.reports = [{ number: 'Протокол', date: null, laboratoryName: 'Лаборатория', accreditationNumber: '' }];
  const result = importCatalogDeclaration(current, product, permit, retrieved);
  expect(result.product).toMatchObject({ name: permit.productName, identification: 'Артикул 123', tnVed: '2710198200', batchDetails: 'Партия 17', okpd2: '19.20' });
  expect(result.applicant).toMatchObject({ name: 'Новый заявитель', inn: '', phone: '', country: '' });
  expect(result.manufacturer.address).toBe('Адрес завода'); expect(result.regulations).toEqual(['ТР ТС 030/2012']);
  expect(result.adoptedAt).toBe('2026-10-01'); expect(result.validUntil).toBe('2027-10-01'); expect(result.reports).toEqual(current.reports);
  expect(result.evidence?.catalogDeclaration).toMatchObject({ number: permit.number, ownerInn: null, gtin: product.gtin, retrievedAtUtc: retrieved });
  expect(current.applicant.phone).toBe('old phone'); expect(current.evidence?.catalogDeclaration).toBeUndefined();
  expect(result).not.toHaveProperty('registrationNumber'); expect(result).not.toHaveProperty('status');
});

test('incomplete NK data keeps existing dates, parties and regulations and rejects unsuitable TN VED', () => {
  const current = emptyDeclaration(); current.adoptedAt = '2026-09-01'; current.validUntil = '2028-01-01'; current.applicant.name = 'Ручной заявитель'; current.regulations = ['Ручной регламент'];
  const result = importCatalogDeclaration(current, product, { ...permit, fromDate: '2026-02-30', toDate: null, applicantName: null, manufacturerName: null, regulations: null, tnved: '2710, 3403' }, retrieved, '7707083893');
  expect(result.adoptedAt).toBe(current.adoptedAt); expect(result.validUntil).toBe(current.validUntil); expect(result.applicant).toEqual(current.applicant);
  expect(result.regulations).toEqual(current.regulations); expect(result.product.tnVed).toBe('2710'); expect(result.evidence?.catalogDeclaration?.ownerInn).toBe('7707083893');
  expect(catalogIsoDate('2026-02-30')).toBeNull();
  expect(() => importCatalogDeclaration(current, product, { ...permit, attributeId: 23561 }, retrieved)).toThrow();
});
