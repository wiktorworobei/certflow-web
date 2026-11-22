import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { DeclarationCountryField, type DeclarationCountry } from './DeclarationCountryField';
import type { SaveDeclaration } from './types';
import type { AddressIdentifier, ManufacturerSite } from './workspaceTypes';

const kinds = { Production: 'Место производства', Branch: 'Филиал' };
const maxSites = 50;
type AddressTarget = 'primary' | 'new' | number;

function identifierText(value?: AddressIdentifier | null) {
  if (value?.gln) return `GLN ${value.gln}`;
  return value?.latitude && value.longitude ? `${value.latitude}, ${value.longitude}` : '';
}

function validCoordinate(value: string, limit: number) {
  return /^[+-]?\d+(?:\.\d+)?$/.test(value) && Math.abs(Number(value)) <= limit;
}

export function DeclarationManufacturerSites({ readOnly }: { readOnly: boolean }) {
  const { control, setValue } = useFormContext<SaveDeclaration>();
  const primary = useWatch({ control, name: 'manufacturer' });
  const countryCode = useWatch({ control, name: 'workspace.manufacturerCountryCode' });
  const identifier = useWatch({ control, name: 'workspace.manufacturerAddressIdentifier' });
  const sites = useWatch({ control, name: 'workspace.manufacturerSites' }) ?? [];
  const [target, setTarget] = useState<AddressTarget>();
  const isPrimary = target === 'primary';

  function save(site: ManufacturerSite, value: AddressIdentifier | null) {
    if (readOnly) return;
    if (isPrimary) setValue('workspace.manufacturerAddressIdentifier', value, { shouldDirty: true });
    else {
      const next = { ...site, identifier: value };
      if (target === 'new' && sites.length < maxSites) setValue('workspace.manufacturerSites', [...sites, next], { shouldDirty: true });
      else if (typeof target === 'number') setValue('workspace.manufacturerSites', sites.map((row, index) => index === target ? next : row), { shouldDirty: true });
    }
    setTarget(undefined);
  }

  return <div className="builder-field-group">
    <Typography component="h3">Адреса изготовителя</Typography>
    {primary.address?.trim() && <Stack spacing={0.5}>
      <Typography variant="subtitle2">Место нахождения</Typography>
      <Typography variant="body2">{[primary.country, primary.address].filter(Boolean).join(', ')}{countryCode ? ` · ${countryCode}` : ''}</Typography>
      {identifierText(identifier) && <Typography variant="body2" color="text.secondary">{identifierText(identifier)}</Typography>}
      {!readOnly && <Button size="small" sx={{ alignSelf: 'start' }} onClick={() => setTarget('primary')}>GLN или координаты места нахождения</Button>}
    </Stack>}
    {sites.map((site, index) => <Stack key={index} spacing={0.5} sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
      <Typography variant="subtitle2">{kinds[site.kind]}{site.name ? ` · ${site.name}` : ''}</Typography>
      <Typography variant="body2">{site.country}, {site.address}{site.countryCode ? ` · ${site.countryCode}` : ''}</Typography>
      {identifierText(site.identifier) && <Typography variant="body2" color="text.secondary">{identifierText(site.identifier)}</Typography>}
      {!readOnly && <Stack direction="row" flexWrap="wrap">
        <Button size="small" aria-label={`Изменить адрес ${index + 1}`} onClick={() => setTarget(index)}>Изменить</Button>
        <Button size="small" color="error" aria-label={`Удалить адрес ${index + 1}`} onClick={() => setValue('workspace.manufacturerSites', sites.filter((_, i) => index !== i), { shouldDirty: true })}>Удалить</Button>
      </Stack>}
    </Stack>)}
    {!readOnly && <Button variant="outlined" size="small" disabled={sites.length >= maxSites} onClick={() => setTarget('new')}>Добавить площадку или филиал</Button>}
    {target !== undefined && !readOnly && <AddressDialog
      primary={isPrimary} site={typeof target === 'number' ? sites[target] : undefined}
      identifier={isPrimary ? identifier : undefined} mainAddress={{ ...primary, countryCode }}
      onClose={() => setTarget(undefined)} onSave={save}
    />}
  </div>;
}

