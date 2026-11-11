import { api } from './store';
import type { RegistrySection } from './marketplaceApi';

export interface RegistryWatch {
  declarationId: string; title: string; registrationNumber: string; eligible: boolean; enabled: boolean; section: RegistrySection;
  regDate: string | null; revision: string | null; checkedAtUtc: string | null; attemptedAtUtc: string | null;
  statusLabel: string; statusInRussiaLabel: string; registryUrl: string; lastError: string; sourceEnvironment: string;
}
export interface RegistryMonitoringSummary { enabled: boolean; hour: number; timeZoneId: string; nextRunUtc: string; connectionConfigured: boolean; environment: string; registeredDocuments: number; checkedDocuments: number; failedDocuments: number }
export interface RegistryNotification { id: string; declarationId: string; title: string; message: string; previousStatus: string; currentStatus: string; occurredAtUtc: string; isRead: boolean }
export interface RegistryNotificationPage { items: RegistryNotification[]; total: number; unreadCount: number; page: number; pageSize: number }
const root = (firmId: string) => `/firms/${firmId}/registry-monitoring`;
export const registryMonitoringApi = api.injectEndpoints({ endpoints: b => ({
  registryMonitoringSummary: b.query<RegistryMonitoringSummary, string>({ query: id => `${root(id)}/summary`, providesTags: ['RegistryMonitoring', 'Integrations', 'Declarations'] }),
  registryWatches: b.query<{ items: RegistryWatch[]; total: number; page: number; pageSize: number }, { firmId: string; search?: string; page: number }>({ query: ({ firmId, ...params }) => ({ url: `${root(firmId)}/declarations`, params }), providesTags: ['RegistryMonitoring', 'Declarations'], keepUnusedDataFor: 0 }),
  registryWatch: b.query<RegistryWatch, { firmId: string; id: string }>({ query: ({ firmId, id }) => `${root(firmId)}/declarations/${id}`, providesTags: ['RegistryMonitoring', 'Declarations'], keepUnusedDataFor: 0 }),
  saveRegistryWatch: b.mutation<RegistryWatch, { firmId: string; id: string; enabled: boolean; section: RegistrySection; regDate: string | null; revision: string | null }>({ query: ({ firmId, id, ...body }) => ({ url: `${root(firmId)}/declarations/${id}`, method: 'PUT', body }), invalidatesTags: ['RegistryMonitoring'] }),
  runRegistryCheck: b.mutation<RegistryWatch, { firmId: string; id: string }>({ query: ({ firmId, id }) => ({ url: `${root(firmId)}/declarations/${id}/check`, method: 'POST' }), invalidatesTags: ['RegistryMonitoring', 'RegistryNotifications'] }),
  registryNotifications: b.query<RegistryNotificationPage, { firmId: string; unreadOnly?: boolean; page?: number; pageSize?: number }>({ query: ({ firmId, ...params }) => ({ url: `${root(firmId)}/notifications`, params }), providesTags: ['RegistryNotifications'], keepUnusedDataFor: 0 }),
  readRegistryNotification: b.mutation<void, { firmId: string; id?: string }>({ query: ({ firmId, id }) => ({ url: `${root(firmId)}/notifications/${id ? `${id}/read` : 'read-all'}`, method: 'POST' }), invalidatesTags: ['RegistryNotifications'] }),
}) });
