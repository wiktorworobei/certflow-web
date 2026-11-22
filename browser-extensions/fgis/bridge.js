(() => {
  if (globalThis.__znaqFgisBridge) return;
  globalThis.__znaqFgisBridge = true;
  let running = false;
  const actions = ['status', 'inspect', 'fill', 'map', 'payment-status', 'payment-balance', 'payment-invoice'];
  window.addEventListener('message', async event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || data?.channel !== 'znaq-fgis-request'
      || typeof data.requestId !== 'string' || data.requestId.length > 100 || !actions.includes(data.action)) return;
    const reply = value => window.postMessage({ channel: 'znaq-fgis-response', requestId: data.requestId, ...value }, location.origin);
    if (running) { reply({ error: 'Предыдущий перенос ещё выполняется.' }); return; }
    running = true;
    try {
      const request = { action: data.action, tabId: data.tabId };
      if (data.action === 'fill' || data.action === 'map') request.payload = data.payload;
      if (data.action === 'payment-invoice') request.quantity = data.quantity;
      reply(await chrome.runtime.sendMessage(request));
    }
    catch { reply({ error: 'Расширение обновилось. Обновите вкладку ZNAQ и повторите подключение.' }); }
    finally { running = false; }
  });
})();
