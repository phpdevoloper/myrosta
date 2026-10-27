async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const out = {v: rt.version};
  const chips = () => p.evaluate(() => Array.from(document.querySelectorAll('[data-pick]')).map(c => ({d: c.dataset.pick, t: c.innerText.replace(/\s+/g,' ').slice(0,30), dis: c.disabled || c.getAttribute('aria-disabled') === 'true'})));
  const basket = () => p.evaluate(() => { const b = document.querySelector('.srConfirm'); return b ? b.innerText.replace(/\s+/g,' ') : null; });
  const rec = rt.rec(p, 'S2a');
  try {
    await rt.sleep(1500);
    await rt.tap(p, '.bn[data-tab="selfroster"]', 1100, rec, '1 · Tap Book shifts');
    await rt.tap(p, '[data-bday="2026-10-19"]', 900, rec, '2 · Tap a day');
    rec.mark('3 · AM or PM, then a zone marked Open'); await rt.zoom(p, '[data-pick]', 1.45, 1400); await rt.zoom(p, null);
    let cs = await chips(); let o = cs.find(c => /Open/.test(c.t) && !c.dis); if (!o) throw new Error('no open chip 19 Oct: ' + JSON.stringify(cs.slice(0,3)));
    await rt.tap(p, `[data-pick="${o.d}"]`, 1200); out.b1 = await basket();
    await rt.tap(p, '[data-bday="2026-11-04"]', 900, rec, '4 · Add more days');
    await rt.tap(p, '[data-dsper="AM"]', 700);
    cs = await chips(); o = cs.find(c => /Open/.test(c.t) && !c.dis); if (!o) throw new Error('no open chip 4 Nov: ' + JSON.stringify(cs.slice(0,3)));
    await rt.tap(p, `[data-pick="${o.d}"]`, 1100); out.b2 = await basket();
    await rt.tap(p, '[data-bday="2026-11-17"]', 900);
    cs = await chips(); o = cs.find(c => /Open/.test(c.t) && !c.dis); if (!o) throw new Error('no open chip 17 Nov: ' + JSON.stringify(cs.slice(0,3)));
    await rt.tap(p, `[data-pick="${o.d}"]`, 1100); out.b3 = await basket();
    await rt.zoom(p, '.srConfirm', 1.5, 900); await rt.zoom(p, null);
    await rt.tap(p, '.srConfirm', 1600, rec, '5 · Confirm');
    rec.mark('6 · Your receipt'); await p.evaluate(() => window.scrollTo({top: 0, behavior: 'smooth'})); await rt.sleep(900);
    out.top = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 300));
    const rsel = await p.evaluate(() => { const cand = Array.from(document.querySelectorAll('div,p,section')).find(e => /your share|Booked \d/.test(e.innerText||'') && e.innerText.length < 160 && e.children.length < 6); if (cand) { cand.id = cand.id || '__receipt'; return '#' + cand.id; } return null; });
    out.rsel = rsel; if (rsel) { await rt.zoom(p, rsel, 1.5, 2200); await rt.zoom(p, null); } else await rt.sleep(2200);
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  page.context().browser().__rt.stateAfterS2a = await rt.state(p);
  await p.context().close();
  return out;
}