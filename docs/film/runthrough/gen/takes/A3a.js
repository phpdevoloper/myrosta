async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'selfroster', prep: () => { const c = active(); c.status = 'draft'; save(); render(); }});
  const out = {};
  const rec = rt.rec(p, 'A3a');
  try {
    await rt.sleep(1200);
    await rt.zoom(p, '[data-status="open"]', 1.3, 1000); await rt.zoom(p, null);
    await rt.tap(p, '[data-status="open"]', 1200, rec, '1 · Open booking: the roster lands on every phone');
    if (await p.$('#cfOk')) await rt.tap(p, '#cfOk', 1400);
    await rt.tap(p, '[data-tab="roster"]', 1400, rec, '2 · The grid fills itself; red means short');
    await rt.zoom(p, '#gapsBtn', 1.3, 1200); await rt.zoom(p, null);
    await rt.tap(p, '#gapsToggle', 1600);
    await rt.scroll(p, 300, 900); await rt.sleep(800); await rt.scroll(p, -300, 700);
    await rt.tap(p, '[data-tab="selfroster"]', 1000, rec, '3 · Close booking, then Publish');
    await rt.tap(p, '[data-status="closed"]', 1200); if (await p.$('#cfOk')) await rt.tap(p, '#cfOk', 1200);
    await rt.tap(p, '[data-status="published"]', 1200); if (await p.$('#cfOk')) await rt.tap(p, '#cfOk', 1600);
    await rt.tap(p, '[data-tab="roster"]', 1000, rec, '4 · Change a cell afterwards: with a reason');
    const cell = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button[data-s][data-d]')).find(e => e.dataset.s === 'demo-0' && e.dataset.d === '2026-10-20'); if (b) { b.id = b.id || '__cell'; return '#' + b.id; } return null; });
    if (!cell) throw new Error('no cell');
    await rt.tap(p, cell, 1200);
    out.editorText = await p.evaluate(() => (document.querySelector('#modalRoot') || {innerText: ''}).innerText.replace(/\s+/g,' ').slice(0, 200));
    const zone = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#modalRoot [data-zone]')).find(e => !e.disabled && !/has it/.test(e.innerText) && e.dataset.zone !== 'epic'); return b ? b.dataset.zone : null; });
    out.zone = zone; if (zone) await rt.tap(p, `#modalRoot [data-zone="${zone}"]`, 800);
    await rt.zoom(p, '#editCmt', 1.4, 700); await rt.zoom(p, null);
    await rt.type(p, '#editCmt', 'Resus cover', 55);
    await rt.tap(p, '#mSave', 1500);
    out.afterSave = await p.evaluate(() => ({modal: !!document.querySelector('#modalRoot .overlay'), text: (document.querySelector('#modalRoot') || {innerText: ''}).innerText.replace(/\s+/g,' ').slice(0, 220)}));
    if (out.afterSave.modal) { await p.evaluate(() => { try { closeModal(); } catch(e) {} }); await rt.sleep(400); }
    await rt.tap(p, '[data-tab="audit"]', 1400, rec, '5 · Every change, with a name and a time');
    await rt.zoom(p, '[data-af="roster"]', 1.25, 1800); await rt.zoom(p, null);
    await rt.sleep(800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}