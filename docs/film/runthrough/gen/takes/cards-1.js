async (page) => {
  const rt = page.context().browser().__rt;
  const cards = {"S0":["","Myrosta for staff","Your roster, first hand"],"S1":["Day one, 7:40 am","Sign in, and put it on your Home Screen",""],"S2a":["Monday, 8:05 am","The round opens: book your share",""],"S2b":["Any day","A rolling roster: book what's open, claim what's posted",""],"S3":["Monday evening","Your shifts, your calendar, your reminder",""],"S4":["Thursday, 1:40 pm","Swap a shift",""],"S5":["Nine days out","When you can't work a shift",""],"S6":["The school holidays","Leave",""],"S7":["Every day","Staying in the loop",""],"M1":["9:52 am, at the door","Clock in and out",""],"M2":["Tuesday, called in","Call-ins",""],"M3":["A later start","Your own hours",""],"M4":["Wednesday handover","Who's on across the department",""],"A0":["","Myrosta for admins","A cycle, first hand"],"A1":["Three weeks before the cycle","The cycle and its settings",""],"A2":["Two weeks before","People and access",""],"A3a":["Monday, 8:05 am","Open the round, watch it fill, publish",""],"A3b":["A week before launch","Place, fill the gaps, go live",""],"A4":["Thursday, 2:05 pm","Requests",""],"A5":["Friday, 8:50 am","Day to day",""],"A6":["End of the fortnight","Fairness, exports and pay",""],"A7":["The whole hospital","Staff groups and the department board",""],"A8":["When it goes wrong","Safety nets",""],"AM1":["Settings, then Clock","The clock",""],"AM2":["On-call windows","On-call and call-ins",""],"AM3":["Nurses","Tags and rules",""],"AM4":["Any shift","Own hours",""],"AM5":["The year grid","Unavailability from the year grid",""],"D0":["","Myrosta for directors","What you'll see of the roster"],"ENDS":["","Questions: your admin · The staff guide is under Help","myrosta.com.au"],"ENDA":["","The admin guide is under Help · Send feedback reaches the developer","myrosta.com.au"]};
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const html = (w, h, when, title, sub, isEnd) => { const v = h > w; const ts = v ? 84 : 92, ws = v ? 40 : 44, ss = v ? 36 : 38, pad = v ? 90 : 200; const mark = `<div class="mark"><div class="dot"></div><div class="word">Myrosta</div></div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap"><style>
      html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#0B2A33;color:#F4FBFA;font-family:Inter,"Helvetica Neue",Arial,sans-serif}
      .card{width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${v?26:22}px;background:radial-gradient(${v?900:1100}px ${v?1100:900}px at 50% 45%,#0F3B45 0%,#0B2A33 60%,#081E25 100%);text-align:center;padding:0 ${pad}px;box-sizing:border-box}
      .mark{display:flex;align-items:center;gap:14px;margin-bottom:${isEnd?10:34}px}.dot{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#2FC4A8,#17A08A)}.word{font-size:50px;font-weight:800;letter-spacing:-1.5px}
      .when{font-size:${ws}px;font-weight:700;color:#9FE3D4;letter-spacing:-0.3px}
      .title{font-size:${ts}px;font-weight:800;line-height:1.06;letter-spacing:-2.5px;text-wrap:balance;max-width:${v?900:1500}px}
      .sub{font-size:${ss}px;font-weight:500;color:#CFEDE7;line-height:1.3;max-width:${v?900:1400}px}
      </style></head><body><div class="card">${mark}${when?`<div class="when">${esc(when)}</div>`:''}<div class="title">${esc(title)}</div>${sub?`<div class="sub">${esc(sub)}</div>`:''}</div></body></html>`; };
  const dir = '/Users/ranjithkandavelu/Desktop/Claude/Myrosta/.playwright-mcp/rt/cards/';
  const made = [];
  for (const [id, [when, title, sub]] of Object.entries(cards)) {
    const isEnd = id.startsWith('END');
    await rt.card(1920, 1080, html(1920, 1080, when, title, sub, isEnd), dir + id + '-16x9.png'); made.push(id + '-16x9');
    if (/^(S|M|ENDS)/.test(id)) { await rt.card(1080, 1920, html(1080, 1920, when, title, sub, isEnd), dir + id + '-9x16.png'); made.push(id + '-9x16'); }
  }
  return {made: made.length, sample: made.slice(0, 6)};
}