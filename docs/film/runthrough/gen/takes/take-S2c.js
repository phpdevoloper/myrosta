async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { S.instantBook = true; save(); render(); }, viewAs: 'demo-0', tab: 'my'});
  const out = {};
  const rec = rt.rec(p, 'S2c');
  try {
    await rt.sleep(1500);
    await rt.tap(p, '.bottomnav [data-tab="selfroster"], [data-go="selfroster"]', 1500, rec, '1 · Book shifts');   // the phone's bottom bar (the hidden desktop strip comes first in the DOM)
    // a day ahead with a free zone for this person in either half (and no shift of theirs yet), after a given date
    const findDay = async (after) => p.evaluate((after) => { const me=S.viewAs, today=iso(new Date()); for (const dt of cycleDates()) { const i=iso(dt); if (i<=today || i<=after) continue; if (getShift(me,i).kind!=="off") continue; for (const per of ["AM","PM"]) { if (S.zones.some(z=>canBook(me,i,per,z.id).ok)) return {i, per}; } } return null; }, after);
    const plus14 = i => { const d = new Date(i + 'T12:00:00'); d.setDate(d.getDate() + 13); return d.toISOString().slice(0, 10); };
    const first = await findDay('');
    if (!first) throw new Error('no free day');
    const perSel = d => '[data-dsper="' + d.per + '"]';   // the day sheet's half-of-day buttons
    const openChip = async () => { const v = await p.evaluate(() => { const c=[...document.querySelectorAll('.zchip[data-pick]')].find(x=>/Open/.test(x.innerText)); return c?c.dataset.pick:null; }); if (!v) throw new Error('no open chip'); return '[data-pick="' + v + '"]'; };
    await rt.tap(p, '[data-bday="' + first.i + '"]', 1500, rec, '2 · Tap a day');
    await rt.tap(p, perSel(first), 1400, rec, '3 · AM or PM');
    await rt.tap(p, await openChip(), 2200, rec, '4 · Tap a zone: booked');
    rec.mark('5 · The receipt'); await rt.zoom(p, '.srfoot.done', 1.35, 2600); await rt.zoom(p, null); await rt.sleep(400);
    const second = await findDay(plus14(first.i));   // the next fortnight, so the share for this one is not the thing that stops it
    if (!second) throw new Error('no second free day');
    await rt.tap(p, '[data-bday="' + second.i + '"]', 1400, rec, '6 · Add another day');
    await rt.tap(p, perSel(second), 1200);
    await rt.tap(p, await openChip(), 2600);
    await rt.sleep(1800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
