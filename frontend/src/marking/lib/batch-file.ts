import { normalizeDataMatrixCode } from './honest-sign/codeNormalization';

export function parseBatchCodes(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/); const codes: string[] = []; const unique = new Set<string>();
  for (const [index, raw] of lines.entries()) {
    let value = raw.trim(); if (!value) continue;
    if (!codes.length && index === 0 && /^(code|codes|код|код маркировки)$/i.test(value.replace(/^"|"$/g, ''))) continue;
    if (value.startsWith('"')) {
      if (!/^"(?:[^"]|"")*"$/.test(value)) throw new Error(`Строка ${index + 1}: ожидается один полный код без дополнительных колонок.`);
      value = value.slice(1, -1).replaceAll('""', '"');
    }
    value = normalizeDataMatrixCode(value);
    if (!value || value.length > 512 || /[\u0000-\u001c\u001e-\u001f\u007f]/.test(value)) throw new Error(`Строка ${index + 1}: недопустимая длина кода или управляющие символы.`);
    if (unique.has(value)) throw new Error(`Строка ${index + 1}: код уже встречается в партии.`);
    unique.add(value); codes.push(value);
    if (codes.length > 30000) throw new Error('В одной партии допускается не более 30 000 кодов.');
  }
  return codes;
}
