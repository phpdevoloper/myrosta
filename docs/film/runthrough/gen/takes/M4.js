async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const out = {};
  const rec = rt.rec(p, 'M4');
  try {
    await rt.sleep(1000);
    await rt.tap(p, '#bnMore', 700, rec, '1 · More, then Day board');
    await rt.tap(p, '.sheetrow[data-tab="daily"]', 1100);
    await rt.zoom(p, '[data-dscope="dept"]', 1.3, 900); await rt.zoom(p, null);
    await rt.tap(p, '[data-dscope="dept"]', 1400, rec, '2 · Whole department');
    out.cards = await p.evaluate(() => Array.from(document.querySelectorAll('details.deptcol summary')).map(s => s.innerText.replace(/\s+/g,' ').slice(0,60)));
    await rt.tap(p, 'details.deptcol:nth-of-type(2) summary', 1200, rec, '3 · One card per group: tap to open');
    await rt.scroll(p, 300, 1000); await rt.sleep(1200); await rt.scroll(p, -300, 800);
    await rt.zoom(p, '#bPrint, button:has-text("Print")', 1.3, 900).catch(()=>{}); await rt.zoom(p, null);
    rec.mark('4 · Print makes the handover sheet'); await rt.sleep(1600);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}