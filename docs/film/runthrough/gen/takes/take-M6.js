async (page) => {
  const rt = page.context().browser().__rt;
  const b = page.context().browser();
  const out = {};
  const c = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, colorScheme:'light', permissions:['geolocation'], geolocation:{latitude:-37.9005, longitude:144.6598, accuracy: 25}});
  const p = await c.newPage(); p.__kind = 'phone'; await p.clock.install({time: new Date('2026-10-13T10:00:00')});
  await rt.open(p, {reset: true, prep: () => { S.clockOn = true; S.clockWalkin = true; S.site = {lat:-37.9004, lng:144.6600, acc: 20, setAt: Date.now(), radius: 150, posterKey: 'demo-poster', posterAt: Date.now()}; const cy = active(); const today = iso(new Date()); delete cy.assign['demo-0|' + today]; S.viewAs = 'demo-0'; S.tab = 'my'; save(); render(); }});
  const rec = rt.rec(p, 'M6');
  try {
    await rt.sleep(1400);
    await rt.zoom(p, '[data-walkin]', 1.3, 1200); await rt.zoom(p, null);
    await rt.tap(p, '[data-walkin]', 1500, rec, '1 · My shifts: Clock in — not rostered');
    await rt.tap(p, '[data-wkper="AM"]', 900, rec, '2 · Pick the half and the zone');
    await rt.tap(p, '[data-wkzone]', 1100);
    await rt.tap(p, '#wkGo', 2200, rec, '3 · Clocked in: a casual shift for your admin to approve');
    out.after = await p.evaluate(() => (document.body.innerText.match(/Clocked in [^\n]{0,60}/) || [''])[0]);
    await rt.sleep(2200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await c.close();
  return out;
}
