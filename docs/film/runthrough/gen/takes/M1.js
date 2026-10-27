async (page) => {
  const rt = page.context().browser().__rt;
  const b = page.context().browser();
  const c = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, colorScheme:'light', permissions:['geolocation'], geolocation:{latitude:-37.9005, longitude:144.6598, accuracy: 25}});
  const p = await c.newPage(); p.__kind = 'phone';
  const out = {};
  await rt.open(p, {reset: true, prep: () => { S.clockOn = true; S.site = {lat:-37.9004, lng:144.6600, acc: 20, setAt: Date.now(), radius: 150, posterKey: 'demo-poster', posterAt: Date.now()}; const cy = active(); const today = iso(new Date()); cy.assign['demo-0|' + today] = {kind:'clinical', period:'PM', zone:'epic'}; S.tab = 'my'; save(); render(); }});
  const rec = rt.rec(p, 'M1');
  try {
    await rt.sleep(1200);
    const ci = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(e => e.offsetParent !== null && /^Clock in/i.test(e.innerText.trim())); if (b) { b.id = b.id || '__clockIn'; return '#' + b.id; } return null; });
    if (!ci) throw new Error('no Clock in button');
    rec.mark('1 · From an hour before your shift: Clock in'); await rt.zoom(p, ci, 1.4, 1200); await rt.zoom(p, null);
    await rt.tap(p, ci, 2200);
    out.afterIn = await p.evaluate(() => (document.body.innerText.replace(/\s+/g,' ').match(/.{0,60}(clinic|location|clocked|in \d\d:\d\d).{0,80}/i) || [''])[0]);
    rec.mark('2 · At the clinic: the tap goes through either way'); await rt.sleep(2000);
    // the afternoon passes: the clock-in record is moved back to the rostered start, so the clock-out can be judged
    await p.evaluate(() => { const cy = active(); const k = 'demo-0|' + iso(new Date()); const r = cy.clock && cy.clock[k]; if (r && r.in) { r.in.t = '15:34'; r.in.ts = r.in.ts - 7*3600e3; } save(); render(); }); await rt.sleep(600);
    const co = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(e => e.offsetParent !== null && /^Clock out/i.test(e.innerText.trim())); if (b) { b.id = b.id || '__clockOut'; return '#' + b.id; } return null; });
    out.co = co; if (!co) throw new Error('no Clock out button');
    await rt.zoom(p, co, 1.4, 1000); await rt.zoom(p, null); await rt.tap(p, co, 2200, rec, '3 · Clock out any time until the day ends');
    out.afterOut = await p.evaluate(() => (document.body.innerText.replace(/\s+/g,' ').match(/.{0,80}(waiting|rostered|approved|out \d\d:\d\d|Clocked).{0,100}/i) || [''])[0]);
    rec.mark('4 · Outside the grace band: waiting for your manager'); const st = await p.evaluate(() => { const e = Array.from(document.querySelectorAll('*')).find(x => /waiting for your|Clocked \d/.test(x.innerText || '') && x.children.length < 4); if (e) { e.id = e.id || '__clockLine'; return '#' + e.id; } return null; }); if (st) { await rt.zoom(p, st, 1.4, 2200); await rt.zoom(p, null); } else await rt.sleep(2200);
    await rt.sleep(800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await c.close();
  return out;
}