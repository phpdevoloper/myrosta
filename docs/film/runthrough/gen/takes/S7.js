async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const out = {};
  const go = async (tab, label) => { await rt.tap(p, '#bnMore', 700, rec, label); await rt.tap(p, `.sheetrow[data-tab="${tab}"]`, 900); };
  const rec = rt.rec(p, 'S7');
  try {
    await rt.sleep(1000);
    await rt.tap(p, '#bell', 1200, rec, '1 · The bell');
    await rt.zoom(p, '#ovlNotifs', 1.15, 1800).catch(()=>{}); await rt.zoom(p, null);
    await p.evaluate(() => { const n = document.getElementById('ovlNotifs'); if (n) n.remove(); }); await rt.sleep(400);
    await go('daily', '2 · Day board: who is on today');
    await rt.sleep(1800);
    await go('equity', '3 · Fairness: the same table for everyone');
    await rt.scroll(p, 300, 1000); await rt.sleep(1200);
    await go('help', '4 · Help, and Send feedback');
    await rt.zoom(p, '#fbOpen', 1.3, 900); await rt.zoom(p, null);
    await rt.tap(p, '#fbOpen', 1400);
    out.fb = await p.evaluate(() => Array.from(document.querySelectorAll('#modalRoot textarea, #modalRoot input, #modalRoot button, #sheetRoot textarea, #sheetRoot button')).filter(e => e.offsetParent !== null).map(e => (e.id || '') + '|' + (e.innerText || e.placeholder || '').trim().slice(0,30)));
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}