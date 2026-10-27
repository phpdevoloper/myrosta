async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const out = {};
  // rolling mode: find the status that makes the roster live for staff (book-as-you-tap is the default since 12 Oct 2026)
  for (const st of ['published', 'live', 'open']) {
    await p.evaluate((st) => { const c = active(); c.settings.rosterMode = 'rolling'; S.rosterMode = 'rolling'; c.status = st; try { hydrateCycleSettings(); } catch(e) {} delete S.instantBook; S.tab = 'selfroster'; save(); render(); }, st); await rt.sleep(400);
    const t = await p.evaluate(() => ({rows: document.querySelectorAll('[data-bday]').length}));
    out['status_' + st] = t; if (t.rows > 0) { out.statusUsed = st; break; }
  }
  if (!out.statusUsed) { await p.context().close(); return out; }
  await p.evaluate(() => { S.tab = 'my'; save(); render(); window.scrollTo(0,0); }); await rt.sleep(500);
  const chips = () => p.evaluate(() => Array.from(document.querySelectorAll('[data-pick]')).map(c => ({d: c.dataset.pick, t: c.innerText.replace(/\s+/g,' ').slice(0,30), dis: c.disabled || c.getAttribute('aria-disabled') === 'true'})));
    const findDay = async (after) => p.evaluate((after) => { const me=S.viewAs, today=iso(new Date()); for (const dt of cycleDates()) { const i=iso(dt); if (i<=today || i<=after) continue; if (getShift(me,i).kind!=="off") continue; for (const per of ["AM","PM"]) { if (S.zones.some(z=>canBook(me,i,per,z.id).ok)) return {i, per}; } } return null; }, after);
  const day = await findDay(''); if (!day) throw new Error('no free day'); out.day = day;   // the first day ahead this person can book, not a fixed date: the demo's shifts move with today
  const rec = rt.rec(p, 'S2b');
  try {
    await rt.sleep(1200); rec.mark('1 · The roster is live all cycle');
    await rt.zoom(p, '[data-go="selfroster"]', 1.2, 800); await rt.zoom(p, null);
    await rt.tap(p, '.bottomnav [data-tab="selfroster"], [data-go="selfroster"]', 1100, rec, '2 · Book what is still open, within your share');
    await rt.tap(p, '[data-bday="' + day.i + '"]', 900);
    await rt.zoom(p, '[data-pick]', 1.4, 1200); await rt.zoom(p, null);
    const cs = await chips(); const o = cs.find(c => /Open/.test(c.t) && !c.dis); out.chips = cs.slice(0,4); if (!o) throw new Error('no open chip 27 Oct');
    await rt.tap(p, `[data-pick="${o.d}"]`, 1500, rec, '3 · Booked at a tap: the receipt counts your share');
    await rt.zoom(p, '.srfoot.done', 1.35, 2000); await rt.zoom(p, null);
    out.receipt = await p.evaluate(() => (document.body.innerText.replace(/\s+/g,' ').match(/.{0,40}(Booked \d|your share).{0,60}/) || [''])[0]);
    await rt.tap(p, '.bottomnav [data-tab="my"], [data-go="my"]', 900, rec, '4 · Open shifts: Claim');
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