function AddressDialog({ primary, site, identifier, mainAddress, onClose, onSave }: {
  primary: boolean; site?: ManufacturerSite; identifier?: AddressIdentifier | null;
  mainAddress: DeclarationCountry & { address: string }; onClose: () => void;
  onSave: (site: ManufacturerSite, identifier: AddressIdentifier | null) => void;
}) {
  const initial = identifier ?? site?.identifier;
  const [kind, setKind] = useState<ManufacturerSite['kind']>(site?.kind ?? 'Production');
  const [name, setName] = useState(site?.name ?? '');
  const [country, setCountry] = useState<DeclarationCountry>({ country: site?.country ?? '', countryCode: site?.countryCode });
  const [address, setAddress] = useState(site?.address ?? '');
  const [method, setMethod] = useState(initial?.gln ? 'gln' : initial?.latitude ? 'coordinates' : 'none');
  const [gln, setGln] = useState(initial?.gln ?? '');
  const [latitude, setLatitude] = useState(initial?.latitude ?? '');
  const [longitude, setLongitude] = useState(initial?.longitude ?? '');
  const [error, setError] = useState('');

  function clearOriginalIdentifier() {
    if (!site?.identifier) return;
    const reuseGln = method === 'gln' && gln === site.identifier.gln;
    const reuseCoordinates = method === 'coordinates' && latitude === site.identifier.latitude && longitude === site.identifier.longitude;
    if (!reuseGln && !reuseCoordinates) return;
    setMethod('none');
    setGln('');
    setLatitude('');
    setLongitude('');
  }

  function submitAddress() {
    const normalizedGln = gln.trim();
    const north = latitude.trim().replace(',', '.');
    const east = longitude.trim().replace(',', '.');
    if (!primary && (!country.country.trim() || !address.trim())) return setError('Укажите страну и адрес.');
    if (method === 'gln' && (!/^\d{13}$/.test(normalizedGln) || [...normalizedGln].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 !== 0))
      return setError('Для GLN укажите 13 цифр с корректной контрольной цифрой.');
    if (method === 'coordinates' && (!validCoordinate(north, 90) || !validCoordinate(east, 180)))
      return setError('Укажите широту от −90 до 90 и долготу от −180 до 180.');

    const value = method === 'gln' ? { gln: normalizedGln } : method === 'coordinates' ? { latitude: north, longitude: east } : null;
    onSave({ kind, name: name.trim(), country: country.country.trim(), countryCode: country.countryCode, address: address.trim(), identifier: value }, value);
  }

  return <Dialog open onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="manufacturer-address-title">
    <DialogTitle id="manufacturer-address-title">{primary ? 'Идентификатор места нахождения' : site ? 'Изменить адрес изготовителя' : 'Добавить площадку или филиал'}</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {primary ? <Typography variant="body2">{[mainAddress.country, mainAddress.address].filter(Boolean).join(', ')}</Typography> : <>
          <TextField select label="Тип адреса" value={kind} onChange={event => setKind(event.target.value as ManufacturerSite['kind'])}>
            {Object.entries(kinds).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField label="Название площадки или филиала" value={name} onChange={event => setName(event.target.value)} inputProps={{ maxLength: 150 }}/>
          <DeclarationCountryField required label="Страна площадки" value={country} onChange={value => {
            if (value.country.trim() !== country.country.trim()) clearOriginalIdentifier();
            setCountry(value);
          }}/>
          <TextField required label="Адрес площадки" value={address} onChange={event => {
            if (event.target.value.trim() !== address.trim()) clearOriginalIdentifier();
            setAddress(event.target.value);
          }} multiline minRows={2} inputProps={{ maxLength: 3000 }}/>
          {!site && mainAddress.address?.trim() && <Button size="small" sx={{ alignSelf: 'start' }} onClick={() => { setCountry({ country: mainAddress.country, countryCode: mainAddress.countryCode }); setAddress(mainAddress.address); }}>Подставить адрес изготовителя</Button>}
        </>}
        <TextField select label="Идентификатор адреса" value={method} onChange={event => setMethod(event.target.value)}>
          <MenuItem value="none">Без идентификатора</MenuItem>
          <MenuItem value="gln">GLN</MenuItem>
          <MenuItem value="coordinates">Координаты</MenuItem>
        </TextField>
        {method === 'gln' && <TextField label="GLN" value={gln} onChange={event => setGln(event.target.value)} inputProps={{ inputMode: 'numeric', maxLength: 13 }}/>}
        {method === 'coordinates' && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Широта" value={latitude} onChange={event => setLatitude(event.target.value)} inputProps={{ inputMode: 'decimal', maxLength: 24 }}/>
          <TextField label="Долгота" value={longitude} onChange={event => setLongitude(event.target.value)} inputProps={{ inputMode: 'decimal', maxLength: 24 }}/>
        </Stack>}
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Отмена</Button><Button variant="contained" onClick={submitAddress}>Применить</Button></DialogActions>
  </Dialog>;
}
