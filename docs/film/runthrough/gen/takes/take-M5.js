async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { const s = S.staff[0]; s.mode = 'fixed'; const c = active(); const today = iso(new Date()); const k = Object.keys(c.assign).filter(x => x.indexOf('demo-0|') === 0 && x.split('|')[1] > today && c.assign[x].kind === 'clinical').sort()[1]; if (k) c.assign[k].fixed = true; window.__fixedDay = k ? k.split('|')[1] : null; S.marketOn = true; S.viewAs = 'demo-0'; S.tab = 'selfroster'; save(); render(); }});
  const out = {};
  const rec = rt.rec(p, 'M5');
  try {
    const day = await p.evaluate(() => window.__fixedDay); out.day = day; if (!day) throw new Error('no fixed day');
    await rt.sleep(1200);
    await rt.tap(p, '[data-bday="' + day + '"]', 1600, rec, '1 · Your fixed shift on the day sheet');
    await rt.zoom(p, '.note', 1.25, 1800); await rt.zoom(p, null);
    rec.mark('2 · Offer it to the group'); await rt.zoom(p, '[data-osoffer="' + day + '"]', 1.35, 2000); await rt.zoom(p, null);
    rec.mark('3 · Ask to come off'); await rt.zoom(p, '[data-osask="' + day + '"]', 1.35, 2000); await rt.zoom(p, null);
    rec.mark('4 · Swap it'); await rt.zoom(p, '[data-swapit="' + day + '"]', 1.35, 2000); await rt.zoom(p, null);
    await rt.tap(p, '[data-osoffer="' + day + '"]', 1200);
    if (await p.$('#cfOk')) await rt.tap(p, '#cfOk', 1400);
    await rt.sleep(900);
    if (!(await p.$('.note'))) await rt.tap(p, '[data-bday="' + day + '"]', 1300);   // the sheet closes after the offer: open the day again to see what it says now
    await rt.sleep(400);
    out.after = await p.evaluate(() => (document.body.innerText.match(/Offered to the group[^\n]{0,80}/) || [''])[0]);
    await rt.zoom(p, '.note', 1.2, 2200).catch(() => rt.sleep(2200)); await rt.zoom(p, null);
    await rt.sleep(1400);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
