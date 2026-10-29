import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@marking/components/ui/button';
import { Input } from '@marking/components/ui/input';
import { Label } from '@marking/components/ui/label';
import { Notice } from '@marking/components/honest-sign/ui/notice';
import { CatalogErrorDetails } from './CatalogErrorDetails';
import { catalogApiService } from '@marking/lib/honest-sign/catalogApiService';
import type { PermitLookup } from '@marking/lib/honest-sign/catalogPermitTypes';

export function CatalogPermitsPanel({ companyId }: { companyId: string }) {
    const { t } = useTranslation();
    const label = (key: string) => t(`honestSign.catalog.permits.${key}`);
    const [mode, setMode] = useState('document');
    const [attributeId, setAttribute] = useState('23557');
    const [number, setNumber] = useState(''); const [date, setDate] = useState('');
    const [gtin, setGtin] = useState(''); const [inn, setInn] = useState('');
    const [busy, setBusy] = useState(false); const [error, setError] = useState<Error | null>(null);
    const [result, setResult] = useState<PermitLookup | null>(null);
    const pending = useRef<AbortController | null>(null);
    useEffect(() => () => pending.current?.abort(), [companyId]);
    const search = async (event: FormEvent) => {
        event.preventDefault(); if (busy) return;
        const controller = new AbortController(); pending.current = controller;
        setBusy(true); setError(null); setResult(null);
        try {
            const response = mode === 'document'
                ? await catalogApiService.permitsByDocument(companyId, [{ attributeId: Number(attributeId), number: number.trim(), ...(attributeId !== '23765' ? { date } : {}) }], controller.signal)
                : await catalogApiService.permitsByProduct(companyId, gtin.trim(), inn.trim(), controller.signal);
            if (!controller.signal.aborted) setResult(response);
        } catch (cause) {
            if (!controller.signal.aborted) setError(cause instanceof Error ? cause : new Error(label('failed')));
        } finally { if (!controller.signal.aborted) setBusy(false); }
    };
    return <section className="min-w-0 space-y-4" aria-label={label('title')}>
        <Notice>{label('description')}</Notice>
        <form onSubmit={search} className="space-y-4 rounded-xl border p-4" aria-label={label('searchForm')}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="permit-mode">{label('mode')}</Label>
                    <select id="permit-mode" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={mode} disabled={busy} onChange={e => { setMode(e.target.value); setResult(null); setError(null); }}>
                        <option value="document">{label('byDocument')}</option><option value="product">{label('byProduct')}</option>
                    </select></div>
                {mode === 'document' ? <>
                    <div className="space-y-2"><Label htmlFor="permit-type">{label('type')}</Label>
                        <select id="permit-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={busy} value={attributeId} onChange={e => setAttribute(e.target.value)}>
                            <option value="23557">{label('declaration')}</option><option value="23561">{label('certificate')}</option><option value="23765">{label('sgr')}</option>
                        </select></div>
                    <div className="space-y-2"><Label htmlFor="permit-number">{label('number')}</Label><Input id="permit-number" value={number} onChange={e => setNumber(e.target.value)} required maxLength={256} disabled={busy} /></div>
                    {attributeId !== '23765' && <div className="space-y-2"><Label htmlFor="permit-date">{label('date')}</Label><Input id="permit-date" type="date" required value={date} onChange={e => setDate(e.target.value)} disabled={busy} /></div>}
                </> : <>
                    <div className="space-y-2"><Label htmlFor="permit-gtin">GTIN</Label><Input id="permit-gtin" inputMode="numeric" required pattern="([0-9]{8}|[0-9]{12,14})" value={gtin} onChange={e => setGtin(e.target.value)} disabled={busy} /></div>
                    <div className="space-y-2"><Label htmlFor="permit-inn">{label('inn')}</Label><Input id="permit-inn" inputMode="numeric" pattern="([0-9]{10}|[0-9]{12})" value={inn} onChange={e => setInn(e.target.value)} disabled={busy} /><p className="text-xs text-muted-foreground">{label('innOptional')}</p></div>
                </>}
            </div>
            <Button type="submit" disabled={busy}><Search className="size-4" aria-hidden="true" />{label(busy ? 'searching' : 'search')}</Button>
        </form>
        <div aria-live="polite" aria-busy={busy} className="space-y-3">
            {error && <Notice variant="error" role="alert"><p>{error.message}</p><CatalogErrorDetails error={error} /></Notice>}
            {result && <>
                <p className="text-sm text-muted-foreground">{label('retrieved')}: {new Date(result.retrievedAtUtc).toLocaleString()}</p>
                {!result.documents.length && !result.errors.length && <Notice>{label('empty')}</Notice>}
                {result.errors.map((item, index) => <Notice key={index} variant={item.registryRequestPending ? 'info' : 'warning'}>
                    <p>{item.number && `${item.number}: `}{item.message}{item.code && ` (${item.code})`}</p>
                    {item.registryRequestPending && <p className="mt-1 font-medium">{label('pending')}</p>}
                </Notice>)}
                {result.documents.map((item, index) => <article key={index} className="min-w-0 space-y-3 rounded-xl border p-4">
                    <h3 className="break-words font-semibold">{label(item.attributeId === 23561 ? 'certificate' : item.attributeId === 23557 ? 'declaration' : 'sgr')}: {item.number}</h3>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 [&_dd]:break-words [&_dd]:whitespace-pre-wrap [&_dt]:text-muted-foreground">
                        {([['status', item.status ?? (item.active === null ? null : label(item.active ? 'active' : 'inactive'))], ['statusGroup', item.statusGroup],
                            ['date', item.fromDate], ['until', item.toDate], ['product', item.productName], ['applicant', item.applicantName], ['manufacturer', item.manufacturerName],
                            ['tnved', item.tnved], ['identification', item.identification], ['regulations', item.regulations], ['updated', item.updatedAt]] as const)
                            .map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{value ?? label('notProvided')}</dd></div>)}
                    </dl>
                </article>)}
            </>}
        </div>
    </section>;
}
