async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  // the film's R3: the roster grid filling during an open round. Snapshot the assignments, drop 60% of the other people's clinical shifts in weeks 1-3, hold, restore in three groups 1.7 s apart, verify the map is identical.
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'roster', prep: () => { S.branding.hospital = 'Wattle Hospital'; S.staff[3].name = 'Emma Walsh'; S.staff[3].initials = 'EW'; S.staff[4].name = 'Alex Campbell'; S.staff[4].initials = 'AC'; save(); render(); }});
  const out = {};
  await p.evaluate(() => { const c = active(); window.__snap = JSON.stringify(c.assign); const ds = cycleDates().slice(0, 21).map(d => iso(d)); const keys = Object.keys(c.assign).filter(k => { const [sid, d] = k.split('|'); return ds.includes(d) && sid !== 'demo-0' && sid !== 'demo-3' && c.assign[k].kind === 'clinical'; }); let i = 0; const groups = [[], [], []]; keys.forEach(k => { if ((i++ % 5) < 3) groups[i % 3].push(k); }); window.__groups = groups; groups.flat().forEach(k => delete c.assign[k]); render(); window.scrollTo(0, 0); });
  await rt.sleep(400);
  const rec = rt.rec(p, 'R3');
  try {
    await rt.sleep(1700);
    for (let g = 0; g < 3; g++) { await p.evaluate((g) => { const c = active(), snap = JSON.parse(window.__snap); window.__groups[g].forEach(k => { c.assign[k] = snap[k]; }); render(); }, g); await rt.sleep(1700); }
    out.same = await p.evaluate(() => JSON.stringify(active().assign) === window.__snap);
    await p.evaluate(() => save());
    await rt.sleep(2200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
