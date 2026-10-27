async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'equity'});
  const out = {};
  const rec = rt.rec(p, 'A6');
  try {
    await rt.sleep(1400); rec.mark('1 · Fairness: the same table for everyone');
    await rt.scroll(p, 300, 1000); await rt.sleep(1200);
    await rt.zoom(p, '[data-eqp="three"]', 1.25, 1200); await rt.zoom(p, null);
    await rt.scroll(p, -300, 700);
    await rt.tap(p, '[data-tab="roster"]', 1200, rec, '2 · Roster, then Export');
    await rt.zoom(p, '#rosExport', 1.3, 800); await rt.zoom(p, null);
    await rt.tap(p, '#rosExport', 1400);
    out.menu = await p.evaluate(() => Array.from(document.querySelectorAll('button, a')).filter(e => e.offsetParent !== null && /Excel|CSV|RosterOn|Payroll|Clock report|workbook/i.test(e.innerText)).map(e => (e.id||'') + '|' + e.innerText.trim().slice(0,40) + '|' + Object.keys(e.dataset).map(k => k + '=' + e.dataset[k]).join(' ')));
    const first = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button, a')).find(e => e.offsetParent !== null && /Excel/i.test(e.innerText)); if (b) { b.id = b.id || '__xlsx'; return '#' + b.id; } return null; });
    rec.mark('3 · The grid as Excel or CSV; the payroll file when it is on');
    if (first) { await rt.zoom(p, first, 1.3, 2200); await rt.zoom(p, null); }
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}