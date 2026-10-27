async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { S.instantBook = false; save(); render(); }, viewAs: 'demo-0', tab: 'my'});   // the basket chapter: book-as-you-tap is the default since 12 Oct 2026, so the take switches it off
  const out = {};
  const rec = rt.rec(p, 'S2a');
  try {
    await rt.sleep(1500);
    await rt.tap(p, '.bottomnav [data-tab="selfroster"], [data-go="selfroster"]', 1500, rec, '1 · Open Book shifts');
    const findDay = async (after) => p.evaluate((after) => { const me=S.viewAs, today=iso(new Date()); for (const dt of cycleDates()) { const i=iso(dt); if (i<=today || i<=after) continue; if (getShift(me,i).kind!=="off") continue; for (const per of ["AM","PM"]) { if (S.zones.some(z=>canBook(me,i,per,z.id).ok)) return {i, per}; } } return null; }, after);
    const plus14 = i => { const d = new Date(i + 'T12:00:00'); d.setDate(d.getDate() + 13); return d.toISOString().slice(0, 10); };
    const openChip = async () => { const v = await p.evaluate(() => { const c=[...document.querySelectorAll('.zchip[data-pick]')].find(x=>/Open/.test(x.innerText)); return c?c.dataset.pick:null; }); if (!v) throw new Error('no open chip'); return '[data-pick="' + v + '"]'; };
    const first = await findDay(''); if (!first) throw new Error('no free day');
    await rt.tap(p, '[data-bday="' + first.i + '"]', 1600, rec, '2 · Tap a day');
    await rt.tap(p, '[data-dsper="' + first.per + '"]', 1200, rec, '3 · AM or PM, then a zone marked Open');
    await rt.zoom(p, '.zchip[data-pick]', 1.3, 2200); await rt.zoom(p, null);
    await rt.tap(p, await openChip(), 1600);
    await rt.zoom(p, '.srfoot', 1.3, 1600); await rt.zoom(p, null);
    const second = await findDay(plus14(first.i)); if (!second) throw new Error('no second free day');
    await rt.tap(p, '[data-bday="' + second.i + '"]', 1400, rec, '4 · Add more days');
    await rt.tap(p, '[data-dsper="' + second.per + '"]', 900);
    await rt.tap(p, await openChip(), 1400);
    await rt.zoom(p, '.srConfirm', 1.3, 1400); await rt.zoom(p, null);
    await rt.tap(p, '.srConfirm', 1800, rec, '5 · Confirm');
    rec.mark('6 · Your receipt'); await rt.zoom(p, '.srfoot.done', 1.35, 2800); await rt.zoom(p, null);
    await rt.sleep(1600);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
