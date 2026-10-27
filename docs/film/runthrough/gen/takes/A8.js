async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'setup', prep: () => { S.staff[7].mobile = ''; S.staff[7].email = ''; save(); render(); }});
  const out = {};
  const rec = rt.rec(p, 'A8');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '[data-st="cycle"]', 900, rec, '1 · A refused save says what would break');
    await p.evaluate(() => document.getElementById('card-notice').scrollIntoView({block:'start'})); await rt.sleep(900);
    await rt.tap(p, '#noticeDays', 300); await p.evaluate(() => { const e = document.getElementById('noticeDays'); e.value = '400'; e.dispatchEvent(new Event('input', {bubbles:true})); }); await rt.sleep(600);
    await rt.tap(p, '#saveNotice', 1400);
    out.msg = await p.evaluate(() => (document.body.innerText.match(/A whole number of days[^\n]{0,80}/) || [''])[0]);
    const msgEl = await p.evaluate(() => { const t = Array.from(document.querySelectorAll('#card-notice *')).find(e => e.children.length === 0 && /A whole number of days/.test(e.textContent)); if (t) { t.id = t.id || '__msg'; return '#' + t.id; } return null; });
    if (msgEl) { await rt.zoom(p, msgEl, 1.4, 2400).catch(()=>{}); await rt.zoom(p, null); } else await rt.sleep(1500);
    await p.evaluate(() => { const e = document.getElementById('noticeDays'); e.value = '7'; e.dispatchEvent(new Event('input', {bubbles:true})); }); await rt.sleep(300);
    await rt.tap(p, '[data-tab="staff"]', 1200, rec, "2 · Someone can't sign in: check their mobile or email");
    await rt.tap(p, '[data-sf="nologin"]', 1200);
    out.nologin = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(300, 520));
    const row = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('[data-stoggle]')).find(e => e.offsetParent !== null); if (b) { return '[data-stoggle="' + b.dataset.stoggle + '"]'; } return null; });
    if (row) { await rt.tap(p, row, 1200); const mob = await p.evaluate(() => { const e = Array.from(document.querySelectorAll('input')).find(x => x.offsetParent !== null && x.closest('label') && /Mobile/.test(x.closest('label').innerText)); if (e) { e.id = e.id || '__mobx'; return '#' + e.id; } return null; }); if (mob) { await rt.zoom(p, mob, 1.45, 1600); await rt.zoom(p, null); await rt.type(p, mob, '0400 000 333', 60); await p.keyboard.press('Tab'); await rt.sleep(800); } }
    rec.mark('3 · Then Sync allow-list under Access control, in the real app'); await rt.sleep(1600);
    await rt.tap(p, '[data-tab="help"]', 1200, rec, '4 · Help sends a note straight to the developer');
    await rt.zoom(p, '#fbOpen', 1.3, 900); await rt.zoom(p, null); await rt.tap(p, '#fbOpen', 1400);
    await rt.type(p, '#fbText', 'The leave card could show the EFT total for the day.', 30); await rt.sleep(1200);
    await rt.sleep(600);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}