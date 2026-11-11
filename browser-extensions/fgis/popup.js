let currentTab; let currentUrl;
const button = document.getElementById('connect'); const status = document.getElementById('status');
(async () => {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = new URL(currentTab.url);
  if (!(currentUrl.protocol === 'https:' || currentUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(currentUrl.hostname)) || currentUrl.hostname === 'srd.fsa.gov.ru')
    throw new Error('Откройте вкладку программы ZNAQ и нажмите значок расширения в ней.');
  const [result] = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: () => document.querySelector('meta[name="application-name"]')?.content === 'ZNAQ' });
  if (!result.result) throw new Error('Эта вкладка не распознана как ZNAQ. Откройте программу.');
  document.getElementById('origin').textContent = currentUrl.origin; button.disabled = false;
})().catch(error => { status.textContent = error.message; });
button.addEventListener('click', async () => {
  const pattern = `${currentUrl.protocol}//${currentUrl.hostname}/*`;
  try {
    // Call directly in the user gesture; grant only the chosen host.
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) throw new Error('Доступ к вкладке ZNAQ не разрешён.');
    button.disabled = true;
    const { appOrigins = [] } = await chrome.storage.local.get('appOrigins');
    await chrome.storage.local.set({ appOrigins: [...new Set([...appOrigins, currentUrl.origin])] });
    const id = `znaq-${Array.from(new TextEncoder().encode(currentUrl.origin), byte => byte.toString(16).padStart(2, '0')).join('')}`;
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    if (!scripts.length) await chrome.scripting.registerContentScripts([{ id, matches: [pattern], js: ['bridge.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
    await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['bridge.js'] });
    status.textContent = 'Подключено. Вернитесь в декларацию и нажмите «Перенести в ФГИС», затем «Проверить подключение».';
  } catch (error) { status.textContent = error.message; button.disabled = false; }
});
