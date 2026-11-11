(() => {
  if (globalThis.__znaqFgisBridge) return;
  globalThis.__znaqFgisBridge = true;
  let running = false;
  window.addEventListener('message', async event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || data?.channel !== 'znaq-fgis-request'
      || typeof data.requestId !== 'string' || data.requestId.length > 100 || !['status', 'fill', 'map'].includes(data.action)) return;
    const reply = value => window.postMessage({ channel: 'znaq-fgis-response', requestId: data.requestId, ...value }, location.origin);
    if (running) { reply({ error: 'Предыдущий перенос ещё выполняется.' }); return; }
    running = true;
    try { reply(await chrome.runtime.sendMessage({ action: data.action, tabId: data.tabId, payload: data.payload })); }
    catch { reply({ error: 'Расширение обновилось. Обновите вкладку ZNAQ и повторите подключение.' }); }
    finally { running = false; }
  });
})();
