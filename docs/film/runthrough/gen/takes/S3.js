async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const out = {};
  const rec = rt.rec(p, 'S3');
  try {
    await rt.sleep(1200); rec.mark('1 · My shifts: your week at a glance');
    await rt.scroll(p, 320, 1100); await rt.sleep(1200);
    await rt.tap(p, 'details[data-sec="cycle"] summary', 900, rec, '2 · Whole cycle');
    await rt.tap(p, '#vMonth', 900, rec, '3 · Month');
    await rt.scroll(p, 420, 1100); await rt.sleep(1000); await rt.scroll(p, -300, 900); await rt.sleep(600);
    await rt.tap(p, '#calToggle', 900, rec, '4 · Calendar');
    out.calOpen = await p.evaluate(() => { const d = document.querySelector('details[data-sec="cal"]'); return d ? d.open : null; });
    if (out.calOpen === false) await rt.tap(p, 'details[data-sec="cal"] summary', 700);
    await rt.zoom(p, '#icsBtn', 1.5, 1200); await rt.zoom(p, null);
    await rt.tap(p, '#icsBtn', 1600, rec, '5 · Add to calendar');
    out.afterIcs = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').match(/.{0,80}(calendar|\.ics).{0,80}/i)?.[0] || null);
    await p.evaluate(() => window.scrollTo({top: 0, behavior: 'smooth'})); await rt.sleep(800);
    await rt.tap(p, '#shareWeek', 1800, rec, '6 · Share your week');
    out.afterShare = await p.evaluate(() => { const t = document.querySelector('.toast, #toast'); return t ? t.innerText : document.body.innerText.replace(/\s+/g,' ').slice(0,120); });
    await rt.sleep(800);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}