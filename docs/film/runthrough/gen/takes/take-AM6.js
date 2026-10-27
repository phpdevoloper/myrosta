async (page) => {
  const rt = page.context().browser().__rt;
  const b = page.context().browser();
  const out = {};
  // prep on a phone, unrecorded: a walk-in clocked in at 10:00 and out at 16:02, waiting for the admin
  const c = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, permissions:['geolocation'], geolocation:{latitude:-37.9005, longitude:144.6598, accuracy: 25}});
  const ph = await c.newPage(); ph.__kind = 'phone'; await ph.clock.install({time: new Date('2026-10-10T10:00:00')});
  await rt.open(ph, {reset: true, prep: () => { S.clockOn = true; S.clockWalkin = true; S.site = {lat:-37.9004, lng:144.6600, acc: 20, setAt: Date.now(), radius: 150, posterKey: 'demo-poster', posterAt: Date.now()}; const cy = active(); const today = iso(new Date()); delete cy.assign['demo-3|' + today]; S.viewAs = 'demo-3'; S.tab = 'my'; save(); render(); }});
  out.prep = await ph.evaluate(() => { const today = iso(new Date()); const r = walkinStart('demo-3', today, 'AM', S.zones[1].id, {dist: 12, acc: 20, inside: true, via: 'gps'}, new Date()); const later = new Date(); later.setHours(16, 2, 0, 0); const w = clockWrite(active(), 'demo-3', today, 'out', later, {dist: 9, acc: 20, inside: true, via: 'gps'}); save(); return {walkin: r.ok, out: w.ok, status: clockProposal(active(), 'demo-3', today, clockGrace(), later).status}; });
  const state = await rt.state(ph); await c.close();
  const p = await rt.laptop(); await p.clock.install({time: new Date('2026-10-10T16:20:00')});
  await rt.open(p, {state, viewAs: 'admin', tab: 'setup'});
  const rec = rt.rec(p, 'AM6');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '[data-st="group"]', 1000, rec, '1 · Clock card: Staff not rostered today may clock in');
    await p.evaluate(() => document.getElementById('clockCard').scrollIntoView({block:'start', behavior:'smooth'})); await rt.sleep(900);
    await rt.zoom(p, '#clockWalkin', 1.45, 2600); await rt.zoom(p, null);
    await rt.tap(p, '[data-tab="requests"]', 1400, rec, '2 · Hours to approve: the walk-in, flagged');
    const row = await p.evaluate(() => { const r = Array.from(document.querySelectorAll('#clockList .listrow')).find(e => /walk-in/.test(e.innerText)); if (r) { r.id = r.id || '__wkrow'; return '#' + r.id; } return null; });
    out.row = row; if (row) { await rt.zoom(p, row, 1.25, 2600); await rt.zoom(p, null); }
    const ap = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#clockList button')).find(e => e.offsetParent !== null && /^Approve$/i.test(e.innerText.trim())); if (b) { b.id = b.id || '__wkApprove'; return '#' + b.id; } return null; });
    out.ap = ap; if (ap) { await rt.tap(p, ap, 1800, rec, '3 · Approve keeps the shift with the clocked hours; Decline removes it'); }
    await rt.sleep(1400);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
