import type { UseFormReturn } from 'react-hook-form';
import { emptyParty, type SaveDeclaration } from './types';

export type DeclarationPartySide = 'applicant' | 'manufacturer';

export function copyDeclarationParty(
  { getValues, setValue }: Pick<UseFormReturn<SaveDeclaration>, 'getValues' | 'setValue'>,
  side: DeclarationPartySide,
  source: SaveDeclaration,
  printKeys: readonly string[],
) {
  const options = { shouldDirty: true };
  setValue(side, { ...emptyParty(), ...source[side] }, options);

  const workspace = source.workspace;
  if (side === 'manufacturer') {
    setValue('workspace.manufacturerCountryCode', workspace?.manufacturerCountryCode ?? null, options);
    setValue('workspace.manufacturerAddressIdentifier', workspace?.manufacturerAddressIdentifier ?? null, options);
    setValue('workspace.manufacturerSites', workspace?.manufacturerSites ?? [], options);
  }

  // Party changes invalidate their dependent overrides. Restore only the selected section's source text.
  const overrides = { ...getValues('workspace.printOverrides') };
  for (const key of printKeys) {
    const value = workspace?.printOverrides?.[key];
    if (value === undefined) delete overrides[key];
    else overrides[key] = value;
  }
  setValue('workspace.printOverrides', overrides, options);
}
