// Run-through recorder helpers, installed on the Playwright browser object so every take can use them (the MCP keeps no globals).
async (page) => {
  const b = page.context().browser(); const rt = b.__rt = b.__rt || {};
  rt.FR = '/Users/ranjithkandavelu/Desktop/Claude/Myrosta/.playwright-mcp/rt/rec';
  rt.URL = 'http://localhost:8903/deploy/demo.html'; rt.KEY = 'myrosta_demo_v7';
  rt.sleep = ms => new Promise(r => setTimeout(r, ms));
  rt.phone = async () => { const c = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, colorScheme:'light'}); const p = await c.newPage(); p.__kind='phone'; return p; };
  rt.laptop = async () => { const c = await b.newContext({viewport:{width:1440,height:810}, deviceScaleFactor:2, colorScheme:'light'}); const p = await c.newPage(); p.__kind='laptop'; return p; };
  rt.pages = () => b.contexts().flatMap(c => c.pages()).filter(p => p.__kind);
  rt.overlay = async (p) => { await p.evaluate(() => { if (document.getElementById('__rtcss')) return;
      const st = document.createElement('style'); st.id='__rtcss'; st.textContent = `
        .__rip{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(19,143,124,.35);border:2px solid rgba(19,143,124,.9);pointer-events:none;z-index:99999;animation:__rip .55s ease-out forwards}
        @keyframes __rip{0%{transform:scale(.4);opacity:1}100%{transform:scale(1.6);opacity:0}}
        #__cur{position:fixed;left:0;top:0;width:22px;height:30px;pointer-events:none;z-index:99999;transform:translate(-3px,-2px);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));transition:left .5s cubic-bezier(.3,.7,.3,1),top .5s cubic-bezier(.3,.7,.3,1)}
        body{transition:transform .65s cubic-bezier(.4,0,.2,1)}`;
      document.head.appendChild(st);
      if (!document.getElementById('__cur') && window.innerWidth > 900) { const c = document.createElement('div'); c.id='__cur'; c.style.left='640px'; c.style.top='420px';
        c.innerHTML = '<svg viewBox="0 0 22 30" width="22" height="30"><path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'; document.body.appendChild(c); } }); };
  rt.center = async (p, sel) => { const h = typeof sel === 'string' ? await p.$(sel) : sel; if (!h) throw new Error('no element: ' + sel);
      for (let k = 0; k < 3; k++) {   // scroll until the element's centre is really the thing under the finger: clear of the sticky header, the bottom bar, the basket and the demo banner
        const r = await h.evaluate(e => { const r = e.getBoundingClientRect(); const x = r.x + r.width/2, y = r.y + r.height/2; const top = document.elementFromPoint(x, y); return {x, y, w: r.width, h: r.height, ok: !!(top && (top === e || e.contains(top))), H: window.innerHeight}; });
        if (r.ok) return r;
        await h.evaluate((e, k) => e.scrollIntoView({block: k === 0 ? 'center' : (k === 1 ? 'start' : 'end'), behavior: 'instant'}), k).catch(()=>{}); await rt.sleep(260);
        if (k === 1) { await p.evaluate(() => window.scrollBy(0, -120)); await rt.sleep(200); } }
      const r = await h.evaluate(e => { const r = e.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height, ok: false}; }); return r; };
  rt.ripple = async (p, x, y) => p.evaluate(([x,y]) => { const d = document.createElement('div'); d.className='__rip'; d.style.left=x+'px'; d.style.top=y+'px'; document.body.appendChild(d); setTimeout(()=>d.remove(), 700); }, [x,y]);
  rt.tap = async (p, sel, holdMs=600, rec=null, label=null) => { await rt.overlay(p); const c = await rt.center(p, sel); if (rec && label) rec.mark(label);
      if (p.__kind === 'laptop') { await p.evaluate(([x,y]) => { const cur = document.getElementById('__cur'); if (cur) { cur.style.left = x+'px'; cur.style.top = y+'px'; } }, [c.x, c.y]); await rt.sleep(560); }
      await rt.ripple(p, c.x, c.y); await rt.sleep(90); await p.mouse.click(c.x, c.y); await rt.sleep(holdMs); return c; };
  rt.type = async (p, sel, text, perChar=45) => { const c = await rt.center(p, sel); await p.mouse.click(c.x, c.y); await rt.sleep(150); await p.keyboard.type(text, {delay: perChar}); await rt.sleep(300); };
  rt.scroll = async (p, dy, ms=700) => { await p.evaluate(([dy,ms]) => { const y = window.scrollY + dy; window.scrollTo({top: y, behavior: 'smooth'}); }, [dy,ms]); await rt.sleep(ms); };
  rt.scrollEl = async (p, sel, dy, ms=700) => { await p.evaluate(([sel,dy]) => { const e = document.querySelector(sel); if (e) e.scrollBy({top: dy, behavior:'smooth'}); }, [sel,dy]); await rt.sleep(ms); };
  rt.Z = null;   // zoom state, read by the frame loop: {s, cx, cy} in viewport CSS px. A zoomed frame is a clip screenshot around (cx, cy), so the app's fixed-position sheets and bars stay on screen (a body transform displaced them off the frame, which greyed out the booking take)
  rt.zoomTo = async (s1, cx, cy, ms=700) => { const z0 = rt.Z || {s: 1, cx, cy}; const n = Math.max(1, Math.round(ms/80));
      for (let k = 1; k <= n; k++) { const u = k/n, e = 1 - Math.pow(1-u, 3); rt.Z = {s: z0.s + (s1-z0.s)*e, cx: z0.cx + (cx-z0.cx)*e, cy: z0.cy + (cy-z0.cy)*e}; await rt.sleep(ms/n); }
      rt.Z = s1 > 1.001 ? {s: s1, cx, cy} : null; };
  rt.zoom = async (p, sel, scale=1.7, holdMs=0) => { await rt.overlay(p); if (!sel) { const z = rt.Z; if (z) await rt.zoomTo(1, z.cx, z.cy); else await rt.sleep(700); return; }
      const c = await rt.center(p, sel); const vp = p.viewportSize(); const w = vp.width / scale, h = vp.height / scale;   // a target wider (taller) than the zoomed frame is anchored at its left (top) edge instead of centred, so its leading text stays in frame
      const cx = c.w > w - 12 ? c.x - c.w/2 - 6 + w/2 : c.x, cy = c.h > h - 12 ? c.y - c.h/2 - 6 + h/2 : c.y; await rt.zoomTo(scale, cx, cy); await rt.sleep(holdMs); };
  rt.open = async (p, o={}) => { await p.goto(rt.URL, {waitUntil:'load'}); await rt.sleep(500);
      if (o.reset) { await p.evaluate(k => localStorage.removeItem(k), rt.KEY); await p.reload({waitUntil:'load'}); await rt.sleep(900); }
      if (o.state) { await p.evaluate(([k,s]) => { localStorage.setItem(k, s); load(); render(); }, [rt.KEY, o.state]); await rt.sleep(300); }
      if (o.prep) { await p.evaluate(o.prep); await rt.sleep(300); }
      if (o.viewAs || o.tab) { await p.evaluate(({v,t}) => { if (v) S.viewAs = v; if (t) S.tab = t; _moreOpen = false; save(); render(); }, {v: o.viewAs||null, t: o.tab||null}); await rt.sleep(400); }
      await p.evaluate(() => { const n = document.getElementById('ovlNotifs'); if (n) n.remove(); window.scrollTo(0,0); }); await rt.overlay(p); await rt.sleep(300); };
  rt.state = async (p) => p.evaluate(k => localStorage.getItem(k), rt.KEY);
  rt.rec = (p, name, everyMs=80) => { const dir = rt.FR + '/' + name; let i = 0, on = true; const t0 = Date.now(); const log = [];
      const loop = (async () => { while (on) { const idx = i++; const path = dir + '/f' + String(idx).padStart(5,'0') + '.jpg';
          const shot = {path, type:'jpeg', quality: 95, animations:'allow', caret:'hide'}; const z = rt.Z; if (z && z.s > 1.001) { const vp = p.viewportSize(); const w = vp.width / z.s, h = vp.height / z.s; shot.clip = {x: Math.min(Math.max(z.cx - w/2, 0), vp.width - w), y: Math.min(Math.max(z.cy - h/2, 0), vp.height - h), width: w, height: h}; shot.scale = 'device'; }
          await p.screenshot(shot).catch(e => { log.push({t:(Date.now()-t0)/1000, err: String(e).slice(0,80)}); });
          const el = Date.now() - t0, want = (idx+1) * everyMs; if (el < want) await rt.sleep(want - el); } })();
      return { mark: (label) => log.push({t: +((Date.now()-t0)/1000).toFixed(2), label}), stop: async () => { on = false; await loop; const secs = (Date.now()-t0)/1000; const result = {take:name, frames:i, secs:+secs.toFixed(2), fps:+(i/secs).toFixed(3), log}; try { const fs = require('fs'); fs.writeFileSync(dir + '/log.json', JSON.stringify(result)); result.saved = true; } catch (e) { result.saved = String(e).slice(0, 60); } return result; } }; };
  rt.card = async (w, h, html, path) => { const c = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:1}); const p = await c.newPage(); await p.setContent(html, {waitUntil:'load'}); await p.evaluate(() => document.fonts.ready); await rt.sleep(600); await p.screenshot({path}); await c.close(); return path; };
  rt.version = 5;
  return {installed: true, version: rt.version, helpers: Object.keys(rt).length};
}
