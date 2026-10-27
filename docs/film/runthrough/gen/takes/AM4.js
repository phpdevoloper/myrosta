async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'setup'});
  const out = {};
  const rec = rt.rec(p, 'AM4');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '[data-st="group"]', 1000, rec, '1 · Group, then Staff may set their own hours');
    await p.evaluate(() => document.getElementById('ownHours').scrollIntoView({block:'center', behavior:'smooth'})); await rt.sleep(900);
    await rt.zoom(p, '#ownHours', 1.45, 1200); await rt.zoom(p, null);
    await rt.tap(p, '#ownHours', 1200);
    await rt.tap(p, '[data-tab="roster"]', 1300, rec, '2 · Any cell: the Hours row');
    const cell = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button[data-s][data-d]')).find(e => e.dataset.s === 'demo-0' && e.dataset.d === '2026-10-20'); if (b) { b.id = b.id || '__cell'; return '#' + b.id; } return null; });
    await rt.tap(p, cell, 1200);
    await rt.zoom(p, '#hrFrom', 1.4, 1200); await rt.zoom(p, null);
    await p.evaluate(() => { const f = document.getElementById('hrFrom'); f.value = '09:30'; f.dispatchEvent(new Event('input', {bubbles:true})); f.dispatchEvent(new Event('change', {bubbles:true})); const t = document.getElementById('hrTo'); t.value = '15:00'; t.dispatchEvent(new Event('input', {bubbles:true})); t.dispatchEvent(new Event('change', {bubbles:true})); }); await rt.sleep(900);
    rec.mark('3 · Same as the type clears it'); await rt.zoom(p, '#hrSame', 1.3, 1200); await rt.zoom(p, null);
    if (await p.$('#editCmt')) await rt.type(p, '#editCmt', 'Starts after clinic', 50);
    await rt.tap(p, '#mSave', 1500, rec, '4 · Save: pay, the calendar, reminders and the board use the real hours');
    out.cellText = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button[data-s][data-d]')).find(e => e.dataset.s === 'demo-0' && e.dataset.d === '2026-10-20'); if (b) { b.id = '__cell2'; } return b ? b.innerText.replace(/\s+/g,' ') : null; });
    await rt.zoom(p, '#__cell2', 1.5, 1800).catch(()=>{}); await rt.zoom(p, null);
    await rt.sleep(800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}