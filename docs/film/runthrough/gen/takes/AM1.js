async (page) => {
  const rt = page.context().browser().__rt;
  const b = page.context().browser();
  const out = {};
  // prep on a phone: a clock-out outside the grace band leaves hours to approve
  const c = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, permissions:['geolocation'], geolocation:{latitude:-37.9005, longitude:144.6598, accuracy: 25}});
  const ph = await c.newPage(); ph.__kind = 'phone'; await ph.clock.install({time: new Date('2026-10-08T16:00:00')});   // mid-afternoon, inside the PM shift, whatever the real time is
  await rt.open(ph, {reset: true, prep: () => { S.clockOn = true; S.site = {lat:-37.9004, lng:144.6600, acc: 20, setAt: Date.now(), radius: 150, posterKey: 'demo-poster', posterAt: Date.now()}; const cy = active(); const today = iso(new Date()); cy.assign['demo-0|' + today] = {kind:'clinical', period:'PM', zone:'epic'}; S.tab = 'my'; save(); render(); }});
  await ph.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(e => /^Clock in/i.test(e.innerText.trim())); b.click(); }); await rt.sleep(1200);
  await ph.evaluate(() => { const cy = active(); const k = 'demo-0|' + iso(new Date()); const r = cy.clock && cy.clock[k]; if (r && r.in) { r.in.t = '15:34'; r.in.ts = r.in.ts - 7*3600e3; } save(); render(); }); await rt.sleep(400);
  await ph.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(e => /^Clock out/i.test(e.innerText.trim())); if (b) b.click(); }); await rt.sleep(1200);
  out.phone = await ph.evaluate(() => (document.body.innerText.replace(/\s+/g,' ').match(/Clocked [^M]{0,80}/) || [''])[0]);
  const state = await rt.state(ph); await c.close();
  const p = await rt.laptop(); await p.clock.install({time: new Date('2026-10-08T16:20:00')});
  await rt.open(p, {state, viewAs: 'admin', tab: 'setup'});
  const rec = rt.rec(p, 'AM1');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '[data-st="group"]', 1000, rec, '1 · Settings, This staff group, Clock');
    await p.evaluate(() => document.getElementById('clockCard').scrollIntoView({block:'start', behavior:'smooth'})); await rt.sleep(900);
    await rt.zoom(p, '#siteHere', 1.3, 1500); await rt.zoom(p, null); rec.mark('2 · The site, the radius, the grace band, the poster');
    await rt.zoom(p, '#clockGrace', 1.3, 1200); await rt.zoom(p, null);
    await rt.zoom(p, '#clockOn', 1.4, 1200); await rt.zoom(p, null);
    await rt.tap(p, '[data-tab="requests"]', 1400, rec, '3 · Hours to approve: rostered against clocked, the proposal, the flags');
    out.req = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(100, 520));
    out.btns = await p.evaluate(() => Array.from(document.querySelectorAll('button')).filter(e => e.offsetParent !== null && /approve|decline/i.test(e.innerText)).map(e => (e.id||'') + '|' + e.innerText.trim().slice(0,20) + '|' + Object.keys(e.dataset).map(k => k + '=' + e.dataset[k]).join(' ')));
    const ap = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(e => e.offsetParent !== null && /^Approve$/i.test(e.innerText.trim()) && !/approveswap/.test(Object.keys(e.dataset).join(' '))); if (b) { b.id = b.id || '__hrsApprove'; return '#' + b.id; } return null; });
    if (ap) { await rt.zoom(p, ap, 1.25, 2200); await rt.zoom(p, null); await rt.tap(p, ap, 1500, rec, '4 · Approve writes the real hours for pay; nothing is paid on a tap alone'); }
    await rt.tap(p, '[data-tab="roster"]', 1200, rec, '5 · Roster, Export, the Clock report for the pay office');
    await rt.tap(p, '#rosExport', 1200);
    const cr = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button, a')).find(e => e.offsetParent !== null && /Clock report/i.test(e.innerText)); if (b) { b.id = b.id || '__clockrep'; return '#' + b.id; } return null; });
    out.cr = cr; if (cr) { await rt.zoom(p, cr, 1.3, 2000); await rt.zoom(p, null); } else await rt.sleep(1500);
    await rt.sleep(800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}