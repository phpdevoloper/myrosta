async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  const out = {};
  await rt.open(p, {reset: true, prep: () => { const c = active(); c.settings.oncallWindows = [{id:'ci1', code:'ONCALL', pay:'ONCALL', uid:'ci1', label:'Call-in', start:'10:00', end:'22:00', book:true, rest:true, chosen:true, usual:240, from:null}]; try { hydrateCycleSettings(); } catch(e) {} S.tab = 'selfroster'; save(); render(); }});
  const rec = rt.rec(p, 'M2');
  try {
    await rt.sleep(1000);
    const today = await p.evaluate(() => iso(new Date()));
    await rt.tap(p, `[data-bday="${today}"]`, 1000, rec, '1 · Tap today, then I was called in');
    out.sheet = await p.evaluate(() => Array.from(document.querySelectorAll('#sheetRoot button')).filter(e => e.offsetParent !== null).map(e => (e.id||'') + '|' + e.innerText.trim().slice(0,28) + '|' + Object.keys(e.dataset).map(k => k + '=' + e.dataset[k]).join(' ')));
    const ciBtn = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#sheetRoot button')).find(e => /called in/i.test(e.innerText)); if (b) { b.id = b.id || '__ci'; return '#' + b.id; } return null; });
    out.ciBtn = ciBtn; if (!ciBtn) throw new Error('no I was called in button');
    await rt.zoom(p, ciBtn, 1.4, 1000); await rt.zoom(p, null);
    await rt.tap(p, ciBtn, 1100);
    const times = await p.evaluate(() => Array.from(document.querySelectorAll('#sheetRoot input[type=time]')).filter(e => e.offsetParent !== null).map((e, i) => { e.id = e.id || ('__ct' + i); return {id: e.id, v: e.value}; }));
    out.times = times;
    rec.mark('2 · From and To: the hours you really worked');
    if (times.length >= 2) { await p.evaluate(([a, b]) => { const f = document.getElementById(a), t = document.getElementById(b); f.value = '14:00'; f.dispatchEvent(new Event('input', {bubbles:true})); f.dispatchEvent(new Event('change', {bubbles:true})); t.value = '18:00'; t.dispatchEvent(new Event('input', {bubbles:true})); t.dispatchEvent(new Event('change', {bubbles:true})); }, [times[0].id, times[1].id]); await rt.sleep(900); }
    const save = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#sheetRoot button')).find(e => /^Save$/i.test(e.innerText.trim())); if (b) { b.id = b.id || '__ciSave'; return '#' + b.id; } return null; });
    out.save = save; if (save) await rt.tap(p, save, 1500, rec, '3 · Save');
    out.after = await p.evaluate(() => { const s = document.querySelector('#sheetRoot .sheet'); return (s ? s.innerText : document.body.innerText).replace(/\s+/g,' ').slice(0, 260); });
    const called = await p.evaluate(() => { const e = Array.from(document.querySelectorAll('#sheetRoot *')).find(x => /Called in/.test(x.innerText || '') && x.children.length < 4); if (e) { e.id = e.id || '__called'; return '#' + e.id; } return null; });
    if (called) { rec.mark('4 · Change or Remove it until the end of tomorrow'); await rt.zoom(p, called, 1.4, 2200); await rt.zoom(p, null); }
    await rt.sleep(1000);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}