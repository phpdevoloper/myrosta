async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'setup'});
  const out = {};
  const rec = rt.rec(p, 'AM5');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '[data-st="group"]', 1000, rec, '1 · This staff group, then Import data');
    await p.evaluate(() => document.getElementById('card-import').scrollIntoView({block: 'start'})); await rt.sleep(900);
    rec.mark('2 · Tick Treat any filled cell as unavailable, then choose the Leave planner file');
    await rt.zoom(p, '#impLeaveAny', 1.4, 1000); await rt.zoom(p, null);
    await rt.tap(p, '#impLeaveAny', 900);
    out.ticked = await p.evaluate(() => document.getElementById('impLeaveAny').checked);
    await rt.zoom(p, '#impLeave', 1.3, 900); await rt.zoom(p, null);
    let msg = null; p.on('dialog', async d => { msg = d.message(); await d.accept(); });
    await p.setInputFiles('#impLeave', '/Users/ranjithkandavelu/Desktop/Claude/Myrosta/.playwright-mcp/rt/year-grid-2026.xlsx');
    const t0 = Date.now(); while (!msg && Date.now() - t0 < 25000) await rt.sleep(200);
    out.msg = msg;
    if (msg) {
      const sh = (msg.match(/sheet '([^']+)'/) || [])[1], st = (msg.match(/Staff: (\d+)/) || [])[1], bl = (msg.match(/Leave blocks: (\d+)/) || [])[1], any = /Any filled cell/.test(msg);
      rec.mark(`3 · The confirm: sheet '${sh}' · ${st} staff · ${bl} blocks${any ? ' · any filled cell counts as unavailable' : ''}`);
    }
    await rt.sleep(1800);
    out.tab = await p.evaluate(() => S.tab);
    out.leave = await p.evaluate(() => { const c = {}; (S.leave || []).filter(l => l.requestId === 'import').forEach(l => { c[l.code] = (c[l.code] || 0) + 1; }); return c; });
    rec.mark('4 · Every mark is a whole day unavailable; a real leave code stays itself');
    const ua = await p.evaluate(() => { const e = Array.from(document.querySelectorAll('td, div, span, button')).find(x => x.offsetParent !== null && x.innerText && x.innerText.trim() === 'UA' && x.getBoundingClientRect().width < 90); if (e) { e.id = e.id || '__ua'; return '#' + e.id; } return null; });
    out.ua = ua; if (ua) { await rt.zoom(p, ua, 1.5, 2000); await rt.zoom(p, null); }
    const al = await p.evaluate(() => { const e = Array.from(document.querySelectorAll('td, div, span, button')).find(x => x.offsetParent !== null && x.innerText && x.innerText.trim() === 'AL' && x.getBoundingClientRect().width < 90); if (e) { e.id = e.id || '__al'; return '#' + e.id; } return null; });
    out.al = al; if (al) { await rt.zoom(p, al, 1.5, 1600); await rt.zoom(p, null); }
    rec.mark('5 · Importing again never duplicates; unavailable is not leave'); await rt.sleep(2200);
    out.planner = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
