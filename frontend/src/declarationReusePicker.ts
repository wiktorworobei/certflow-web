import { useEffect, useState } from 'react';
import { api } from './store';
import type { DeclarationRow, Status } from './types';

type SearchMode = 'active' | 'archived' | 'editable';

export function declarationChoiceLabel(row: DeclarationRow) {
  return `${row.reference} — ${row.title}`;
}

export function useDeclarationChoices(firmId: string, search: string, mode: SearchMode, excludeId?: string) {
  const normalized = search.trim();
  const [term, setTerm] = useState(normalized);
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(normalized), 250);
    return () => window.clearTimeout(timer);
  }, [normalized]);

  const filters = { search: term || undefined, page: 1, pageSize: 20 };
  const status: Status | undefined = mode === 'editable' ? 'Draft' : mode === 'archived' ? 'Archived' : undefined;
  const primary = api.useDeclarationsQuery({ firmId, filters: { ...filters, status } }, { refetchOnMountOrArgChange: true });
  const review = api.useDeclarationsQuery({ firmId, filters: { ...filters, status: 'InReview' } }, {
    skip: mode !== 'editable', refetchOnMountOrArgChange: true,
  });
  const waiting = normalized !== term;
  const loading = waiting || primary.isFetching || review.isFetching;
  const rows = [...(primary.currentData?.items ?? []), ...(review.currentData?.items ?? [])]
    .filter(row => row.id !== excludeId && (mode !== 'editable' || row.status === 'Draft' || row.status === 'InReview'));
  const uniqueRows = new Map<string, DeclarationRow>();
  for (const row of rows) {
    const previous = uniqueRows.get(row.id);
    if (!previous || previous.revision < row.revision) uniqueRows.set(row.id, row);
  }
  const exactReference = (row: DeclarationRow) => Number(row.reference.toLowerCase() === term.toLowerCase());
  const options = loading ? [] : [...uniqueRows.values()]
    .sort((a, b) => exactReference(b) - exactReference(a) || b.updatedAt.localeCompare(a.updatedAt));

  return {
    options,
    loading,
    error: !waiting && (primary.isError || review.isError),
    retry: () => {
      void primary.refetch();
      if (mode === 'editable') void review.refetch();
    },
  };
}
