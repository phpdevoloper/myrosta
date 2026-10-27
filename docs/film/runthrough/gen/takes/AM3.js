async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'setup'});
  const out = {};
  const rec = rt.rec(p, 'AM3');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '[data-st="group"]', 1000, rec, '1 · Tags sit on people');
    await p.evaluate(() => document.getElementById('card-tags').scrollIntoView({block:'start', behavior:'smooth'})); await rt.sleep(900);
    out.tagInputs = await p.evaluate(() => Array.from(document.querySelectorAll('#card-tags input, #card-tags button')).filter(e => e.offsetParent !== null).map((e, i) => { e.id = e.id || ('__tg' + i); return {id: e.id, t: (e.innerText || e.placeholder || '').trim().slice(0,24), type: e.type}; }));
    const tin = out.tagInputs.find(x => x.type === 'text');
    if (tin) { await rt.type(p, '#' + tin.id, 'RN', 80); await rt.tap(p, '#tagAdd', 1200); }
    out.afterTag = await p.evaluate(() => (document.getElementById('card-tags') || {innerText:''}).innerText.replace(/\s+/g,' ').slice(0, 260));
    out.tagCtl = await p.evaluate(() => Array.from(document.querySelectorAll('#card-tags input, #card-tags button')).filter(e => e.offsetParent !== null).map((e, i) => { e.id = e.id || ('__tg2' + i); return {id: e.id, t: (e.innerText || e.placeholder || (e.closest('label') ? e.closest('label').innerText : '') || '').trim().slice(0,30), type: e.type, checked: e.checked}; }));
    const show = out.tagCtl.find(x => x.type === 'checkbox' && /show/i.test(x.t)); if (show) { await rt.zoom(p, '#' + show.id, 1.4, 900); await rt.zoom(p, null); await rt.tap(p, '#' + show.id, 900, rec, '2 · Show on the roster'); }
    const who = out.tagCtl.find(x => /Who holds/i.test(x.t)); if (who) { await rt.tap(p, '#' + who.id, 1000); out.whoUI = await p.evaluate(() => Array.from(document.querySelectorAll('#modalRoot input[type=checkbox], #card-tags input[type=checkbox]')).filter(e => e.offsetParent !== null).map((e, i) => { e.id = e.id || ('__who' + i); return e.id + '|' + (e.closest('label') ? e.closest('label').innerText.trim().slice(0,20) : ''); }).slice(0, 6)); const first = (out.whoUI || []).map(s => s.split('|')[0]).slice(0, 3); for (const id of first) await rt.tap(p, '#' + id, 400); const done = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#modalRoot button')).find(e => /Done|Save|Close/i.test(e.innerText)); if (b) { b.id = b.id || '__whodone'; return '#' + b.id; } return null; }); if (done) await rt.tap(p, done, 800); }
    await rt.tap(p, '[data-st="cycle"]', 1000, rec, '3 · Rules sit on the cycle');
    await p.evaluate(() => document.getElementById('card-rules').scrollIntoView({block:'start', behavior:'smooth'})); await rt.sleep(900);
    out.rules = await p.evaluate(() => Array.from(document.querySelectorAll('#card-rules input, #card-rules select, #card-rules button')).filter(e => e.offsetParent !== null).map((e, i) => { e.id = e.id || ('__rl' + i); return {id: e.id, t: (e.innerText || e.placeholder || (e.closest('label') ? e.closest('label').innerText : '') || '').trim().slice(0,30), type: e.type, d: Object.keys(e.dataset).map(k => k + '=' + e.dataset[k]).join(' ')}; }).slice(0, 30));
    out.rulesText = await p.evaluate(() => (document.getElementById('card-rules') || {innerText:''}).innerText.replace(/\s+/g,' ').slice(0, 300));
    const needs = out.rules.find(x => x.type === 'checkbox'); if (needs) { await rt.zoom(p, '#' + needs.id, 1.35, 900); await rt.zoom(p, null); await rt.tap(p, '#' + needs.id, 900, rec, '4 · A slot that needs a tag; a minimum per half'); }
    const mins = out.rules.filter(x => x.type === 'number').slice(0, 6); for (const m of mins) { await p.evaluate((id) => { const e = document.getElementById(id); e.value = '1'; e.dispatchEvent(new Event('input', {bubbles:true})); }, m.id); } await rt.sleep(600);
    const saveR = out.rules.find(x => /Save rules/i.test(x.t)); if (saveR) await rt.tap(p, '#' + saveR.id, 1500, rec, '5 · Save rules: booking, claims, swaps and your cell editor all judge by it');
    out.afterRules = await p.evaluate(() => (document.getElementById('card-rules') || {innerText:''}).innerText.replace(/\s+/g,' ').slice(0, 300));
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}