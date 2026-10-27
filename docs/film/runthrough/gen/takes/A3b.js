async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'roster', prep: () => { const c = active(); c.settings.rosterMode = 'rolling'; S.rosterMode = 'rolling'; c.status = 'draft'; try { hydrateCycleSettings(); } catch(e) {} save(); render(); }});
  const out = {};
  const rec = rt.rec(p, 'A3b');
  try {
    await rt.sleep(1200); rec.mark('1 · Place first: tap a cell');
    const cell = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button[data-s][data-d]')).find(e => e.dataset.s === 'demo-0' && e.dataset.d === '2026-10-21'); if (b) { b.id = b.id || '__cell'; return '#' + b.id; } return null; });
    await rt.tap(p, cell, 1100);
    await rt.tap(p, '#modalRoot [data-kind="clinical"]', 700);
    const zone = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#modalRoot [data-zone]')).find(e => !e.disabled && !/has it/.test(e.innerText)); return b ? b.dataset.zone : null; });
    if (zone) await rt.tap(p, `#modalRoot [data-zone="${zone}"]`, 700);
    await rt.zoom(p, '#hrFrom', 1.35, 900); await rt.zoom(p, null);
    await rt.tap(p, '#mSave', 1300);
    rec.mark('2 · Gaps become open shifts'); await rt.zoom(p, '#gapsBtn', 1.3, 1200); await rt.zoom(p, null);
    await rt.tap(p, '#gapsBtn', 1400);
    out.gapsUI = await p.evaluate(() => Array.from(document.querySelectorAll('#modalRoot button, .overlay button')).filter(e => e.offsetParent !== null).map(e => e.innerText.trim().slice(0,30) + '|' + Object.keys(e.dataset).map(k => k + '=' + e.dataset[k]).join(' ')).slice(0,8));
    const bc = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(e => e.offsetParent !== null && /^Broadcast/i.test(e.innerText.trim())); if (b) { b.id = b.id || '__bc'; return '#' + b.id; } return null; });
    out.bc = bc; if (bc) { await rt.zoom(p, bc, 1.3, 900); await rt.zoom(p, null); await rt.tap(p, bc, 1400); if (await p.$('#cfOk')) await rt.tap(p, '#cfOk', 1000); }
    await p.evaluate(() => { try { closeModal(); } catch(e) {} }); await rt.sleep(300);
    await rt.tap(p, '[data-tab="selfroster"]', 1200, rec, '3 · Pre-fill the rest: fairly, keeping to the rules');
    await rt.zoom(p, '#adMin', 1.3, 1000); await rt.zoom(p, null);
    await rt.tap(p, '#adMin', 1500); if (await p.$('#cfOk')) await rt.tap(p, '#cfOk', 1500);
    rec.mark('4 · A booking window, if you want to place everything yourself for a while'); await p.evaluate(() => { const e = document.getElementById('schOn'); if (e) e.scrollIntoView({block:'center', behavior:'smooth'}); }); await rt.sleep(800);
    await rt.zoom(p, '#schOn', 1.3, 1600).catch(()=>{}); await rt.zoom(p, null);
    out.goBtns = await p.evaluate(() => Array.from(document.querySelectorAll('[data-status]')).filter(e => e.offsetParent !== null).map(e => e.dataset.status + '|' + e.innerText.trim().slice(0,30)));
    const go = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('[data-status]')).find(e => e.offsetParent !== null && /Go live/i.test(e.innerText)) || Array.from(document.querySelectorAll('[data-status="published"]')).find(e => e.offsetParent !== null); if (b) { b.id = b.id || '__go'; return '#' + b.id; } return null; });
    out.go = go; if (go) { await rt.zoom(p, go, 1.3, 900); await rt.zoom(p, null); await rt.tap(p, go, 1300, rec, '5 · Go live: from now the app is the record'); if (await p.$('#cfOk')) await rt.tap(p, '#cfOk', 1800); }
    out.after = await p.evaluate(() => (document.body.innerText.match(/Live — add or drop|Published \(live\)|live/) || [''])[0]);
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}