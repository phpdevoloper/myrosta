async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { const k = 'myrosta_demo_v7'; let s = localStorage.getItem(k); s = s.split('Amara Okafor').join('Emma Walsh').split('Alex Chen').join('Alex Campbell'); localStorage.setItem(k, s); load(); S.viewAs = 'demo-3'; S.tab = 'my'; save(); render(); }});
  const out = {};
  const rec = rt.rec(p, 'R2b');
  try {
    await rt.sleep(1000);
    await rt.tap(p, 'details[data-sec="cycle"] summary', 1200, rec, 'whole cycle');
    await rt.tap(p, '#vMonth', 1400, rec, 'month');
    await rt.scroll(p, 260, 900);
    await rt.sleep(600);
    await rt.tap(p, 'details[data-sec="cal"] summary', 1100, rec, 'calendar');
    await rt.zoom(p, '#icsBtn', 1.3, 900);
    await rt.tap(p, '#icsBtn', 1600, rec, 'add to calendar');
    await rt.zoom(p, null);
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
