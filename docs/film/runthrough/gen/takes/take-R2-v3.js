async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  // the film's cast: Emma Walsh is demo-3 (renamed from the seed's Amara Okafor), Alex Campbell is demo-4. Emma's later shifts are cleared so she has her share to book; book-as-you-tap is the default (12 Oct 2026)
  await rt.open(p, {reset: true, prep: () => { const k = 'myrosta_demo_v7'; let s = localStorage.getItem(k); s = s.split('Amara Okafor').join('Emma Walsh').split('Alex Chen').join('Alex Campbell'); localStorage.setItem(k, s); load(); const T = iso(new Date()); const A = CTX().assign; for (const k of Object.keys(A)) { if (k.startsWith('demo-3|') && k.slice(7) > T) delete A[k]; } delete S.instantBook; S.viewAs = 'demo-3'; S.tab = 'my'; save(); render(); }});
  const out = {};
  const rec = rt.rec(p, 'R2');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '.bottomnav [data-tab="selfroster"], [data-go="selfroster"]', 1500, rec, 'book');
    const findDay = async (after) => p.evaluate((after) => { const me=S.viewAs, today=iso(new Date()); for (const dt of cycleDates()) { const i=iso(dt); if (i<=today || i<=after) continue; if (getShift(me,i).kind!=="off") continue; for (const per of ["AM","PM"]) { if (S.zones.some(z=>canBook(me,i,per,z.id).ok)) return {i, per}; } } return null; }, after);
    const plus14 = i => { const d = new Date(i + 'T12:00:00'); d.setDate(d.getDate() + 13); return d.toISOString().slice(0, 10); };
    const openChip = async () => { const v = await p.evaluate(() => { const c=[...document.querySelectorAll('.zchip[data-pick]')].find(x=>/Open/.test(x.innerText)); return c?c.dataset.pick:null; }); if (!v) throw new Error('no open chip'); return '[data-pick="' + v + '"]'; };
    const first = await findDay(''); if (!first) throw new Error('no free day'); out.first = first;
    await rt.tap(p, '[data-bday="' + first.i + '"]', 1500, rec, 'day');
    await rt.tap(p, '[data-dsper="' + first.per + '"]', 1000, rec, 'half');
    await rt.zoom(p, '.zchip[data-pick]', 1.3, 1800); await rt.zoom(p, null);
    await rt.tap(p, await openChip(), 1600, rec, 'tap: booked');
    rec.mark('receipt'); await rt.zoom(p, '.srfoot.done', 1.35, 2400); await rt.zoom(p, null);
    const second = await findDay(plus14(first.i)); if (!second) throw new Error('no second free day'); out.second = second;
    await rt.tap(p, '[data-bday="' + second.i + '"]', 1300, rec, 'second day');
    await rt.tap(p, '[data-dsper="' + second.per + '"]', 900);
    await rt.tap(p, await openChip(), 1800, rec, 'second: booked');
    await rt.zoom(p, '.srfoot.done', 1.35, 2200); await rt.zoom(p, null);
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
