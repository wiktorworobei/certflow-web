import { api } from './store';

export interface TnVedNode {
  id: number; code: string | null; text: string; validFrom: string | null; validTo: string | null;
  hasChildren: boolean; isActive: boolean;
}
export interface TnVedResult {
  items: TnVedNode[]; retrievedAt: string; fromCache: boolean; truncated: boolean;
}
const url = (firmId: string, path: string) => `/firms/${firmId}/classifiers/tnved/${path}`;
export const tnvedApi = api.injectEndpoints({
  endpoints: b => ({
    tnVedSettings: b.query<{ isConfigured: boolean; provider: string }, string>({ query: id => url(id, 'settings') }),
    tnVedTree: b.query<TnVedResult, { firmId: string; parentId: number }>({
      query: ({ firmId, parentId }) => ({ url: url(firmId, 'tree'), params: { parentId } }), keepUnusedDataFor: 300,
    }),
    tnVedSearch: b.query<TnVedResult, { firmId: string; query: string }>({
      query: ({ firmId, query }) => ({ url: url(firmId, 'search'), params: { query } }), keepUnusedDataFor: 60,
    }),
  }),
});
