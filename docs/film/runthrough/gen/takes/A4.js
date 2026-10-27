async (page) => {
  const rt = page.context().browser().__rt;
  const out = {};
  // prep on a phone page, unrecorded: a swap via Ask everyone accepted, an ask to come off, a leave request
  const ph = await rt.phone();
  await rt.open(ph, {reset: true, prep: () => { const c = active(); c.settings.noticeDays = 7; try { hydrateCycleSettings(); } catch(e) {} save(); render(); }});
  const viewAs = async (who, tab) => { await ph.evaluate(([who, tab]) => { S.viewAs = who; S.tab = tab; _moreOpen = false; _daySheet = null; save(); render(); const n = document.getElementById('ovlNotifs'); if (n) n.remove(); window.scrollTo(0,0); }, [who, tab]); await rt.sleep(500); };
  try {
    await viewAs('demo-0', 'selfroster'); await ph.evaluate(() => openDaySheet('2026-10-24')); await rt.sleep(300);
    await ph.evaluate(() => document.querySelector('[data-swapit]').click()); await rt.sleep(400); await ph.evaluate(() => document.querySelector('[data-swmode="all"]').click()); await rt.sleep(300); await ph.evaluate(() => document.getElementById('swAsk').click()); await rt.sleep(500);
    await viewAs('demo-4', 'requests'); const sel = await ph.evaluate(() => { const s = Array.from(document.querySelectorAll('select')).find(e => /swofs/.test(e.id)); return s ? s.id : null; }); out.sel = sel;
    if (sel) { await ph.evaluate((id) => { const s = document.getElementById(id); s.value = Array.from(s.options).map(o => o.value).find(v => v); s.dispatchEvent(new Event('change', {bubbles:true})); }, sel); await rt.sleep(300); await ph.evaluate(() => document.querySelector('[data-swoffer]').click()); await rt.sleep(500); }
    await viewAs('demo-0', 'requests'); await ph.evaluate(() => { const b = document.querySelector('[data-swaccept]'); if (b) b.click(); }); await rt.sleep(400); await ph.evaluate(() => { const b = document.getElementById('cfOk'); if (b) b.click(); }); await rt.sleep(500);
    await viewAs('demo-0', 'selfroster'); await ph.evaluate(() => openDaySheet('2026-10-11')); await rt.sleep(300); await ph.evaluate(() => document.querySelector('[data-osask]').click()); await rt.sleep(300); await ph.evaluate(() => { document.getElementById('askWhy').value = 'Family funeral'; document.getElementById('askSend').click(); }); await rt.sleep(500);
    await viewAs('demo-0', 'requests'); await ph.evaluate(() => document.getElementById('reqLeave').click()); await rt.sleep(400);
    await ph.evaluate(() => { const f = document.getElementById('lvFrom'), t = document.getElementById('lvTo'); f.value = '2026-11-16'; f.dispatchEvent(new Event('change', {bubbles:true})); t.value = '2026-11-20'; t.dispatchEvent(new Event('change', {bubbles:true})); document.getElementById('lvReason').value = 'School holidays'; }); await rt.sleep(300); await ph.evaluate(() => document.getElementById('lvSubmit').click()); await rt.sleep(600);
    out.pending = await ph.evaluate(() => (S.requests || []).map(r => r.type + ':' + r.status).join(', '));
  } catch (e) { out.prepError = String(e).slice(0, 200); }
  const state = await rt.state(ph); await ph.context().close();
  // the admin's laptop
  const p = await rt.laptop();
  await rt.open(p, {state, viewAs: 'admin', tab: 'requests'});
  const rec = rt.rec(p, 'A4');
  try {
    await rt.sleep(1400); rec.mark('1 · Requests: each one with what you need to decide');
    out.reqText = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(100, 700));
    out.btns = await p.evaluate(() => Array.from(document.querySelectorAll('button')).filter(e => e.offsetParent !== null && /approve|decline|keep|let them|question|call/i.test(e.innerText)).map(e => (e.id||'') + '|' + e.innerText.trim().slice(0,24) + '|' + Object.keys(e.dataset).map(k => k + '=' + e.dataset[k]).join(' ')));
    const sw = await p.$('[data-approveswap]'); if (sw) { await rt.zoom(p, '[data-approveswap]', 1.3, 1800, rec); await rt.zoom(p, null); rec.mark('2 · A swap: the two shifts side by side'); await rt.tap(p, '[data-approveswap]', 1400); }
    const ask = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(e => e.offsetParent !== null && /Let them off|Keep them on/i.test(e.innerText)); if (b) { b.id = b.id || '__ask'; return '#' + b.id; } return null; });
    out.ask = ask; if (ask) { rec.mark('3 · An ask to come off: the notice left, the cover without them, who is free'); await rt.zoom(p, ask, 1.25, 2400); await rt.zoom(p, null); const off = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(e => e.offsetParent !== null && /Let them off/i.test(e.innerText)); if (b) { b.id = b.id || '__letoff'; return '#' + b.id; } return null; }); if (off) await rt.tap(p, off, 1400); }
    const lv = await p.$('[data-approve]'); if (lv) { rec.mark('4 · Leave: EFT, leave taken, this request, who else is away, the cap'); await rt.zoom(p, '[data-approve]', 1.2, 2600); await rt.zoom(p, null); await rt.tap(p, '[data-approve]', 1600, rec, '5 · Approve: their shifts those days go to the group'); }
    out.after = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(100, 300));
    await rt.sleep(1000);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}