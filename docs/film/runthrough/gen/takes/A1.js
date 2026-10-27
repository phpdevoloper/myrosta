async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'setup'});
  const out = {};
  const card = async (id, label, hold=1800, scale=1.25) => { const h = await p.$('#' + id); if (!h) { out['missing_' + id] = true; return; } await h.evaluate(e => e.scrollIntoView({block:'start', behavior:'smooth'})); await rt.sleep(900); if (label) rec.mark(label); await rt.zoom(p, '#' + id + ' h2', scale, hold); await rt.zoom(p, null); };
  const rec = rt.rec(p, 'A1');
  try {
    await rt.sleep(1200); rec.mark('1 · Settings: This cycle');
    await rt.tap(p, '[data-st="cycle"]', 900);
    await card('card-cycle', '2 · Cycle dates first', 1600);
    await card('card-zones', '3 · Zones: one slot per half-day', 1500);
    await card('card-cover', '4 · Cover: minimum and maximum per half', 1500);
    await card('card-times', '5 · Shift types: a type filling both halves counts two', 2200, 1.2);
    await card('card-notice', '6 · Notice to come off a shift', 1200);
    await rt.tap(p, '#noticeDays', 300); await p.evaluate(() => { const e = document.getElementById('noticeDays'); e.value = '7'; e.dispatchEvent(new Event('input', {bubbles:true})); }); await rt.sleep(500); await rt.tap(p, '#saveNotice', 1200);
    await card('card-quota', '7 · Quota and fairness: each person’s share', 1800, 1.2);
    await card('card-mode', '8 · Rounds, or rolling', 2000, 1.2);
    rec.mark('9 · This staff group'); await p.evaluate(() => window.scrollTo({top: 0, behavior: 'smooth'})); await rt.sleep(700);
    await rt.tap(p, '[data-st="group"]', 1000);
    await card('brandCard', '10 · The group: name, logo, features', 2200, 1.15);
    await card('marketCard', '11 · The open-shift marketplace', 2000, 1.2);
    await rt.sleep(800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}