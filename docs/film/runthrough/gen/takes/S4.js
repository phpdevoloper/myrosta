async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const out = {};
  const viewAs = async (who) => { await p.evaluate((who) => { S.viewAs = who; S.tab = 'requests'; _moreOpen = false; save(); render(); const n = document.getElementById('ovlNotifs'); if (n) n.remove(); window.scrollTo(0,0); }, who); await rt.sleep(900); };
  const rec = rt.rec(p, 'S4');
  try {
    await rt.sleep(1200);
    await rt.tap(p, '.bn[data-tab="selfroster"]', 900, rec, '1 · Tap the shift, then Swap it');
    await rt.tap(p, '[data-bday="2026-10-24"]', 900);
    await rt.tap(p, '[data-swapit]', 1100);
    await rt.zoom(p, '[data-swmode="peer"]', 1.3, 1200); await rt.zoom(p, null);
    await rt.tap(p, '[data-swmode="all"]', 900, rec, '2 · With a colleague, or Ask everyone');
    const noteVis = await p.evaluate(() => { const e = document.getElementById('swReason'); return !!(e && e.offsetParent !== null); });
    out.noteVis = noteVis; if (noteVis) await rt.type(p, '#swReason', 'School pickup', 55);
    out.howMany = await p.evaluate(() => (document.body.innerText.replace(/\s+/g,' ').match(/.{0,70}(goes to|colleagues? free|free that day).{0,70}/i) || [''])[0]);
    await rt.zoom(p, '#swAsk', 1.3, 900); await rt.zoom(p, null);
    await rt.tap(p, '#swAsk', 1500, rec, '3 · Ask everyone');
    out.afterAsk = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 200));
    // a colleague free on the Saturday with a shift to offer
    const who = await p.evaluate(() => { const c = active(), d = '2026-10-24'; const ids = S.staff.map(s => s.id).filter(id => id !== 'demo-0' && !c.assign[id + '|' + d] && !(S.leave||[]).some(l => l.staffId === id && l.from <= d && l.to >= d) && Object.keys(c.assign).some(k => k.startsWith(id + '|') && c.assign[k].kind === 'clinical' && k.split('|')[1] > '2026-10-07')); return ids; });
    out.candidates = who;
    let picked = null;
    for (const id of who.slice(0, 6)) { await viewAs(id); const sel = await p.evaluate(() => { const s = Array.from(document.querySelectorAll('select')).find(e => e.offsetParent !== null && /swofs/.test(e.id)); return s ? {id: s.id, opts: Array.from(s.options).map(o => o.value + '|' + o.text).slice(0,6)} : null; }); if (sel) { picked = {id, sel}; break; } }
    out.picked = picked;
    if (!picked) throw new Error('no colleague sees Swaps wanted');
    rec.mark("4 · On a colleague's phone: Swaps wanted, Offer a shift");
    await rt.zoom(p, '#' + picked.sel.id, 1.3, 1200); await rt.zoom(p, null);
    const v = picked.sel.opts.map(o => o.split('|')[0]).find(v => v); await p.selectOption('#' + picked.sel.id, v); await rt.sleep(800);
    await rt.tap(p, '[data-swoffer]', 1500);
    out.afterOffer = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 200));
    await viewAs('demo-0'); rec.mark('5 · Offers arrive under Requests: Accept');
    await rt.zoom(p, '[data-swaccept]', 1.3, 1200); await rt.zoom(p, null);
    await rt.tap(p, '[data-swaccept]', 900);
    await rt.tap(p, '#cfOk', 1400);
    out.afterAccept = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 200));
    await viewAs('admin'); rec.mark('6 · Your admin approves, with the cover in front of them');
    await rt.zoom(p, '[data-approveswap]', 1.25, 1400); await rt.zoom(p, null);
    await rt.tap(p, '[data-approveswap]', 1500);
    out.afterApprove = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 200));
    await viewAs('demo-0'); await p.evaluate(() => { S.tab = 'my'; save(); render(); }); await rt.sleep(500); rec.mark('7 · Swapped');
    await rt.scroll(p, 300, 900); await rt.sleep(1500);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}