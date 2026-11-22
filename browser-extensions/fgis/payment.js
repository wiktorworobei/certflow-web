/* Runs in the isolated world of the official payment portal. */
(() => {
  if (globalThis.__znaqFgisPayment || location.origin !== 'https://pay.niakk.ru') return;
  globalThis.__znaqFgisPayment = true;

  const accountPath = /^\/ru\/main(?:\/|$)/;
  const invoicePath = /^\/ru\/main\/documents\/new\/?$/;
  const rubles = /^([−-]?)\s*(\d{1,3}(?: \d{3})+|\d+)(?:[,.](\d{2}))?\s*₽$/;
  const companyPrefix = /^(?:ИП|ООО|АО|ПАО|ЗАО|ОАО|НАО|ФАУ|ФБУ|ФГБУ|ФГБНУ|ФГАОУ|ГБУ|МУП|УП|ПК|АНО|НКО|Общество с ограниченной ответственностью|Индивидуальный предприниматель|Акционерное общество)\s+\S/iu;
  const normalize = text => text.replace(/\s+/g, ' ').trim();

  function visible(element) {
    if (!element || !element.getClientRects().length || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    return element.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
  }

  function textNodes(scope, accept) {
    const results = new Map();
    for (const element of scope.querySelectorAll('span, div, p, strong, b, h1, h2, h3, label, button, a, output, [role="heading"]')) {
      if (!visible(element)) continue;
      const content = normalize(element.innerText ?? element.textContent ?? '');
      if (accept(content)) results.set(element, content);
    }
    // An organization label can be next to the account holder's name in the same wrapper.
    const parents = new Set();
    for (const element of results.keys()) {
      for (let parent = element.parentElement; parent && parent !== scope; parent = parent.parentElement) parents.add(parent);
    }
    return [...results].filter(([element]) => !parents.has(element));
  }

  function unique(entries) {
    const values = [...new Set(entries.map(([, content]) => content))];
    return values.length === 1 ? values[0] : undefined;
  }

  function topBar(element) {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= 120;
  }

  function paymentBalance() {
    const amountLabels = textNodes(document, content => rubles.test(content));
    const organizations = textNodes(document, content => content.length <= 200 && companyPrefix.test(content));
    const pairs = [];
    for (const [amount, amountText] of amountLabels) {
      const header = amount.closest('header, [role="banner"]');
      if (!header && (window.scrollY > 0 || !topBar(amount))) continue;
      for (const [organization, organizationName] of organizations) {
        if (header ? !header.contains(organization) : !topBar(organization)) continue;
        const amountPosition = amount.getBoundingClientRect();
        const orgPosition = organization.getBoundingClientRect();
        // The account amount precedes the organization in the same row of the portal header.
        if (!header && (orgPosition.left <= amountPosition.left || Math.abs(orgPosition.top - amountPosition.top) > 35)) continue;
        pairs.push({ scope: header, amountText, organizationName });
      }
    }
    const matches = new Map(pairs.map(pair => [`${pair.organizationName}\n${pair.amountText}`, pair]));
    if (matches.size !== 1) throw new Error('Не удалось однозначно прочитать баланс и организацию. Откройте кабинет «Платежи» под нужной организацией и повторите проверку.');
    const [{ scope, amountText, organizationName }] = matches.values();
    const [, sign, major, minor = '00'] = amountText.match(rubles);
    const balanceKopeks = Number(major.replaceAll(' ', '') + minor) * (sign ? -1 : 1);
    if (!Number.isSafeInteger(balanceKopeks)) throw new Error('Кабинет показал сумму в неподдерживаемом формате.');
    const innLabel = scope && unique(textNodes(scope, content => /^ИНН\s*:?\s*(?:\d{10}|\d{12})$/i.test(content)));
    const payerInn = innLabel?.match(/\d+$/)?.[0];
    return { organizationName, balanceKopeks, ...(payerInn ? { payerInn } : {}) };
  }

  function quantityInput() {
    const heading = textNodes(document, content => /^Создать сч[её]т$/i.test(content));
    const service = textNodes(document, content => /^Регистрация декларации о соответствии$/i.test(content));
    if (!heading.length || service.length !== 1) throw new Error('Откройте форму «Создать счёт» для регистрации декларации о соответствии.');

    const candidate = 'input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"], input:not([type]), input[type="text"]';
    let block = service[0][0].parentElement;
    // Select only the field in the service card. Stop before the account page or the totals card.
    while (block && !block.matches('main, body, [role="main"]') && !heading.some(([element]) => block.contains(element))) {
      if (textNodes(block, content => /₽\s*за единицу$/i.test(content)).length) {
        const inputs = [...block.querySelectorAll(candidate)].filter(input => visible(input) && !input.matches(':disabled, [readonly]'));
        if (inputs.length === 1 && /^\d*$/.test(inputs[0].value)) return inputs[0];
        if (inputs.length) break;
      }
      block = block.parentElement;
    }
    throw new Error('Не удалось определить поле количества в форме. Проверьте, что открыта форма счёта за регистрацию деклараций.');
  }

  async function fillInvoice(quantity, expectedUrl) {
    if (!invoicePath.test(location.pathname) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000)
      throw new Error('Откройте форму «Создать счёт» и укажите количество от 1 до 10 000.');

    paymentBalance();
    const input = quantityInput();
    const min = input.getAttribute('min');
    const max = input.getAttribute('max');
    if ((min !== null && quantity < Number(min)) || (max !== null && quantity > Number(max)))
      throw new Error('Количество выходит за пределы, заданные в форме счёта.');

    const value = String(quantity);
    if (input.value !== value) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await new Promise(resolve => setTimeout(resolve, 80));
    if (location.href !== expectedUrl || quantityInput().value !== value)
      throw new Error('Кабинет не принял количество. Проверьте поле и итоговую сумму в форме.');
    return { invoiceFilled: true };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !['payment-balance', 'payment-invoice'].includes(message.action)) return;
    (async () => {
      if (location.href !== message.expectedUrl || !accountPath.test(location.pathname) || [...document.querySelectorAll('input[type="password"]')].some(visible))
        throw new Error('Войдите в кабинет «Платежи», выберите организацию и повторите действие.');
      if (message.action === 'payment-balance') return { paymentBalance: paymentBalance() };
      return fillInvoice(message.quantity, message.expectedUrl);
    })().then(sendResponse, error => sendResponse({ error: error.message }));
    return true;
  });
})();
