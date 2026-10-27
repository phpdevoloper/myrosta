async (page) => {
  const rt = page.context().browser().__rt;
  const p = await rt.laptop();
  await rt.open(p, {reset: true, viewAs: 'admin', tab: 'staff'});
  const out = {};
  const rec = rt.rec(p, 'A2');
  try {
    await rt.sleep(1200); rec.mark('1 · Staff: everyone, with a mobile or an email');
    await rt.tap(p, '[data-stoggle="demo-2"]', 1300, rec, '2 · Tap a name to open their card');
    out.inputs = await p.evaluate(() => Array.from(document.querySelectorAll('input, select')).filter(e => e.offsetParent !== null && e.id !== 'staffSearch' && e.id !== 'cycleSel').map((e, i) => { e.id = e.id || ('__sf' + i); const lab = e.closest('label') ? e.closest('label').innerText.replace(/\s+/g,' ').slice(0,30) : (e.previousElementSibling ? (e.previousElementSibling.innerText||'').slice(0,30) : ''); return {id: e.id, ph: e.placeholder, v: String(e.value).slice(0,20), type: e.type, lab}; }).slice(0, 20));
    const mobile = out.inputs.find(i => /mobile/i.test(i.lab + ' ' + i.ph)) || out.inputs.find(i => i.ph === '—' && i.type === 'text');
    const email = out.inputs.find(i => /email/i.test(i.lab + ' ' + i.ph + ' ' + i.type));
    out.mobileSel = mobile && '#' + mobile.id; out.emailSel = email && '#' + email.id;
    if (mobile) { await rt.zoom(p, '#' + mobile.id, 1.45, 900); await rt.zoom(p, null); rec.mark('3 · A mobile or an email: that is how they sign in'); await rt.type(p, '#' + mobile.id, '0400 000 222', 60); await p.keyboard.press('Tab'); await rt.sleep(900); }
    const quota = out.inputs.find(i => i.type === 'number' && i.v === '21');
    if (quota) { await rt.zoom(p, '#' + quota.id, 1.4, 1400, rec); await rt.zoom(p, null); rec.mark('4 · Role and share'); await rt.sleep(600); }
    await rt.tap(p, '[data-stoggle="demo-2"]', 700);
    await rt.tap(p, '#addStaff', 1400, rec, '5 · Add staff, one by one or from the spreadsheet');
    out.newRow = await p.evaluate(() => Array.from(document.querySelectorAll('input')).filter(e => e.offsetParent !== null && (e.value === 'New' || e.value === 'New person' || /^New/.test(e.value))).map((e, i) => { e.id = e.id || ('__new' + i); return {id: e.id, v: e.value}; }));
    if (out.newRow.length) { const nm = '#' + out.newRow[0].id; await rt.zoom(p, nm, 1.4, 600); await rt.zoom(p, null); await p.evaluate((id) => { const e = document.querySelector(id); e.focus(); e.select(); }, nm); await p.keyboard.type('Noor Haddad', {delay: 60}); await p.keyboard.press('Tab'); await rt.sleep(900); }
    out.after = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(120, 330));
    await rt.sleep(1200);
  } catch (e) { out.error = String(e).slice(0, 300); }
  Object.assign(out, await rec.stop());
  await p.context().close();
  return out;
}