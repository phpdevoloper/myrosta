async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const out = {};
  // rolling mode: find the status that makes the roster live for staff
  for (const st of ['published', 'live', 'open']) {
    await p.evaluate((st) => { const c = active(); c.settings.rosterMode = 'rolling'; S.rosterMode = 'rolling'; c.status = st; try { hydrateCycleSettings(); } catch(e) {} S.tab = 'selfroster'; save(); render(); }, st); await rt.sleep(400);
    const t = await p.evaluate(() => ({rows: document.querySelectorAll('[data-bday]').length, top: document.body.innerText.replace(/\s+/g,' ').slice(90, 260)}));
    out['status_' + st] = t; if (t.rows > 0) { out.statusUsed = st; break; }
  }
  if (!out.statusUsed) { await p.context().close(); return out; }
  await p.evaluate(() => { S.tab = 'my'; save(); render(); window.scrollTo(0,0); }); await rt.sleep(500);
  const chips = () => p.evaluate(() => Array.from(document.querySelectorAll('[data-pick]')).map(c => ({d: c.dataset.pick, t: c.innerText.replace(/\s+/g,' ').slice(0,30), dis: c.disabled || c.getAttribute('aria-disabled') === 'true'})));
  const rec = rt.rec(p, 'S2b');
  try {
    await rt.sleep(1200); rec.mark('1 · The roster is live all cycle');
    await rt.zoom(p, '[data-go="selfroster"]', 1.2, 800); await rt.zoom(p, null);
    await rt.tap(p, '.bn[data-tab="selfroster"]', 1100, rec, '2 · Book what is still open, within your share');
    await rt.tap(p, '[data-bday="2026-10-27"]', 900);
    await rt.zoom(p, '[data-pick]', 1.4, 1200); await rt.zoom(p, null);
    const cs = await chips(); const o = cs.find(c => /Open/.test(c.t) && !c.dis); out.chips = cs.slice(0,4); if (!o) throw new Error('no open chip 27 Oct');
    await rt.tap(p, `[data-pick="${o.d}"]`, 1200);
    await rt.tap(p, '.srConfirm', 1500, rec, '3 · Confirm: the receipt counts your share');
    await p.evaluate(() => window.scrollTo({top: 0, behavior: 'smooth'})); await rt.sleep(1600);
    out.receipt = await p.evaluate(() => (document.body.innerText.replace(/\s+/g,' ').match(/.{0,40}(Booked \d|your share).{0,60}/) || [''])[0]);
    await rt.tap(p, '.bn[data-tab="my"]', 900, rec, '4 · Open shifts: Claim');
    await rt.tap(p, '[data-go="my||openshifts"]', 900);
    await rt.zoom(p, '[data-osclaim]', 1.35, 1200); await rt.zoom(p, null);
    await rt.tap(p, '[data-osclaim]', 1600);
    out.afterClaim = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 240));
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}