async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true, prep: () => { const k = 'myrosta_demo_v7'; let s = localStorage.getItem(k); s = s.split('Amara Okafor').join('Emma Walsh').split('Alex Chen').join('Alex Campbell'); localStorage.setItem(k, s); load(); S.viewAs = 'demo-3'; S.tab = 'requests'; save(); render(); }});
  const out = {};
  const as = async (who, tab) => { await p.evaluate(([w, t]) => { S.viewAs = w; S.tab = t; _moreOpen = false; save(); render(); window.scrollTo(0, 0); const n = document.getElementById('ovlNotifs'); if (n) n.remove(); }, [who, tab]); await rt.sleep(900); };
  const setVal = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); }, [id, v]); await rt.sleep(500); };
  const d = new Date(); d.setDate(d.getDate() + 14); while (d.getDay() !== 1) d.setDate(d.getDate() + 1);   // the Monday a fortnight ahead
  const iso = x => x.toISOString().slice(0, 10); const from = iso(d); const to = new Date(d); to.setDate(to.getDate() + 4); out.dates = [from, iso(to)];
  const rec = rt.rec(p, 'R8');
  try {
    await rt.sleep(900);
    await rt.tap(p, '#reqLeave', 1100, rec, 'request leave');
    await rt.tap(p, '#lvFrom', 300); await setVal('lvFrom', from);
    await rt.tap(p, '#lvTo', 300); await setVal('lvTo', iso(to));
    await rt.type(p, '#lvReason', 'School holidays', 55);
    await rt.sleep(500);
    await rt.tap(p, '#lvSubmit', 1600, rec, 'sent');
    await as('admin', 'requests');
    rec.mark('admin: requests');
    await rt.zoom(p, '[data-approve]', 1.25, 900);
    await rt.tap(p, '[data-approve]', 1200, rec, 'admin: approve');
    await rt.zoom(p, null);
    await p.evaluate(() => { try { closeModal(); } catch (e) {} const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });   // the demo offers the notification email as an editable draft; the film cuts to Emma instead
    await rt.sleep(400);
    await as('demo-3', 'requests');
    rec.mark('emma: approved');
    await rt.sleep(2000);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}
