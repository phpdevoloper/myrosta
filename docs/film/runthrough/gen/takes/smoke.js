async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const rec = rt.rec(p, 'smoke');
  await rt.sleep(600);
  await rt.tap(p, '.bn[data-tab="selfroster"]', 900, rec, '1 · Tap Book shifts');
  await rt.zoom(p, '[data-bday]', 1.6, 500);
  await rt.zoom(p, null);
  const out = await rec.stop();
  const title = await p.title();
  await p.context().close();
  return {title, ...out};
}