export const declarationTabs = [
  ['main', 'Основные'], ['applicant', 'Заявитель'], ['manufacturer', 'Изготовитель'], ['product', 'Продукция'],
  ['regulations', 'ГОСТы/Тех.регламент'], ['application', 'Заявка/Документы'], ['testing', 'Отбор / Испытания (ПИ) / Анализ пр-ва'],
  ['declaration', 'ДЕКЛАРАЦИЯ'], ['appendix-products', 'Приложение Продукция'], ['appendix-addresses', 'Приложение Адреса'],
  ['appendix-standards', 'Приложение ГОСТы'], ['appendix-free', 'Приложение Свободное / Префиксы'], ['closure', 'Опись/Закрытие'],
  ['fgis', 'Публикация ФГИС'], ['scans', 'Сканы'], ['foreign', 'Иностранные документы'],
] as const;
export type DeclarationTab = typeof declarationTabs[number][0];
export interface WorkspaceSection { number: string; date: string | null; content: string; notes: string; completed?: boolean }
export interface WorkspaceAttachment { attachmentId: string; kind: string; section: DeclarationTab; description: string; includeInFgis: boolean }
export interface AddressIdentifier { gln?: string; latitude?: string; longitude?: string }
export interface ManufacturerSite {
  kind: 'Production' | 'Branch'; name: string; country: string; countryCode?: string | null; address: string; identifier: AddressIdentifier | null;
}
export interface DeclarationProductGroup { regulation: string; code: string; name: string }
export interface FgisDraftReference { documentId: string; assignedNumber: string; recordedAtUtc: string; recordedBy: string; cabinetUrl: string; registryUrl: string }
export interface DeclarationWorkspace {
  sections: Partial<Record<DeclarationTab, WorkspaceSection>>;
  files: WorkspaceAttachment[];
  printOverrides?: Record<string, string>;
  authorizedRepresentativeAgreementNumber?: string;
  validityNotEstablished?: boolean;
  copySource?: { id: string; reference: string };
  fgisDraft?: FgisDraftReference;
  manufacturerCountryCode?: string | null;
  manufacturerAddressIdentifier?: AddressIdentifier | null;
  manufacturerSites?: ManufacturerSite[];
  productGroups?: DeclarationProductGroup[];
}
export interface PreparedFgisFile { attachmentId: string; fileName: string; kind: string; section: string; description: string; length: number; sha256: string }
export interface FgisPreparation { id: string; revision: number; preparedAtUtc: string; preparedBy: string; files: PreparedFgisFile[] }
export interface FgisReview { revision: number; connectorConfigured: boolean; connectorMessage: string; missingRequirements: string[]; selectedFiles: number; preparation: FgisPreparation | null; preparationIsCurrent: boolean }
export const fileKinds = [['Application', 'Заявка'], ['Protocol', 'Протокол испытаний'], ['SamplingAct', 'Акт отбора'], ['Contract', 'Договор'], ['Declaration', 'Декларация'], ['Appendix', 'Приложение'], ['Translation', 'Перевод'], ['ApplicantRegistration', 'Регистрационный документ заявителя'], ['Other', 'Другой документ']] as const;
export const emptyWorkspace = (): DeclarationWorkspace => ({ sections: {}, files: [], authorizedRepresentativeAgreementNumber: '', validityNotEstablished: false, manufacturerAddressIdentifier: null, manufacturerSites: [], productGroups: [] });
