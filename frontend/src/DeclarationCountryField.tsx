import { Autocomplete, createFilterOptions, TextField } from '@mui/material';

interface CountryOption { code: string; name: string }

// ISO alpha-2 entries from the UN M49 directory: https://unstats.un.org/unsd/methodology/m49/overview/
const codes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE
GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN
KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC
NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK
SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS
YE YT ZA ZM ZW`;
const displayNames = new Intl.DisplayNames(['ru'], { type: 'region' });
const collator = new Intl.Collator('ru');
const countries = codes.split(/\s+/).map(code => ({ code, name: displayNames.of(code) ?? code }))
  .sort((left, right) => collator.compare(left.name, right.name));
const filterCountries = createFilterOptions<CountryOption>({ stringify: option => `${option.name} ${option.code}` });

export interface DeclarationCountry { country: string; countryCode?: string | null }

export function DeclarationCountryField({ label, value, onChange, disabled, required }: {
  label: string;
  value: DeclarationCountry;
  onChange: (value: DeclarationCountry) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const selection = countries.find(option => option.code === value.countryCode);

  return <Autocomplete<CountryOption, false, false, true>
    freeSolo options={countries} disabled={disabled} value={selection ?? (value.country || null)} inputValue={value.country}
    getOptionLabel={option => typeof option === 'string' ? option : option.name}
    getOptionKey={option => typeof option === 'string' ? option : option.code}
    isOptionEqualToValue={(option, selected) => option.code === selected.code}
    filterOptions={filterCountries} noOptionsText="Совпадений нет"
    onInputChange={(_, country, reason) => {
      if (reason === 'input') onChange({ country, countryCode: null });
    }}
    onChange={(_, option) => {
      if (option && typeof option !== 'string') onChange({ country: option.name, countryCode: option.code });
      else onChange({ country: option ?? '', countryCode: null });
    }}
    renderOption={({ key, ...props }, option) => <li key={key} {...props}>{option.name} ({option.code})</li>}
    renderInput={params => <TextField {...params} label={label} required={required} placeholder="Название или код страны"
      helperText={value.countryCode ? `Код страны ${value.countryCode}` : undefined}
      inputProps={{ ...params.inputProps, maxLength: 100 }}/>}
  />;
}
