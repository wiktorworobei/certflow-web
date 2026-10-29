import { emptyEvidence, type EvidenceWorkflow, type LaboratoryDetails, type ReportDetails } from './evidenceTypes';

export type Status = 'Draft' | 'InReview' | 'Ready' | 'Registered' | 'Suspended' | 'Revoked' | 'Archived';
export type ArchiveAction = 'archive' | 'purge' | 'restore';
export type Role = 'Admin' | 'Manager' | 'Viewer';
export interface Firm { id: string; name: string; inn: string; role: Role }
export interface Profile { id: string; userName: string; displayName: string; email: string; firms: Firm[] }
export interface AuthResponse { accessToken: string; expiresAt: string; user: Profile }
export interface Party { name: string; inn: string; ogrn: string; kpp: string; country: string; address: string; email: string; phone: string; signatory: string; position: string; shortName: string; legalForm: string; registrationDate: string | null; registrationAuthority: string; managerName: string; managerPosition: string }
export interface Product { name: string; identification: string; tnVed: string; okpd2: string; gtin: string; productionType: 'Serial' | 'Batch' | 'Single'; batchDetails: string; storageConditions: string }
export interface Report { number: string; date: string | null; laboratoryName: string; accreditationNumber: string; id?: string; details?: ReportDetails }
export interface Attachment { id: string; fileName: string; contentType: string; length: number; createdAt: string }
export interface DocumentEvent { occurredAt: string; actor: string; description: string }
export interface DeclarationRow { id: string; reference: string; title: string; kind: string; status: Status; applicant: string; manufacturer: string; product: string; tnVed: string; registrationNumber: string; validUntil: string | null; updatedAt: string; isSample: boolean; revision: number }
export interface SaveDeclaration { title: string; kind: string; scheme: string; applicant: Party; manufacturer: Party; product: Product; regulations: string[]; additionalInfo: string; adoptedAt: string | null; validUntil: string | null; reports: Report[]; revision: number; evidence?: EvidenceWorkflow }
export interface Declaration extends SaveDeclaration { id: string; reference: string; status: Status; registrationNumber: string; registryUrl: string; createdAt: string; updatedAt: string; isSample: boolean; attachments: Attachment[]; events: DocumentEvent[]; missingRequirements: string[] }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface Filters { search?: string; status?: Status; page?: number; pageSize?: number; expiring?: boolean }
export interface Activity { declarationId: string; reference: string; title: string; occurredAt: string; actor: string; description: string }
export interface Dashboard { total: number; draft: number; inReview: number; ready: number; registered: number; expiring: number; suspended: number; organizations: number; recent: DeclarationRow[]; expiringDocuments: DeclarationRow[]; activity: Activity[] }
export type OrganizationInput = Party & { kind: 'Applicant' | 'Manufacturer' | 'Both'; autoRefresh?: boolean; replaceFromDaData?: boolean; manuallyEditedFields?: (keyof Party)[]; existingOrganizationId?: string };
export interface Organization extends Party { id: string; firmId: string; kind: OrganizationInput['kind']; revision: string; isArchived: boolean; archivedAt?: string | null; archivedBy?: string; archiveComment?: string; autoRefresh?: boolean; registryStatus?: string; dataInvalid?: boolean; registryCheckedAt?: string | null; registryAttemptedAt?: string | null; registryError?: string; manuallyEditedFields?: (keyof Party)[] }
export type LaboratoryRecordKind = 'Laboratory' | 'CertificationBody' | 'InspectionBody' | 'Unspecified';
export interface LaboratoryRegistryRecord { key: string; rowNumber: number; recordKind: LaboratoryRecordKind; country: string; nationalId: string; name: string; registryStatus: string; accreditationStatus: string; accreditationNumber: string; registeredAt: string | null; validUntil: string | null; legalAddress: string; activityAddress: string; headName: string; phone: string; scope: string; registryUrl: string }
export interface Laboratory { id: string; firmId: string; name: string; accreditationNumber: string; address: string; details?: LaboratoryDetails; recordKind?: LaboratoryRecordKind; country?: string; accreditationStatus?: string; revision?: string; registrySource?: { fileName: string; sha256: string; importedAtUtc: string; original: LaboratoryRegistryRecord } | null; manuallyEditedFields?: string[]; manuallyEditedAt?: string | null; manuallyEditedBy?: string }
export interface LaboratoryFilters { firmId: string; search?: string; country?: string; recordKind?: LaboratoryRecordKind | 'All'; status?: string; page?: number; pageSize?: number }
export interface TeamUser { id: string; userName: string; displayName: string; email: string; role: Role }
export interface Integration { id: string; name: string; status: 'NotConfigured' | 'Configured'; description: string }
export interface OrganizationCandidate { name: string; inn: string; ogrn: string; kpp: string; address: string; type: string; branchType: string; status: string; managerName: string; managerPosition: string; dataInvalid: boolean; shortName: string; legalForm: string; registrationDate: string | null; registrationAuthority: string; standardizedAddress: string; phone?: string; email?: string }
export interface OrganizationLookupResult { items: OrganizationCandidate[]; retrievedAt: string; fromCache: boolean }
export type OrganizationRequisites = Party;
export interface DaDataSettings { enabled: boolean; hasPersonalKey: boolean; isConfigured: boolean; source: 'Personal' | 'Server' | 'None'; updatedAt: string | null; verifiedAt: string | null }
export interface MarkingSettings { profile: 'Sandbox' | 'Production'; omsId: string; connectionId: string; participantInn: string; updatedAtUtc: string | null }
export interface MarkingConnections { profile: string; chz: { dateModified: string; expiresAtUtc: string } | null; dmKod: { environment: 'TEST' | 'PROD'; dateModified: string; accessTokenExpiresAtUtc: string; honestSignConnectedAtUtc: string | null }[] }
export interface MarkingLink { id: string; declarationId: string; declarationReference: string; declarationTitle: string; registrationNumber: string; gtin: string; productName: string; provider: 'ChZ' | 'DMkod'; environment: string; externalOrderId: string; batchNumber: string; codesDocumentId: string | null; createdAtUtc: string }
export interface SaveMarkingLink { declarationId: string; gtin: string; provider: 'ChZ' | 'DMkod'; environment: string; externalOrderId: string; batchNumber: string; codesDocumentId?: string | null }
export interface MarkingBatch { id: string; title: string; uploadedAtUtc: string; compositionConfirmed: boolean; codes: number; boxes: number; pallets: number; declarations: Omit<MarkingLink, 'codesDocumentId' | 'createdAtUtc' | 'productName'>[] }
export interface MarkingBatchCode { sequenceNumber: number; code: string; status: string; boxSscc: string | null; palletSscc: string | null }
export interface ImportMarkingBatch { id: string; declarationId: string; title: string; gtin: string; batchNumber: string; externalOrderId: string; physicalOutcomesConfirmed: boolean; codes: string[] }

