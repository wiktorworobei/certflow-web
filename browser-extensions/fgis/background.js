importScripts('protocol.js');
const activeTabs = new Set();
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) throw new Error('Перенос доступен только из подключённой вкладки ZNAQ.');
    const { appOrigins = [] } = await chrome.storage.local.get('appOrigins');
    if (!appOrigins.includes(new URL(sender.url).origin)) throw new Error('Подключите эту вкладку ZNAQ через значок расширения.');
    if (message.action === 'status') {
      const tabs = await chrome.tabs.query({ url: 'https://srd.fsa.gov.ru/*' });
      return { version: 1, tabs: tabs.map(tab => ({ id: tab.id, title: tab.title || 'Кабинет ФГИС' })) };
    }
    if (!['fill', 'map'].includes(message.action) || !Number.isInteger(message.tabId)) throw new Error('Неизвестная команда переноса.');
    const payload = ZnaqFgisProtocol.validatePayload(message.payload);
    const tab = await chrome.tabs.get(message.tabId);
    if (!ZnaqFgisProtocol.isTarget(tab.url)) throw new Error('Выбранная вкладка больше не является кабинетом ФГИС. Обновите список вкладок.');
    if (activeTabs.has(tab.id)) throw new Error('В этой вкладке уже выполняется перенос.');
    activeTabs.add(tab.id);
    try {
      // Inject on demand as well: the cabinet may have been open before installation.
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['protocol.js', 'form.js', 'target.js'] });
      const response = await chrome.tabs.sendMessage(tab.id, { action: message.action, payload }, { frameId: 0 });
      if (response?.error) throw new Error(response.error);
      return { version: 1, ...response };
    } finally { activeTabs.delete(tab.id); }
  })().then(response => sendResponse({ response }), error => sendResponse({ error: error.message || 'Не удалось подключиться к кабинету ФГИС.' }));
  return true;
});
