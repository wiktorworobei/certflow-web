import { api } from './store';

export interface TnVedCode { code: string; text: string; tariff: string; detailsUrl: string }
export interface TnVedSettings {
  isConfigured: boolean; provider: string; codeCount: number; dataDate: string | null;
  sourceFile: string | null; importedAt: string | null;
}
export interface TnVedResult { items: TnVedCode[]; total: number; page: number; pageSize: number }
const url = (firmId: string, path: string) => `/firms/${firmId}/classifiers/tnved/${path}`;
export const tnvedApi = api.injectEndpoints({
  endpoints: b => ({
    tnVedSettings: b.query<TnVedSettings, string>({ query: id => url(id, 'settings') }),
    tnVedSearch: b.query<TnVedResult, { firmId: string; query: string; page: number }>({
      query: ({ firmId, query, page }) => ({ url: url(firmId, 'search'), params: { query, page, pageSize: 25 } }), keepUnusedDataFor: 60,
    }),
  }),
});
