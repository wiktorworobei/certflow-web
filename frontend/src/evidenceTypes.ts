export interface LaboratoryDetails {
  shortName?: string; nationalRegistryId?: string; registryStatus?: string; legalAddress?: string; headName?: string; certificateDocument?: string; supplierCode?: string;
  country: string; type: 'Unknown' | 'Accredited' | 'NonAccredited' | 'Manufacturer';
  accreditationStatus: 'Unknown' | 'Active' | 'Suspended' | 'PartiallySuspended' | 'Revoked' | 'Expired';
  validFrom: string | null; validUntil: string | null; scope: string; registryUrl: string;
  phone: string; email: string; manuallyCheckedAt: string | null; verificationNote: string;
}
export interface ReportDetails extends LaboratoryDetails { laboratoryAddress: string; scopeConfirmed: boolean; attachmentId: string | null; directionId: string | null; comment: string }
export interface TestSample { id: string; name: string; identification: string; quantity: number; unit: string; manufacturedAt: string | null }
export interface EvidenceDocument { id: string; kind: string; number: string; date: string | null; issuer: string; description: string; attachmentId: string | null }
export interface LaboratoryDirection { id: string; number: string; date: string | null; laboratoryName: string; laboratoryAddress: string; accreditationNumber: string; samplingActNumber: string; samplingActDate: string | null; samplingActAttachmentId: string | null; comment: string; samples: TestSample[]; customsDocuments: EvidenceDocument[]; laboratoryCountry?: string; laboratoryType?: LaboratoryDetails['type']; accreditationValidFrom?: string | null; accreditationValidUntil?: string | null; laboratoryCertificateDocument?: string; laboratorySupplierCode?: string }
export interface CatalogDeclarationSource { gtin: string; ownerInn: string | null; number: string; fromDate: string | null; toDate: string | null; status: string | null; statusGroup: number | null; retrievedAtUtc: string }
export interface EvidenceWorkflow { requireScans: boolean; requireAccreditation: boolean; legalBasis: string; standards: string; directions: LaboratoryDirection[]; documents: EvidenceDocument[]; catalogDeclaration?: CatalogDeclarationSource | null }
export const emptyLaboratoryDetails = (): LaboratoryDetails => ({ shortName: '', nationalRegistryId: '', registryStatus: '', legalAddress: '', headName: '', country: 'Россия', type: 'Unknown', accreditationStatus: 'Unknown', validFrom: null, validUntil: null, scope: '', registryUrl: '', phone: '', email: '', manuallyCheckedAt: null, verificationNote: '' });
export const emptyReportDetails = (): ReportDetails => ({ ...emptyLaboratoryDetails(), laboratoryAddress: '', scopeConfirmed: false, attachmentId: null, directionId: null, comment: '' });
export const emptyEvidence = (): EvidenceWorkflow => ({ requireScans: true, requireAccreditation: false, legalBasis: '', standards: '', directions: [], documents: [] });
export const emptyDirection = (): LaboratoryDirection => ({ id: crypto.randomUUID(), number: '', date: null, laboratoryName: '', laboratoryAddress: '', accreditationNumber: '', samplingActNumber: '', samplingActDate: null, samplingActAttachmentId: null, comment: '', samples: [], customsDocuments: [] });
export const emptyEvidenceDocument = (): EvidenceDocument => ({ id: crypto.randomUUID(), kind: 'Other', number: '', date: null, issuer: '', description: '', attachmentId: null });
