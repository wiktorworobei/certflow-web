import { api } from './store';
import type { Declaration } from './types';
import type { FgisReview } from './workspaceTypes';

export const fgisApi = api.injectEndpoints({ endpoints: b => ({
  fgisReview: b.query<FgisReview, { firmId: string; id: string }>({ query: ({ firmId, id }) => `/firms/${firmId}/declarations/${id}/fgis`, providesTags: ['Declarations'] }),
  prepareFgis: b.mutation<Declaration, { firmId: string; id: string; revision: number }>({ query: ({ firmId, id, revision }) => ({ url: `/firms/${firmId}/declarations/${id}/fgis/prepare`, method: 'POST', body: { revision } }), invalidatesTags: ['Declarations'] }),
}) });
