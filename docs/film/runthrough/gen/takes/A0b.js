async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'roster'});
  const out = {};
  const rec = rt.rec(p, 'A0b');
  try {
    await rt.sleep(2000); rec.mark('The roster, as you will live it');
    await rt.scroll(p, 260, 1600); await rt.sleep(1800); await rt.scroll(p, -260, 1200); await rt.sleep(1800);
    await rt.tap(p, '[data-tab="daily"]', 1800);
    await rt.sleep(2200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}