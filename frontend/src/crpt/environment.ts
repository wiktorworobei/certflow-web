export type CrptEnvironment = 'sandbox' | 'production';
let selected: CrptEnvironment | null = null;
let epoch = 0;
export function activateCrptEnvironment(environment: CrptEnvironment) {
  selected = environment;
  const version = ++epoch;
  return () => {
    if (version === epoch) {
      selected = null;
      epoch++;
    }
  };
}
export const captureCrptEnvironment = () => ({ environment: selected, epoch });
export function assertCrptEnvironment(scope: ReturnType<typeof captureCrptEnvironment>) {
  if (scope.epoch !== epoch || scope.environment !== selected)
    throw new Error('Контур Честного знака изменился. Операция остановлена.');
}
