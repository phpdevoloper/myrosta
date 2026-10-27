async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { const k = 'myrosta_demo_v7'; let s = localStorage.getItem(k); s = s.split('Amara Okafor').join('Emma Walsh').split('Alex Chen').join('Alex Campbell'); localStorage.setItem(k, s); load(); const T0 = new Date(); T0.setDate(T0.getDate() + 1); const T1 = new Date(); T1.setDate(T1.getDate() + 21); const A = CTX().assign; for (const k of Object.keys(A)) { const d = k.slice(7); if (k.startsWith('demo-4|') && d >= iso(T0) && d <= iso(T1)) delete A[k]; } S.viewAs = 'demo-3'; S.tab = 'my'; save(); render(); }});   // Alex is freed for the next three weeks so he can offer a shift back (the seed books everyone to their share)
  const out = {};
  const as = async (who, tab) => { await p.evaluate(([w, t]) => { S.viewAs = w; S.tab = t; _moreOpen = false; save(); render(); window.scrollTo(0, 0); const n = document.getElementById('ovlNotifs'); if (n) n.remove(); }, [who, tab]); await rt.sleep(900); };
  const rec = rt.rec(p, 'R4');
  try {
    await rt.sleep(900);
    await rt.tap(p, '[data-go="requests"]', 1100, rec, 'request leave or swap');
    await rt.tap(p, '#reqSwap', 1100, rec, 'request a swap');
    await rt.tap(p, '[data-swmode="all"]', 900, rec, 'ask everyone');
    out.mine = await p.evaluate(() => { const s = document.getElementById('swMine'); if (!s) return null; const lim = new Date(); lim.setDate(lim.getDate() + 3); const L = iso(lim);   // a shift of Emma's a few days out that Alex (demo-4) is free to take, so his offer screen has something to offer
      const o = [...s.options].find(x => { if (!x.value || x.value.slice(0, 10) <= L) return false; const d = x.value.slice(0, 10); const sh = getShift('demo-3', d); if (sh.kind !== 'clinical') return false; const per = sh.period || 'AM'; return getShift('demo-4', d).kind === 'off' && S.zones.some(z => canBook('demo-4', d, per === 'full' ? 'AM' : per, z.id).ok); });
      if (o) { s.value = o.value; s.dispatchEvent(new Event('change', {bubbles: true})); } return o ? o.value + ' :: ' + o.text : null; });
    await rt.sleep(700);
    await rt.tap(p, '#swAsk', 1500, rec, 'asked the group');
    await as('demo-4', 'requests');
    rec.mark('alex: requests');
    out.offer = await p.evaluate(() => { const s = [...document.querySelectorAll('select')].find(x => /^swofs-/.test(x.id)); if (!s) return null; const o = [...s.options].find(x => x.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', {bubbles: true})); } return o ? o.text : 'no option'; });
    await rt.sleep(700);
    await rt.tap(p, '[data-swoffer]', 1500, rec, 'alex: send offer');
    await as('demo-3', 'requests');
    rec.mark('emma: requests');
    await rt.zoom(p, '[data-swaccept]', 1.25, 700);
    await rt.tap(p, '[data-swaccept]', 900, rec, 'emma: accept');
    await rt.zoom(p, null);
    const ok = await p.$('#cfOk'); if (ok) await rt.tap(p, '#cfOk', 1500, rec, 'confirmed');
    await rt.sleep(1400);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
