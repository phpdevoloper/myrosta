async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'setup'});
  const out = {};
  const rec = rt.rec(p, 'AM2');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '[data-st="cycle"]', 900, rec, '1 · This cycle, then On-call: add a window');
    await p.evaluate(() => document.getElementById('card-oncall').scrollIntoView({block: 'start'})); await rt.sleep(900);
    await rt.tap(p, '#addOncall', 1000);
    let rows = await p.evaluate(() => document.querySelectorAll('#ocRows [data-ocid]').length);
    if (!rows) { await p.evaluate(() => document.getElementById('addOncall').click()); await rt.sleep(800); rows = await p.evaluate(() => document.querySelectorAll('#ocRows [data-ocid]').length); }
    out.rows = rows;
    await p.evaluate(() => { const r = document.querySelector('#ocRows [data-ocid]'); ['oc-label','oc-hours','oc-start','oc-end','oc-len','oc-book','oc-rest'].forEach(c => { const e = r.querySelector('.' + c); if (e) e.id = '__' + c; }); r.scrollIntoView({block: 'center'}); }); await rt.sleep(400);
    await rt.tap(p, '#__oc-label', 200); await p.evaluate(() => document.getElementById('__oc-label').select()); await p.keyboard.type('Call-in', {delay: 70}); await rt.sleep(400);
    rec.mark('2 · Chosen when booked: the hours are logged after the event'); await rt.zoom(p, '#__oc-hours', 1.4, 700); await rt.zoom(p, null);
    await p.selectOption('#__oc-hours', 'chosen'); await rt.sleep(900);
    await p.evaluate(() => { const s = document.getElementById('__oc-start'), e = document.getElementById('__oc-end'); s.value = '10:00'; s.dispatchEvent(new Event('input', {bubbles: true})); e.value = '22:00'; e.dispatchEvent(new Event('input', {bubbles: true})); const l = document.getElementById('__oc-len'); if (l) { l.value = '4'; l.dispatchEvent(new Event('input', {bubbles: true})); } }); await rt.sleep(700);
    await rt.zoom(p, '#__oc-len', 1.4, 900); await rt.zoom(p, null);
    rec.mark('3 · Staff can log their own'); await rt.zoom(p, '#__oc-book', 1.4, 1300); await rt.zoom(p, null);
    await rt.tap(p, '#saveOncall', 1500, rec, '4 · Save on-call windows');
    out.saved = await p.evaluate(() => (active().settings.oncallWindows || []).map(w => [w.label, w.start, w.end, w.usual, w.book, w.from && w.from.zones].join('|')));
    await rt.tap(p, '[data-tab="roster"]', 1300, rec, '5 · From the roster cell: Add a call-in for anyone');
    const cell = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button[data-s][data-d="2026-10-07"]')).find(e => !e.innerText.trim() || /^[—–-]$/.test(e.innerText.trim())); if (b) { b.id = b.id || '__cell'; return '#' + b.id + '|' + b.dataset.s; } return null; });
    out.cell = cell;
    await rt.tap(p, cell.split('|')[0], 1200);
    out.editor = await p.evaluate(() => Array.from(document.querySelectorAll('#modalRoot button')).filter(e => e.offsetParent !== null).map(e => e.innerText.trim().slice(0, 28) + '|' + Object.keys(e.dataset).map(k => k + '=' + e.dataset[k]).join(' ')).slice(0, 24));
    const ci = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#modalRoot button')).find(e => e.offsetParent !== null && /call/i.test(e.innerText)); if (b) { b.id = b.id || '__ci'; return '#' + b.id; } return null; });
    out.ci = ci;
    if (ci) {
      await rt.zoom(p, ci, 1.35, 1100); await rt.zoom(p, null); await rt.tap(p, ci, 1000);
      out.ciForm = await p.evaluate(() => Array.from(document.querySelectorAll('#modalRoot input, #modalRoot select, #modalRoot button')).filter(e => e.offsetParent !== null).map((e, i) => { e.id = e.id || ('__cf' + i); return e.id + '|' + e.tagName + '|' + (e.type || '') + '|' + (e.innerText || e.value || '').trim().slice(0, 20); }).slice(0, 30));
      const times = out.ciForm.filter(s => /\|INPUT\|time\|/.test(s)).map(s => s.split('|')[0]);
      if (times.length >= 2) { await p.evaluate(([a, b]) => { const s = document.getElementById(a), e = document.getElementById(b); s.value = '14:00'; s.dispatchEvent(new Event('input', {bubbles: true})); s.dispatchEvent(new Event('change', {bubbles: true})); e.value = '18:00'; e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); }, times); await rt.sleep(700); await rt.zoom(p, '#' + times[0], 1.35, 1100); await rt.zoom(p, null); }
      const sv = out.ciForm.find(s => /\|BUTTON\|[^|]*\|(Save|Add|Log)/i.test(s));
      if (sv) { await rt.tap(p, '#' + sv.split('|')[0], 1500); }
      else if (await p.$('#mSave')) await rt.tap(p, '#mSave', 1500);
    }
    out.cellAfter = await p.evaluate((sel) => { const b = document.querySelector(sel); return b ? b.innerText.replace(/\s+/g, ' ') : null; }, cell.split('|')[0]);
    await rt.zoom(p, cell.split('|')[0], 1.5, 1800).catch(() => {}); await rt.zoom(p, null);
    await rt.sleep(700);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}