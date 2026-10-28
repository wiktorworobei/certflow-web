import { store } from '../../store';

const identity = () => { const s = store.getState().session; return `${s.user?.id ?? ''}:${s.firmId}`; };
let current = identity(); let epoch = 0;
store.subscribe(() => { const next = identity(); if (next !== current) { current = next; epoch++; } });
export function captureMarkingScope() { return { identity: current, epoch }; }
export function assertMarkingScope(scope: ReturnType<typeof captureMarkingScope>) {
  if (scope.identity !== current || scope.epoch !== epoch) throw new Error('Компания или пользователь изменились. Операция остановлена.');
}
