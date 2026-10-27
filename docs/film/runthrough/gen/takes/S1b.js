async (page) => {
  const rt = page.context().browser().__rt;
  // S1b: the landing on My shifts after sign-in (Jordan Lee, fresh seed), a slow scroll through the week
  const p = await rt.phone();
  await rt.open(p, {reset: true});
  const rec = rt.rec(p, 'S1b');
  await rt.sleep(2200); rec.mark('You land on My shifts');
  await rt.scroll(p, 260, 1200); await rt.sleep(1600); await rt.scroll(p, -260, 1000); await rt.sleep(1400);
  const out = {S1b: await rec.stop()};
  await p.context().close();
  // the Home Screen steps card, both sizes
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const html = (w, h) => { const v = h > w; return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap"><style>
    html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#0B2A33;color:#F4FBFA;font-family:Inter,"Helvetica Neue",Arial,sans-serif}
    .card{width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${v?28:24}px;background:radial-gradient(1100px 900px at 50% 45%,#0F3B45 0%,#0B2A33 60%,#081E25 100%);text-align:center;padding:0 ${v?80:200}px;box-sizing:border-box}
    .when{font-size:${v?38:42}px;font-weight:700;color:#9FE3D4}
    .title{font-size:${v?72:84}px;font-weight:800;line-height:1.06;letter-spacing:-2px;text-wrap:balance;max-width:${v?900:1500}px}
    .steps{display:flex;flex-direction:${v?'column':'row'};gap:${v?22:34}px;margin-top:${v?26:30}px}
    .step{background:rgba(255,255,255,.06);border:1px solid rgba(159,227,212,.35);border-radius:22px;padding:${v?'26px 36px':'30px 40px'};min-width:${v?'0':'380px'};text-align:left}
    .n{font-size:${v?30:30}px;font-weight:800;color:#9FE3D4;margin-bottom:8px}.s{font-size:${v?38:38}px;font-weight:700;line-height:1.2}.m{font-size:${v?28:26}px;color:#CFEDE7;margin-top:6px}
    </style></head><body><div class="card"><div class="when">Once, on day one</div><div class="title">Put Myrosta on your Home Screen</div>
    <div class="steps"><div class="step"><div class="n">1</div><div class="s">Open myrosta.com.au in Safari</div><div class="m">Chrome on Android</div></div><div class="step"><div class="n">2</div><div class="s">Tap Share</div><div class="m">the menu, on Android</div></div><div class="step"><div class="n">3</div><div class="s">Add to Home Screen</div><div class="m">it opens like an app</div></div></div></div></body></html>`; };
  const dir = '/Users/ranjithkandavelu/Desktop/Claude/Myrosta/.playwright-mcp/rt/cards/';
  await rt.card(1920, 1080, html(1920, 1080), dir + 'HOME-16x9.png'); await rt.card(1080, 1920, html(1080, 1920), dir + 'HOME-9x16.png');
  out.cards = ['HOME-16x9', 'HOME-9x16'];
  return out;
}