async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'setup'});
  const out = {};
  const rec = rt.rec(p, 'A7');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '#acctBtn', 1400, rec, '1 · Each staff group is its own roster: switch from your initials');
    out.acct = await p.evaluate(() => Array.from(document.querySelectorAll('.sheetrow, #sheetSwitch, #sheetAddGroup')).filter(e => e.offsetParent !== null).map(e => (e.id||'') + '|' + e.innerText.trim().slice(0,30)));
    await rt.sleep(800); await p.keyboard.press('Escape'); await rt.sleep(500);
    await rt.tap(p, '[data-st="group"]', 1000, rec, '2 · Publish to the department board');
    await p.evaluate(() => document.getElementById('boardPublish').scrollIntoView({block:'center', behavior:'smooth'})); await rt.sleep(900);
    await rt.zoom(p, '#boardPublish', 1.45, 2200); await rt.zoom(p, null);
    await rt.tap(p, '[data-tab="daily"]', 1200, rec, '3 · Day board, then Whole department');
    await rt.tap(p, '[data-dscope="dept"]', 1800);
    await rt.scroll(p, 260, 900); await rt.sleep(1200); await rt.scroll(p, -260, 700);
    rec.mark('4 · Print makes the handover sheet'); await rt.zoom(p, '#bPrint, button:has-text("Print")', 1.3, 1800).catch(() => rt.sleep(1800)); await rt.zoom(p, null);
    await rt.sleep(800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}