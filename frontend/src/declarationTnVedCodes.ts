export function declarationTnVedCodes(value?: string | null) {
  return [...new Set((value ?? '').split(/[,;\r\n]+/).map(code => code.trim()).filter(Boolean))];
}
