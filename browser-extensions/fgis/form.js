/* DOM-only adapter: never clicks buttons, submits forms or issues network requests. */
globalThis.ZnaqFgisForm = (() => {
  const normalize = value => String(value ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  function editable(element) {
    return element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element instanceof HTMLInputElement && ['text', 'email', 'tel', 'url', 'number', 'date', 'search'].includes(element.type);
  }
  function available(element) {
    return editable(element) && !element.matches(':disabled') && !element.readOnly && !element.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"],[aria-readonly="true"]')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
  }
  function labels(element) {
    const labelText = label => { const copy = label.cloneNode(true); copy.querySelectorAll('input,textarea,select,button,[aria-hidden="true"]').forEach(child => child.remove()); return copy.textContent; };
    const labelled = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent || '');
    const wrapper = element.closest('mat-form-field,.mat-form-field,.form-group,.field,.input-group');
    return [...(element.labels || [])].map(labelText).concat(labelled, [element.getAttribute('aria-label'),
      element.getAttribute('placeholder'), wrapper?.querySelector('mat-label,.mat-form-field-label,.control-label,label')?.textContent])
      .filter(Boolean).map(normalize).filter(Boolean);
  }
  function scope(element) {
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 10 && ancestor !== document.body; depth++, ancestor = ancestor.parentElement) {
      const title = ancestor.querySelector(':scope > legend,:scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > summary,:scope > mat-expansion-panel-header,:scope > .panel-heading,:scope > header');
      const name = normalize(ancestor.getAttribute('aria-label') || title?.textContent);
      if (name && name.length < 160 && (/заявител|изготовител|продукц|протокол/.test(name))) return name;
    }
    return '';
  }
  function matches(field, element) {
    const names = labels(element); const aliases = [field.label, ...field.aliases].map(normalize);
    const party = field.key.startsWith('applicant.') ? 'заявител' : field.key.startsWith('manufacturer.') ? 'изготовител' : '';
    const group = scope(element);
    const genitive = party === 'заявител' ? 'заявителя' : party === 'изготовител' ? 'изготовителя' : field.group;
    const full = aliases.flatMap(alias => [normalize(`${alias} ${genitive}`), normalize(`${field.group} ${alias}`)]);
    if (party && group && /заявител|изготовител/.test(group) && !group.includes(party)) return false;
    if (names.some(name => full.includes(name))) return true;
    if (party) return group.includes(party) && names.some(name => aliases.includes(name));
    return names.some(name => aliases.includes(name));
  }
  function fingerprint(element) { return { label: labels(element).join('|'), scope: scope(element), type: element.type || element.tagName }; }
  function selector(element) {
    for (const attribute of ['formcontrolname', 'name', 'id']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      if (attribute === 'id' && /^(mat-|mui-|ng-|:r|input[-_]\d)/i.test(value)) continue;
      const candidate = `${element.tagName.toLowerCase()}[${attribute}="${CSS.escape(value)}"]`;
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    }
    const parts = []; let node = element;
    for (let depth = 0; node && node !== document.body && depth < 15; depth++, node = node.parentElement) {
      const siblings = [...node.parentElement.children].filter(sibling => sibling.tagName === node.tagName);
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
      const candidate = parts.join(' > ');
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    }
    throw new Error('Поле не удалось однозначно определить.');
  }
  function bind(element) { return { selector: selector(element), ...fingerprint(element) }; }
  function locate(binding) {
    try {
      const found = [...document.querySelectorAll(binding.selector)];
      if (found.length !== 1 || !available(found[0])) return [];
      const current = fingerprint(found[0]);
      return current.label === binding.label && current.scope === binding.scope && current.type === binding.type ? found : [];
    } catch { return []; }
  }
  function choices(element, field) {
    const values = element.multiple ? field.value.split('\n').filter(Boolean) : [field.value];
    if (!element.multiple && field.value.includes('\n')) return null;
    const options = [...element.options]; const found = [];
    for (const value of values) {
      const matches = options.filter(option => !option.disabled && (option.value === value || normalize(option.textContent) === normalize(value)));
      if (matches.length !== 1) return null;
      found.push(matches[0]);
    }
    return found;
  }
  function dateValue(element, value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Проверьте формат даты.');
    if (element.type === 'date') return value;
    return value.split('-').reverse().join('.');
  }
  function valueOf(element) { return element instanceof HTMLSelectElement && element.multiple ? [...element.selectedOptions].map(option => option.value).join('\n') : element.value; }
  function write(element, field) {
    if (!available(element)) return { status: 'missing', message: 'Поле недоступно в открытом разделе.' };
    const current = valueOf(element);
    if (element instanceof HTMLSelectElement) {
      const selected = choices(element, field);
      if (!selected) return { status: 'manual', message: 'Выберите значение в справочнике: точного однозначного совпадения нет.' };
      const expected = selected.map(option => option.value).join('\n');
      if (current === expected) return { status: 'unchanged', message: 'Значение уже совпадает.' };
      if (current.trim()) return { status: 'conflict', message: 'В кабинете уже есть другое значение. Проверьте его вручную.' };
      for (const option of element.options) option.selected = selected.includes(option);
      element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
      return { status: 'filled', message: 'Выбрано существующее значение справочника.', expected };
    }
    const value = field.kind === 'date' ? dateValue(element, field.value) : field.value;
    if (current.trim() === value.trim()) return { status: 'unchanged', message: 'Значение уже совпадает.' };
    if (current.trim()) return { status: 'conflict', message: 'В кабинете уже есть другое значение. Проверьте его вручную.' };
    if (element.getAttribute('role') === 'combobox' || element.hasAttribute('list') || element.hasAttribute('aria-autocomplete') || element.hasAttribute('matAutocomplete') || element.closest('ng-select,mat-select,[role="combobox"]'))
      return { status: 'manual', message: 'Выберите значение в справочнике вручную.' };
    if (element.maxLength >= 0 && value.length > element.maxLength) return { status: 'manual', message: 'Значение длиннее допустимого для этого поля.' };
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
    return { status: 'filled', message: 'Поле заполнено.', expected: value };
  }
  async function fill(payload, bindings = {}) {
    const elements = [...document.querySelectorAll('input,textarea,select')].filter(available);
    const candidates = payload.fields.map(field => bindings[field.key] ? locate(bindings[field.key]) : elements.filter(element => matches(field, element)));
    const owners = new Map();
    candidates.forEach(found => { for (const element of found) owners.set(element, (owners.get(element) || 0) + 1); });
    const written = [];
    const fields = payload.fields.map((field, index) => {
      const found = candidates[index]; const base = { key: field.key, label: `${field.group} · ${field.label}` };
      if (!found.length) return { ...base, status: 'missing', message: bindings[field.key] ? 'Сопоставленное поле отсутствует или изменилось. Откройте нужный раздел или сопоставьте заново.' : 'Откройте нужный раздел или сопоставьте поле вручную.' };
      if (found.length !== 1 || owners.get(found[0]) !== 1) return { ...base, status: 'manual', message: 'Неоднозначное поле. Укажите его через «Сопоставить поля».' };
      try {
        const outcome = write(found[0], field); const { expected, ...result } = outcome;
        const row = { ...base, ...result };
        if (result.status === 'filled') written.push({ element: found[0], expected, row });
        return row;
      } catch { return { ...base, status: 'error', message: 'Поле не приняло значение. Проверьте вручную.' }; }
    });
    // Give controlled inputs time to apply/reject their model update before reporting success.
    await new Promise(resolve => setTimeout(resolve, 180));
    for (const { element, expected, row } of written) {
      if (!element.isConnected || valueOf(element) !== expected || element.validity && !element.validity.valid) {
        row.status = 'error'; row.message = 'Не удалось подтвердить значение после заполнения. Проверьте поле в кабинете.';
      }
    }
    return { reference: payload.reference, fields };
  }
  return { fill, bind, editable, available, normalize };
})();
