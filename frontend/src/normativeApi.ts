import { api } from './store';

export type NormativeKind = 'Standard' | 'TechnicalRegulation';
export interface NormativeDocument {
  id: string; firmId: string; kind: NormativeKind; designation: string; name: string; status: string; notes: string;
  sourceUrl: string; sourceKey: string | null; sourceProvider: string; sourceDesignation: string; sourceName: string; sourceStatus: string;
  sourceCheckedAt: string | null; isManuallyEdited: boolean; updatedAt: string; updatedBy: string; revision: string;
}
export type NormativeInput = Pick<NormativeDocument, 'kind' | 'designation' | 'name' | 'status' | 'notes' | 'sourceUrl'> & { revision?: string };
export interface NormativeSourceItem { sourceKey: string; kind: NormativeKind; designation: string; name: string; status: string; sourceUrl: string }
export interface NormativeResult { items: NormativeDocument[]; total: number; page: number; pageSize: number }
export interface NormativeSourceResult { items: NormativeSourceItem[]; total: number; page: number; pageSize: number; checkedAt: string; provider: string }
export interface NormativeSourceSearch { firmId: string; kind: NormativeKind; query: string; page: number }
const base = (id: string) => `/firms/${id}/normative-documents`;
export const normativeApi = api.enhanceEndpoints({ addTagTypes: ['Normative'] }).injectEndpoints({
  endpoints: b => ({
    normativeSearch: b.query<NormativeResult, { firmId: string; kind?: string; query: string; page: number; pageSize?: number }>({
      query: ({ firmId, ...params }) => ({ url: base(firmId), params }), providesTags: (_, __, a) => [{ type: 'Normative', id: a.firmId }],
    }),
    normativeSource: b.query<NormativeSourceResult, NormativeSourceSearch>({ query: ({ firmId, ...params }) => ({ url: `${base(firmId)}/source`, params }) }),
    saveNormative: b.mutation<NormativeDocument, { firmId: string; id?: string; data: NormativeInput }>({
      query: ({ firmId, id, data }) => ({ url: `${base(firmId)}${id ? `/${id}` : ''}`, method: id ? 'PUT' : 'POST', body: data }),
      invalidatesTags: (_, __, a) => [{ type: 'Normative', id: a.firmId }],
    }),
    importNormative: b.mutation<{ added: number; existing: number }, NormativeSourceSearch & { sourceKeys: string[] }>({
      query: ({ firmId, ...body }) => ({ url: `${base(firmId)}/import`, method: 'POST', body }), invalidatesTags: (_, __, a) => [{ type: 'Normative', id: a.firmId }],
    }),
    refreshNormative: b.mutation<NormativeDocument, { firmId: string; id: string; revision: string }>({
      query: ({ firmId, id, revision }) => ({ url: `${base(firmId)}/${id}/refresh`, method: 'POST', body: { revision } }),
      invalidatesTags: (_, __, a) => [{ type: 'Normative', id: a.firmId }],
    }),
    deleteNormative: b.mutation<void, { firmId: string; id: string; revision: string }>({
      query: ({ firmId, id, revision }) => ({ url: `${base(firmId)}/${id}`, method: 'DELETE', params: { revision } }),
      invalidatesTags: (_, __, a) => [{ type: 'Normative', id: a.firmId }],
    }),
  }),
});
export const normativeKinds: Record<NormativeKind, string> = { Standard: 'ГОСТ / ГОСТ Р / ПНСТ', TechnicalRegulation: 'Технический регламент' };
export const normativeLabel = (row: Pick<NormativeDocument, 'designation' | 'name'>) => `${row.designation} «${row.name}»`;
