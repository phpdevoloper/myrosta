async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { S.ownHours = true; save(); render(); }});
  const out = {};
  const chips = () => p.evaluate(() => Array.from(document.querySelectorAll('[data-pick]')).map(c => ({d: c.dataset.pick, t: c.innerText.replace(/\s+/g,' ').slice(0,30), dis: c.disabled || c.getAttribute('aria-disabled') === 'true'})));
  const tagTimes = () => p.evaluate(() => Array.from(document.querySelectorAll('input[type=time]')).filter(e => e.offsetParent !== null).map((e, i) => { e.id = e.id || ('__t' + i); return e.id; }));
  const setTime = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); }, [id, v]); await rt.sleep(700); };
  const rec = rt.rec(p, 'M3');
  try {
    await rt.sleep(1000);
    await rt.tap(p, '.bn[data-tab="selfroster"]', 900, rec, '1 · Book a zone: an Hours row appears');
    await rt.tap(p, '[data-bday="2026-10-27"]', 900);
    const cs = await chips(); const o = cs.find(c => /Open/.test(c.t) && !c.dis); if (!o) throw new Error('no open chip');
    await rt.tap(p, `[data-pick="${o.d}"]`, 1100);
    const ids = await tagTimes(); out.ids = ids;
    rec.mark('2 · Change the start, then Confirm'); await rt.zoom(p, '#' + ids[0], 1.45, 1100); await rt.zoom(p, null);
    await rt.tap(p, '#' + ids[0], 300); await setTime(ids[0], '09:30'); await rt.sleep(600);
    await rt.tap(p, '#dsClose', 800);
    await rt.tap(p, '.srConfirm', 1500);
    await p.evaluate(() => window.scrollTo({top: 0, behavior: 'smooth'})); await rt.sleep(1000);
    out.afterConfirm = await p.evaluate(() => (document.body.innerText.replace(/\s+/g,' ').match(/.{0,40}(Booked \d|your share).{0,80}/) || [''])[0]);
    await rt.tap(p, '[data-bday="2026-10-27"]', 900, rec, '3 · On a booked shift: Change hours');
    const ch = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#sheetRoot button')).find(e => /Change hours/i.test(e.innerText)); if (b) { b.id = b.id || '__chgHours'; return '#' + b.id; } return null; });
    out.ch = ch; if (!ch) throw new Error('no Change hours: ' + JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('#sheetRoot button')).map(e => e.innerText.trim().slice(0,20)))));
    await rt.zoom(p, ch, 1.3, 800); await rt.zoom(p, null);
    await rt.tap(p, ch, 1000);
    const ids2 = await tagTimes(); out.ids2 = ids2;
    await setTime(ids2[ids2.length - 1], '15:00');
    const sv = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#sheetRoot button')).find(e => /^Save$/i.test(e.innerText.trim())); if (b) { b.id = b.id || '__hrSave'; return '#' + b.id; } return null; });
    out.sv = sv; if (sv) await rt.tap(p, sv, 1600, rec, '4 · Save: pay and the calendar use your hours');
    out.afterSave = await p.evaluate(() => { const s = document.querySelector('#sheetRoot .sheet'); return (s ? s.innerText : document.body.innerText).replace(/\s+/g,' ').slice(0, 220); });
    await rt.sleep(1500);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}