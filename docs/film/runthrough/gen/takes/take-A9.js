async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'staff', prep: () => { const s = S.staff[2]; s.mode = 'fixed'; const z = S.zones[0].id; s.fixedPattern = {recurrence: 'fourweekly', A: {'3': {period: 'AM', zone: z}}, B: {}, C: {}, D: {}, M: [], committed: false};
    const c = active(); let n = 0; cycleDates().forEach(d => { const i = iso(d); if (parseISO(i).getDay() === 3 && cycleWeekN(i, 4) === 'A') { n++; c.assign[s.id + '|' + i] = {kind: 'clinical', period: n === 2 ? 'PM' : 'AM', zone: z, fixed: true}; } }); save(); render(); }});
  const out = {};
  const tapText = async (txt, hold, label) => { const sel = await p.evaluate(t => { const b = Array.from(document.querySelectorAll('button')).find(x => x.offsetParent !== null && x.innerText.trim() === t); if (!b) return null; b.id = b.id || ('__t' + Math.random().toString(36).slice(2, 6)); return '#' + b.id; }, txt); if (!sel) throw new Error('no button ' + txt); await rt.tap(p, sel, hold, rec, label); };
  const rec = rt.rec(p, 'A9');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '[data-stoggle="demo-2"]', 1100, rec, '1 · Staff, then Pattern: four ways to repeat');
    await tapText('Pattern', 1300);
    await rt.zoom(p, '.fp-rec[data-rec="fourweekly"]', 1.25, 1200); await rt.zoom(p, null);
    await rt.tap(p, '.fp-rec[data-rec="fourweekly"]', 900, rec, '2 · Every 4 weeks: weeks A to D');
    await rt.zoom(p, '.fp-p[data-wk="A"][data-wd="3"]', 1.35, 1500); await rt.zoom(p, null);
    await p.evaluate(() => { const t = Array.from(document.querySelectorAll('.sub')).find(x => /Week C/.test(x.innerText)); if (t) t.scrollIntoView({block: 'center', behavior: 'smooth'}); }); await rt.sleep(1300);
    await rt.tap(p, '.fp-rec[data-rec="monthly"]', 1100, rec, '3 · Calendar month: the first Wednesday');
    await rt.tap(p, '.fp-madd', 900);
    await rt.zoom(p, '.fp-mw', 1.3, 1100); await rt.zoom(p, null);
    await rt.zoom(p, '.fp-mp', 1.3, 1300); await rt.zoom(p, null);
    await rt.tap(p, '.fp-rec[data-rec="fourweekly"]', 800);
    await tapText('Save pattern', 1200, '4 · Save, then Commit to lock it');
    await tapText('Pattern', 800);
    await tapText('Commit (lock)', 1500);
    await rt.tap(p, '[data-tab="roster"]', 1200, rec, '5 · Roster, then Fixed cover: what the patterns alone place');
    await rt.zoom(p, '#fixedToggle', 1.3, 900); await rt.zoom(p, null);
    await rt.tap(p, '#fixedToggle', 1800);
    await rt.scroll(p, 160, 900); await rt.sleep(900);
    rec.mark('6 · The weekday summary: the recruiting brief'); await p.evaluate(() => { const h = Array.from(document.querySelectorAll('h3')).find(x => /Weekday summary/.test(x.innerText)); if (h) h.scrollIntoView({block: 'start', behavior: 'smooth'}); }); await rt.sleep(2400);
    rec.mark('7 · Drift: what changed from the pattern'); await p.evaluate(() => { const h = Array.from(document.querySelectorAll('h3')).find(x => /Drift this cycle/.test(x.innerText)); if (h) h.scrollIntoView({block: 'start', behavior: 'smooth'}); }); await rt.sleep(2600);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
