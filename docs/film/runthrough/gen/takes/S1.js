async (page) => {
  const rt = page.context().browser().__rt;
  const b = page.context().browser();
  const c = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, colorScheme:'light'});
  const hits = [];
  await c.route(/supabase\.co/, async route => { hits.push(route.request().method() + ' ' + route.request().url().slice(0, 100)); await route.fulfill({status: 200, contentType: 'application/json', body: '{}'}); });
  const p = await c.newPage(); p.__kind = 'phone';
  await p.goto('http://localhost:8903/app.html', {waitUntil: 'load'}); await rt.sleep(1500); await rt.overlay(p);
  const rec = rt.rec(p, 'S1');
  await rt.sleep(1200);
  await rt.tap(p, '.chanrow[data-am="sms"]', 700, rec, '1 · Choose Text me a code');
  rec.mark('2 · Enter your mobile'); await rt.type(p, '#authPhoneInput', '0400 000 123', 70); await rt.sleep(500);
  await rt.tap(p, '#authSend', 1400, rec, '3 · Tap Send code');
  const afterSend = await p.evaluate(() => ({text: document.body.innerText.replace(/\s+/g,' ').slice(0, 300), inputs: Array.from(document.querySelectorAll('input')).filter(e => e.offsetParent !== null).map(e => ({id: e.id, type: e.type, im: e.inputMode, ac: e.autocomplete, ph: e.placeholder}))}));
  const codeSel = afterSend.inputs.find(i => /one-time|numeric/.test((i.ac||'') + ' ' + (i.im||'')) || /code/i.test(i.id + ' ' + i.ph));
  if (codeSel) { rec.mark('4 · Type the 6-digit code'); await rt.type(p, '#' + codeSel.id, '482913', 140); await rt.sleep(1600); }
  const out = await rec.stop();
  out.hits = hits; out.afterSend = afterSend; out.codeSel = codeSel || null;
  out.final = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 240));
  await c.close();
  return out;
}