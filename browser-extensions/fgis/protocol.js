/* Shared validation; runs in the service worker and the isolated target world. */
globalThis.ZnaqFgisProtocol = (() => {
  const targetOrigin = 'https://srd.fsa.gov.ru';
  function isTarget(url) { try { return new URL(url).origin === targetOrigin; } catch { return false; } }
  function validatePayload(payload) {
    if (!payload || payload.version !== 1 || typeof payload.declarationId !== 'string' || !/^[\da-f-]{36}$/i.test(payload.declarationId)
      || typeof payload.reference !== 'string' || payload.reference.length > 150 || !Number.isInteger(payload.revision) || payload.revision < 1
      || !Array.isArray(payload.fields) || !payload.fields.length || payload.fields.length > 300
      || !Number.isFinite(Date.parse(payload.createdAt)) || Math.abs(Date.now() - Date.parse(payload.createdAt)) > 300000)
      throw new Error('Данные переноса устарели или имеют неподдерживаемый формат. Откройте перенос заново.');
    const keys = new Set(); let length = 0;
    for (const field of payload.fields) {
      if (!field || typeof field.key !== 'string' || !/^(applicant|manufacturer)\.(name|shortName|inn|ogrn|kpp|country|address|email|phone|signatory|position|registrationDate|registrationAuthority)$|^product\.(name|identification|tnVed|okpd2|gtin|productionType|batchDetails|storageConditions)$|^(kind|scheme|regulations|adoptedAt|validUntil|additionalInfo)$|^evidence\.(legalBasis|standards)$|^reports\.\d+\.(number|date|laboratoryName|accreditationNumber)$/.test(field.key)
        || keys.has(field.key) || typeof field.value !== 'string' || field.value.length > 20000
        || typeof field.label !== 'string' || field.label.length > 200 || typeof field.group !== 'string' || field.group.length > 100
        || !['text', 'date', 'choice'].includes(field.kind) || !Array.isArray(field.aliases) || field.aliases.length > 10
        || field.aliases.some(alias => typeof alias !== 'string' || alias.length > 200))
        throw new Error('Некорректный перечень полей декларации. Обновите ZNAQ и расширение.');
      keys.add(field.key); length += field.value.length;
    }
    if (length > 200000) throw new Error('Сведения декларации превышают размер одного переноса.');
    return payload;
  }
  return { isTarget, validatePayload };
})();
