(() => {
  if (globalThis.__znaqFgisTarget || !ZnaqFgisProtocol.isTarget(location.href)) return;
  globalThis.__znaqFgisTarget = true;
  let busy = false; let panel; let stopPicking = () => {};
  function storageKey() {
    // IDs differ between drafts; retain the form route, including hash routing.
    const route = `${location.pathname}${location.hash.split('?')[0]}`.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id').replace(/\/\d+(?=\/|$)/g, '/:id');
    return `fgis-fields-v1:${route}`;
  }
  function checkForm() {
    if (document.querySelector('input[type="password"]') || ![...document.querySelectorAll('input,textarea,select')].some(ZnaqFgisForm.available))
      throw new Error('Откройте редактируемый черновик декларации в кабинете ФГИС. На этой странице доступных полей нет.');
  }
  async function mapping(payload) {
    stopPicking(); panel?.remove();
    const key = storageKey(); let bindings = (await chrome.storage.local.get(key))[key] || {};
    panel = document.createElement('div'); panel.id = 'znaq-fgis-mapping';
    const shadow = panel.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;width:min(370px,calc(100vw - 32px));font:14px/1.5 system-ui;color:#142119}section{background:#f3f5f0;border:2px solid #142119;border-radius:12px;padding:18px;box-shadow:0 8px 40px #0005}h2{font-size:18px;margin:0}select,button{font:inherit;max-width:100%;margin-top:10px}select{width:100%;padding:8px}button{padding:8px 12px;cursor:pointer;background:#142119;color:#dcfa78;border:0;border-radius:7px}p{margin:10px 0;overflow-wrap:anywhere}.row{display:flex;gap:8px;flex-wrap:wrap}';
    const section = document.createElement('section'); section.setAttribute('aria-label', 'Сопоставление полей ZNAQ');
    const title = document.createElement('h2'); title.textContent = `ZNAQ → ФГИС · ${payload.reference}`;
    const hint = document.createElement('p'); hint.textContent = 'Выберите реквизит и нажмите «Указать поле». Затем нажмите на поле в форме. Привязка запоминается для следующих деклараций.';
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Реквизит декларации');
    for (const field of payload.fields) { const option = document.createElement('option'); option.value = field.key; option.textContent = `${field.group} · ${field.label}`; select.append(option); }
    const preview = document.createElement('p'); const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    const refresh = () => { stopPicking(); preview.textContent = payload.fields.find(field => field.key === select.value)?.value || ''; feedback.textContent = bindings[select.value] ? 'Поле сопоставлено.' : 'Поле пока не сопоставлено.'; };
    select.addEventListener('change', refresh);
    const row = document.createElement('div'); row.className = 'row';
    const action = (label, callback) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', () => Promise.resolve(callback()).catch(error => { feedback.textContent = error.message; })); row.append(button); };
    action('Указать поле', () => {
      stopPicking(); const selectedKey = select.value;
      feedback.textContent = 'Нажмите на нужное поле в форме. Escape — отмена.';
      const capture = async event => {
        if (event.composedPath().includes(panel)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const element = event.target;
        if (!ZnaqFgisForm.available(element)) { feedback.textContent = 'Нужно нажать на доступное текстовое поле, дату или список.'; return; }
        try {
          const binding = ZnaqFgisForm.bind(element);
          if (Object.entries(bindings).some(([otherKey, other]) => otherKey !== selectedKey && other.selector === binding.selector))
            throw new Error('Это поле уже связано с другим реквизитом. Удалите прежнюю привязку.');
          bindings[selectedKey] = binding; await chrome.storage.local.set({ [key]: bindings });
          stopPicking(); feedback.textContent = 'Сопоставлено. Выберите следующий реквизит или вернитесь в ZNAQ для заполнения.';
        } catch (error) { feedback.textContent = error.message; }
      };
      const escape = event => { if (event.key === 'Escape') { stopPicking(); feedback.textContent = 'Выбор поля отменён.'; } };
      document.addEventListener('click', capture, true); document.addEventListener('keydown', escape, true);
      stopPicking = () => { document.removeEventListener('click', capture, true); document.removeEventListener('keydown', escape, true); };
    });
    action('Удалить привязку', async () => { stopPicking(); delete bindings[select.value]; await chrome.storage.local.set({ [key]: bindings }); refresh(); });
    action('Закрыть', () => { stopPicking(); panel.remove(); });
    section.append(title, hint, select, preview, row, feedback); shadow.append(style, section); document.documentElement.append(panel); refresh();
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !['fill', 'map'].includes(message.action)) return;
    (async () => {
      if (busy) throw new Error('Предыдущий перенос ещё выполняется.');
      busy = true;
      try {
        const payload = ZnaqFgisProtocol.validatePayload(message.payload); checkForm(); stopPicking();
        if (message.action === 'map') { await mapping(payload); return { mapping: true }; }
        panel?.remove();
        const key = storageKey(); const bindings = (await chrome.storage.local.get(key))[key] || {};
        return { result: await ZnaqFgisForm.fill(payload, bindings) };
      } finally { busy = false; }
    })().then(sendResponse, error => sendResponse({ error: error.message }));
    return true;
  });
})();
