import { api } from './store';
import type { DaDataSettings } from './types';

export interface Okpd2Code { code: string; name: string; section: string; index: string; value: string }
export interface Okpd2Result { items: Okpd2Code[]; retrievedAt: string; fromCache: boolean }
const url = (firmId: string, path: string) => `/firms/${firmId}/classifiers/okpd2/${path}`;
export const okpd2Api = api.injectEndpoints({
  endpoints: b => ({
    okpd2Settings: b.query<DaDataSettings, string>({
      query: id => url(id, 'settings'), providesTags: ['PersonalIntegrations'],
    }),
    okpd2Search: b.query<Okpd2Result, { firmId: string; query: string; section: string; exact: boolean }>({
      query: ({ firmId, query, section, exact }) => ({
        url: url(firmId, exact ? 'find' : 'search'),
        params: exact ? { code: query } : { query, ...(section ? { section } : {}), count: 20 },
      }),
      providesTags: ['PersonalIntegrations'], keepUnusedDataFor: 0,
    }),
  }),
});
