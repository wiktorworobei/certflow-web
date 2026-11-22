/* Read-only inspection of the selected, open SRD page. */
globalThis.ZnaqFgisSrd = (() => {
  const numberSource = 'ЕАЭС (?:N|№) RU Д[-‐‑–] ?[A-Z]{2}\\.[A-ZА-Я]{2}[0-9]{2}\\.[A-ZА-Я]\\.[0-9]{5}/[0-9]{2}';
  const numberPattern = new RegExp(`^${numberSource}$`, 'iu');
  const date = '[0-9]{2}\\.[0-9]{2}\\.[0-9]{4}';
  const cardHeading = new RegExp(`^(${numberSource}) от ${date} действует до ${date}$`, 'iu');
  const states = [
    'Действует', 'Архивный', 'Прекращён', 'Черновик', 'Недействителен',
    'Направлено уведомление о прекращении', 'Выдано предписание', 'Приостановлен',
  ];
  const editSections = new Set(['common', 'applicant', 'manufacturer', 'products', 'product', 'testingLabs', 'documents', 'scanCopies', 'declaration']);
  const viewSections = new Set([...editSections, 'customs', 'status']);
  const text = value => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
  const label = value => text(value).replace(/\s*[:*]+\s*$/u, '').toLowerCase().replaceAll('ё', 'е');

  function pageInfo(url) {
    if (!ZnaqFgisProtocol.isTarget(url)) return { page: 'unknown' };
    const { pathname, hash } = new URL(url);
    if (hash) return { page: 'unknown' };
    if (/^\/srd\/?$/.test(pathname)) return { page: 'list' };
    if (/^\/signer\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/?$/i.test(pathname)) return { page: 'signer' };
    const view = pathname.match(/^\/srd\/view\/([1-9][0-9]{0,14})(?:\/srd\/([A-Za-z]+))?\/?$/);
    if (view && (!view[2] || viewSections.has(view[2]))) return { page: 'view', documentId: view[1] };
    const edit = pathname.match(/^\/srd\/edit\/([1-9][0-9]{0,14})\/([A-Za-z]+)\/?$/);
    if (edit && editSections.has(edit[2])) return { page: 'edit', documentId: edit[1] };
    return { page: 'unknown' };
  }

  function visible(element) {
    return Boolean(element
      && !element.closest('[hidden],[inert],[aria-hidden="true"]')
      && element.getClientRects().length > 0
      && getComputedStyle(element).visibility === 'visible'
      && (element.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true));
  }

  function valueOf(element) {
    if (!visible(element)) return '';
    if (element instanceof HTMLInputElement) return ['text', 'search', 'number'].includes(element.type) ? text(element.value) : '';
    if (element.textContent.length > 240) return '';
    return text(element.innerText ?? element.textContent);
  }

  function matchingValue(element, inline, names, normalize, candidates) {
    const separator = inline.indexOf(':');
    if (separator >= 0 && names.includes(label(inline.slice(0, separator)))) {
      const value = normalize(text(inline.slice(separator + 1)));
      if (value) candidates.add(value);
    }
    if (!names.includes(label(inline))) return;
    const next = element.nextElementSibling;
    const controls = element.control ? [element.control] : [
      ...element.querySelectorAll('input'),
      next,
      ...(next?.querySelectorAll('input') ?? []),
    ];
    for (const control of controls) {
      const value = normalize(valueOf(control));
      if (value) candidates.add(value);
    }
  }

  function officialNumber(value) {
    if (!numberPattern.test(value)) return undefined;
    return value.toUpperCase().replace(/[-‐‑–] ?/u, '-');
  }

  function statusName(value) {
    return states.find(status => label(status) === label(value));
  }

  function inn(value) {
    return /^(?:[0-9]{10}|[0-9]{12})$/.test(value) ? value : undefined;
  }

  function inspect(url) {
    const info = pageInfo(url);
    if (info.page !== 'view' && info.page !== 'edit') return info;
    const numbers = new Set();
    const statuses = new Set();
    const inns = new Set();
    const numberLabels = ['регистрационный номер декларации'];
    const statusLabels = ['статус', 'статус декларации'];
    const innLabels = ['инн заявителя'];
    for (const element of document.querySelectorAll('h1,h2,h3,h4,[role="heading"],header,strong,b,div,span,p,dt,dd,th,td,label,mat-label')) {
      const value = valueOf(element);
      if (!value) continue;
      if (info.page === 'view') {
        const heading = value.match(cardHeading)?.[1];
        const number = officialNumber(heading ?? (element.matches('h1,h2,h3,h4,[role="heading"]') ? value : ''));
        if (number) numbers.add(number);
      }
      matchingValue(element, value, numberLabels, officialNumber, numbers);
      matchingValue(element, value, statusLabels, statusName, statuses);
      matchingValue(element, value, innLabels, inn, inns);
    }
    for (const control of document.querySelectorAll('input[aria-label],input[aria-labelledby]')) {
      const names = [control.getAttribute('aria-label')];
      const ids = (control.getAttribute('aria-labelledby') || '').split(/\s+/u).filter(Boolean);
      if (ids.length) names.push(ids.map(id => valueOf(document.getElementById(id))).join(' '));
      const labels = names.map(label);
      const value = valueOf(control);
      const number = labels.some(name => numberLabels.includes(name)) && officialNumber(value);
      const applicantInn = labels.some(name => innLabels.includes(name)) && inn(value);
      if (number) numbers.add(number);
      if (applicantInn) inns.add(applicantInn);
    }
    if (numbers.size === 1) [info.registrationNumber] = numbers;
    if (statuses.size === 1) [info.status] = statuses;
    if (inns.size === 1) [info.applicantInn] = inns;
    return info;
  }

  return { inspect };
})();
