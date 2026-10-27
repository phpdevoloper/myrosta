async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'daily'});
  const out = {};
  const rec = rt.rec(p, 'A5');
  try {
    await rt.sleep(1400); rec.mark('1 · The Day board: cover per half, who is where');
    await rt.zoom(p, '#dDate', 1.2, 1600); await rt.zoom(p, null);
    await rt.scroll(p, 320, 900); await rt.sleep(900); await rt.scroll(p, -320, 700);
    await rt.tap(p, '[data-dm="week"]', 1600, rec, '2 · Week: the shape of the week');
    await rt.tap(p, '[data-tab="messages"]', 1200, rec, '3 · Messages: everyone, or one person');
    await rt.type(p, '#msgText', 'Thanks all, the November roster is live. Check your calendars.', 28);
    await rt.zoom(p, '#msgSend', 1.3, 600); await rt.zoom(p, null);
    await rt.tap(p, '#msgSend', 1500);
    await rt.tap(p, '[data-tab="audit"]', 1300, rec, '4 · The audit log: every change, by person or by kind');
    await rt.tap(p, '[data-av="person"]', 1300);
    await rt.tap(p, '[data-av="timeline"]', 900);
    await rt.zoom(p, '#auditCsv', 1.3, 1500); await rt.zoom(p, null);
    await rt.sleep(900);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}