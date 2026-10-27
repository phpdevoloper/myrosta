async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { const c = active(); c.settings.noticeDays = 7; try { hydrateCycleSettings(); } catch(e) {} save(); render(); }});
  const out = {};
  const rec = rt.rec(p, 'S5');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '.bn[data-tab="selfroster"]', 1000, rec, '1 · Book shifts, then tap the shift');
    await rt.tap(p, '[data-bday="2026-10-20"]', 900);
    rec.mark('2 · Outside the notice period: Remove this shift'); await rt.zoom(p, '[data-osdrop]', 1.4, 1400); await rt.zoom(p, null);
    await rt.tap(p, '[data-osdrop]', 900);
    await rt.zoom(p, '#cfOk', 1.3, 900); await rt.zoom(p, null);
    await rt.tap(p, '#cfOk', 1400);
    out.row20 = await p.evaluate(() => (document.querySelector('[data-bday="2026-10-20"]') || {innerText:''}).innerText.replace(/\s+/g,' '));
    await rt.tap(p, '[data-bday="2026-10-11"]', 900, rec, '3 · Inside it: three ways');
    await rt.zoom(p, '[data-osoffer]', 1.35, 1800); await rt.zoom(p, null);
    await rt.tap(p, '[data-osoffer]', 900, rec, '4 · Offer it to the group');
    await rt.tap(p, '#cfOk', 1400);
    out.sheet11 = await p.evaluate(() => { const s = document.querySelector('#sheetRoot .sheet'); return s ? s.innerText.replace(/\s+/g,' ').slice(0,200) : null; });
    await p.evaluate(() => { const c = document.getElementById('dsClose'); if (c) c.click(); }); await rt.sleep(400);
    const tab = await p.evaluate(() => S.tab); if (tab !== 'selfroster') await rt.tap(p, '.bn[data-tab="selfroster"]', 500);
    await rt.tap(p, '[data-bday="2026-10-08"]', 900, rec, '5 · Or ask to come off, with a reason');
    await rt.tap(p, '[data-osask]', 900);
    await rt.type(p, '#askWhy', 'Family funeral', 60); await rt.sleep(400);
    await rt.tap(p, '#askSend', 1500);
    out.sheet8 = await p.evaluate(() => { const s = document.querySelector('#sheetRoot .sheet'); return s ? s.innerText.replace(/\s+/g,' ').slice(0,200) : null; });
    await p.evaluate(() => { const c = document.getElementById('dsClose'); if (c) c.click(); }); await rt.sleep(400);
    const tab2 = await p.evaluate(() => S.tab); if (tab2 !== 'selfroster') await rt.tap(p, '.bn[data-tab="selfroster"]', 500);
    await rt.tap(p, '[data-bday="2026-10-13"]', 900, rec, "6 · A day you can't work at all");
    await rt.zoom(p, '[data-setua]', 1.35, 1000); await rt.zoom(p, null);
    await rt.tap(p, '[data-setua]', 1600, rec, '7 · Mark unavailable: not leave');
    out.row13 = await p.evaluate(() => (document.querySelector('[data-bday="2026-10-13"]') || {innerText:''}).innerText.replace(/\s+/g,' '));
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}