async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const out = {};
  const viewAs = async (who) => { await p.evaluate((who) => { S.viewAs = who; S.tab = 'requests'; _moreOpen = false; save(); render(); const n = document.getElementById('ovlNotifs'); if (n) n.remove(); window.scrollTo(0,0); }, who); await rt.sleep(900); };
  const rec = rt.rec(p, 'S6');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '.bn[data-tab="requests"]', 900, rec, '1 · Requests, then Request leave');
    await rt.tap(p, '#reqLeave', 1000);
    rec.mark('2 · Dates, type, a reason');
    await p.evaluate(() => { const f = document.getElementById('lvFrom'), t = document.getElementById('lvTo'); f.value = '2026-11-16'; f.dispatchEvent(new Event('input', {bubbles:true})); f.dispatchEvent(new Event('change', {bubbles:true})); }); await rt.sleep(700);
    await p.evaluate(() => { const t = document.getElementById('lvTo'); t.value = '2026-11-20'; t.dispatchEvent(new Event('input', {bubbles:true})); t.dispatchEvent(new Event('change', {bubbles:true})); }); await rt.sleep(700);
    out.form = await p.evaluate(() => Array.from(document.querySelectorAll('#sheetRoot select, #sheetRoot input, #sheetRoot textarea, #modalRoot select, #modalRoot input, #modalRoot textarea')).filter(e => e.offsetParent !== null).map(e => ({id: e.id, tag: e.tagName, v: e.value, ph: e.placeholder})));
    await rt.type(p, '#lvReason', 'School holidays', 60); await rt.sleep(500);
    await rt.zoom(p, '#lvSubmit', 1.3, 700); await rt.zoom(p, null);
    await rt.tap(p, '#lvSubmit', 1600, rec, '3 · Send');
    out.afterSend = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 260));
    await rt.sleep(800);
    await viewAs('admin'); rec.mark("4 · Your admin sees the whole picture");
    const ap = await p.evaluate(() => Array.from(document.querySelectorAll('[data-approve]')).map(b => b.dataset.approve));
    out.approveIds = ap;
    await rt.scroll(p, 260, 900);
    await rt.zoom(p, '[data-approve]', 1.25, 1800).catch(()=>{}); await rt.zoom(p, null);
    await rt.tap(p, '[data-approve]', 1600, rec, '5 · Approved');
    await viewAs('demo-0'); rec.mark('6 · You know before lunch');
    out.mine = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 300));
    await rt.zoom(p, '[data-reqcancel], .req, .card', 1.2, 1500).catch(() => rt.sleep(1500)); await rt.zoom(p, null);
    await rt.sleep(800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}