export const statusLabels: Record<Status, string> = { Draft: 'Черновик', InReview: 'На проверке', Ready: 'Готова к регистрации', Registered: 'Зарегистрирована', Suspended: 'Приостановлена', Revoked: 'Прекращена', Archived: 'В архиве' };
export const roleLabels: Record<Role, string> = { Admin: 'Администратор', Manager: 'Специалист', Viewer: 'Наблюдатель' };
export const emptyParty = (): Party => ({ shortName: '', legalForm: '', registrationDate: null, registrationAuthority: '', managerName: '', managerPosition: '', name: '', inn: '', ogrn: '', kpp: '', country: 'Россия', address: '', email: '', phone: '', signatory: '', position: '' });
export const emptyDeclaration = (): SaveDeclaration => ({ title: '', kind: 'Декларация ТР ЕАЭС', scheme: '1д', applicant: emptyParty(), manufacturer: emptyParty(), product: { name: '', identification: '', tnVed: '', okpd2: '', gtin: '', productionType: 'Serial', batchDetails: '', storageConditions: '' }, regulations: [], additionalInfo: '', adoptedAt: null, validUntil: null, reports: [], revision: 0, evidence: emptyEvidence() });
export const date = (value?: string | null) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('ru-RU') : '—';
export const dateTime = (value: string) => new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export function errorMessage(error: unknown): string {
  const e = error as { data?: { detail?: string; errors?: Record<string, string[]> }; status?: number; message?: string };
  if (e.data?.errors) return [...new Set(Object.values(e.data.errors).flat())].join(' ');
  if (e.data?.detail) return e.data.detail;
  if (e.status === 429) return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  return 'Не удалось выполнить запрос. Проверьте подключение и повторите попытку.';
}
