importScripts('protocol.js');
const activeTabs = new Set();

async function payment(action, tab, quantity) {
  if (!ZnaqFgisProtocol.isPaymentTarget(tab.url))
    throw new Error('Выбранная вкладка больше не является кабинетом НИА. Обновите список вкладок.');
  const request = { action, expectedUrl: tab.url };
  if (action === 'payment-invoice') {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000)
      throw new Error('Укажите целое количество регистраций от 1 до 10 000.');
    if (!/^\/ru\/main\/documents\/new\/?$/.test(new URL(tab.url).pathname))
      throw new Error('Откройте страницу «Создать счет» в выбранной вкладке НИА.');
    request.quantity = quantity;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['payment.js'] });
  const response = await chrome.tabs.sendMessage(tab.id, request, { frameId: 0 });
  if (response?.error) throw new Error(response.error);
  if ((await chrome.tabs.get(tab.id)).url !== tab.url) throw new Error('Выбранная вкладка НИА изменилась. Проверьте её снова.');
  if (action === 'payment-balance' && response?.paymentBalance) return { version: 1, paymentBalance: response.paymentBalance };
  if (action === 'payment-invoice' && response?.invoiceFilled === true) return { version: 1, invoiceFilled: true };
  throw new Error('Не удалось получить ответ от выбранной вкладки НИА.');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) throw new Error('Перенос доступен только из подключённой вкладки ZNAQ.');
    const { appOrigins = [] } = await chrome.storage.local.get('appOrigins');
    if (!appOrigins.includes(new URL(sender.url).origin) || ZnaqFgisProtocol.isTarget(sender.url) || ZnaqFgisProtocol.isPaymentTarget(sender.url))
      throw new Error('Подключите эту вкладку ZNAQ через значок расширения.');
    if (message.action === 'status') {
      const tabs = await chrome.tabs.query({ url: 'https://srd.fsa.gov.ru/*' });
      return { version: 1, supportsEaeuGroups: true, tabs: tabs.map(tab => ({ id: tab.id, title: tab.title || 'Кабинет ФГИС' })) };
    }
    if (message.action === 'payment-status') {
      const tabs = await chrome.tabs.query({ url: 'https://pay.niakk.ru/*' });
      return { version: 1, paymentTabs: tabs.map(tab => ({ id: tab.id, title: tab.title || 'Кабинет НИА' })) };
    }
    const paymentAction = ['payment-balance', 'payment-invoice'].includes(message.action);
    if ((!paymentAction && !['inspect', 'fill', 'map'].includes(message.action)) || !Number.isInteger(message.tabId) || message.tabId < 0)
      throw new Error('Неизвестная команда переноса.');
    const tab = await chrome.tabs.get(message.tabId);
    if (activeTabs.has(tab.id)) throw new Error('В этой вкладке уже выполняется перенос.');
    activeTabs.add(tab.id);
    try {
      if (paymentAction) return await payment(message.action, tab, message.quantity);
      if (!ZnaqFgisProtocol.isTarget(tab.url)) throw new Error('Выбранная вкладка больше не является кабинетом ФГИС. Обновите список вкладок.');
      const inspection = message.action === 'inspect';
      const payload = inspection ? undefined : ZnaqFgisProtocol.validatePayload(message.payload);
      // Inject on demand as well: the cabinet may have been open before installation.
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['protocol.js', 'form.js', 'srd.js', 'target.js'] });
      const request = inspection ? { action: 'inspect', expectedUrl: tab.url } : { action: message.action, payload };
      const response = await chrome.tabs.sendMessage(tab.id, request, { frameId: 0 });
      if (response?.error) throw new Error(response.error);
      if (inspection && (!response?.inspection || (await chrome.tabs.get(tab.id)).url !== tab.url))
        throw new Error('Выбранная вкладка ФГИС изменилась. Проверьте её снова.');
      return { version: 1, ...response };
    } finally { activeTabs.delete(tab.id); }
  })().then(response => sendResponse({ response }), error => sendResponse({ error: error.message || 'Не удалось подключиться к кабинету ФГИС.' }));
  return true;
});
