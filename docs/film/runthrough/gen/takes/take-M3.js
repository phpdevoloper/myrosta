async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { S.ownHours = true; delete S.instantBook; save(); render(); }});   // own hours on; book-as-you-tap is the default (12 Oct 2026)
  const out = {};
  const chips = () => p.evaluate(() => Array.from(document.querySelectorAll('[data-pick]')).map(c => ({d: c.dataset.pick, t: c.innerText.replace(/\s+/g,' ').slice(0,30), dis: c.disabled || c.getAttribute('aria-disabled') === 'true'})));
  const tagTimes = () => p.evaluate(() => Array.from(document.querySelectorAll('input[type=time]')).filter(e => e.offsetParent !== null).map((e, i) => { e.id = e.id || ('__t' + i); return e.id; }));
  const setTime = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); }, [id, v]); await rt.sleep(700); };
    const findDay = async (after) => p.evaluate((after) => { const me=S.viewAs, today=iso(new Date()); for (const dt of cycleDates()) { const i=iso(dt); if (i<=today || i<=after) continue; if (getShift(me,i).kind!=="off") continue; for (const per of ["AM","PM"]) { if (S.zones.some(z=>canBook(me,i,per,z.id).ok)) return {i, per}; } } return null; }, after);
  const day = await findDay(''); if (!day) throw new Error('no free day'); out.day = day;   // the first day ahead this person can book, not a fixed date: the demo's shifts move with today
  const rec = rt.rec(p, 'M3');
  try {
    await rt.sleep(1000);
    await rt.tap(p, '.bottomnav [data-tab="selfroster"], [data-go="selfroster"]', 900, rec, "1 · Book a zone: the shift takes the type's hours");
    await rt.tap(p, '[data-bday="' + day.i + '"]', 900);
    const cs = await chips(); const o = cs.find(c => /Open/.test(c.t) && !c.dis); if (!o) throw new Error('no open chip');
    await rt.tap(p, `[data-pick="${o.d}"]`, 1500);   // booked there and then; the receipt shows
    await rt.zoom(p, '.srfoot.done', 1.3, 1200); await rt.zoom(p, null);
    await rt.tap(p, '[data-bday="' + day.i + '"]', 900, rec, '2 · Open the booked shift: Change hours');
    const ch = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#sheetRoot button')).find(e => /Change hours/i.test(e.innerText)); if (b) { b.id = b.id || '__chgHours'; return '#' + b.id; } return null; });
    out.ch = ch; if (!ch) throw new Error('no Change hours: ' + JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('#sheetRoot button')).map(e => e.innerText.trim().slice(0,20)))));
    await rt.zoom(p, ch, 1.3, 800); await rt.zoom(p, null);
    await rt.tap(p, ch, 1000);
    const ids = await tagTimes(); out.ids = ids; if (!ids.length) throw new Error('no time inputs');
    rec.mark('3 · Set your start or finish, then Save'); await rt.zoom(p, '#' + ids[0], 1.45, 1000); await rt.zoom(p, null);
    await rt.tap(p, '#' + ids[0], 300); await setTime(ids[0], '09:30'); await rt.sleep(700);
    const sv = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#sheetRoot button')).find(e => /^Save$/i.test(e.innerText.trim())); if (b) { b.id = b.id || '__hrSave'; return '#' + b.id; } return null; });
    out.sv = sv; if (!sv) throw new Error('no Save');
    await rt.tap(p, sv, 1600, rec, '4 · Save: pay and the calendar use your hours');
    out.afterSave = await p.evaluate(() => { const s = document.querySelector('#sheetRoot .sheet'); return (s ? s.innerText : document.body.innerText).replace(/\s+/g,' ').slice(0, 220); });
    await rt.sleep(1500);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
