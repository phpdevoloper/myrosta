# UI Phase 1 — Phone-first navigation and the staff home · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a phone, a consultant opens Myrosta and sees their next shift and what they can do about it within one screen; navigation lives in a bottom bar; every alert takes them to the thing it mentions. Desktop keeps its top strip, ordered by role and named by job.

**Architecture:** Presentation layer only. One navigation model (`NAV_ORDER` / `tabLabel()` / `navTabs()` / `NAV_PRIMARY`) drives both the desktop strip and a new phone bottom bar; a `go(tab,{cycle,anchor})` helper is the single way to move around, used by prose links (`data-go`) and by notifications (which gain an optional target). My shifts is re-ordered by urgency with collapsible sections; all existing element ids and their wiring are preserved. The rostering engine (`canBook`, `bookingGate`, cycles, sync) is not touched.

**Tech Stack:** single-file vanilla JS (`app.html`), CSS in the same file, JavaScriptCore test suite (`python3 tests/run.py` → stubs + app script + `tests/suite.js`), no build step. Deploy = commit `app.html` + identical `deploy/app.html` + `preview.html` (CLOUD line blanked); the user pushes with GitHub Desktop.

**Spec:** `MYROSTA-UI-STRATEGY.md` (Phase 1 section + IA/mobile findings) and the published plan artifact. Decisions already taken by the owner: bottom bar yes; tab renames yes (Book shifts / Day board / Leave / Fairness / Settings / Audit log); one teal brand; CST per-group option is Phase 5; booking sheet is Phase 5.

> **As built (8 Sep 2026, branch `ui-phase1` → `main`, 161/161):** the phone header is brand + bell on one row and the cycle chip on its own row beneath (Task 3's "chip shares the brand row" did not fit at 375 px); admins keep **My shifts** (under More on phones) because it holds the per-person export and fixed-pattern tools; notifications are marked read when the sheet **closes**, not when it opens, so unread rows are visible; the sheets and modals sit above the bottom bar (`z-index:70`); the landing tab applies only on a genuine sign-in and comes from this device's stored tab; section open/closed state lives in `_secOpen` so re-renders don't collapse them; the open-shift alerts carry the cycle; only the admin "Feedback" alert is deliberately untargeted.

## Global Constraints

- `python3 tests/run.py` must stay green (116 checks today + the new ones). Add tests to `tests/suite.js` inside the existing IIFE, using `T(name, cond)`; date fixtures via `FUT(n)`; never hardcode a future date.
- Engine untouched: no changes inside `canBook`, `bookingGate`, `unbookShift`, cycle status transitions, `mergeOnto`, `cloudSave`. UI state that must not sync (`_moreOpen`, `_notifsOpen`, `_showCal`) lives in module-level `let` variables or `window.*`, never in `S`.
- Element ids that `wire()` queries keep their ids: `rFrom rTo icsBtn subLive subCopy subReset vAgenda vMonth mySel` (My shifts), `bell bellBadge cycleSel viewAs logoutBtn switchOrgBtn tabs` (header), `[data-tab] [data-gocyc] [data-osclaim] [data-oswd] [data-preset]`.
- Phone = `@media(max-width:640px)`; the 44 px floor from Phase 0 applies to every new control. Bottom bar clears `env(safe-area-inset-bottom)`.
- Copy: sentence case; verbs name the action; the word for self-rostering is **booking** in tabs, banners and alerts ("Booking is open"), except the admin's tab which is **Round** (rounds) / **Booking** (rolling) and the settings card names that Phase 5 will rename.
- Sync every commit to `deploy/app.html` and `preview.html` (regenerate preview by swapping only the `const CLOUD=` line).

---

### Task 1: Navigation model (order, labels, primary set) + desktop strip uses it

**Files:**
- Modify: `app.html` — after `const TABS=…` (~line 1409): add `NAV_ORDER`, `NAV_LABELS`, `NAV_PRIMARY`, `tabLabel()`, `navTabs()`, `navPrimary()`, `navMore()`; in `render()` (~1483–1484) build `#tabs` from `navTabs()`.
- Test: `tests/suite.js` — new block before the final `full render passes` test.

**Interfaces:**
- Produces: `tabLabel(id) → string`, `navTabs() → [{id,label}]` (role-ordered, feature-filtered), `navPrimary() → [{id,label}]` (≤4), `navMore() → [{id,label}]` (the rest), `TAB_SCOPE[id] → "admin"|"all"`.

- [ ] **Step 1: Write the failing tests** (append inside the IIFE in `tests/suite.js`, before `S.viewAs="admin"; S.tab="setup"; render();`)

```js
  // ---- Phase 1: navigation model ----
  S.viewAs="s1"; var nt=navTabs().map(function(t){return t.id;});
  T("nav: staff order starts My shifts, Book shifts, Roster, Requests", nt.slice(0,4).join(",")==="my,selfroster,roster,requests");
  T("nav: staff never sees admin tabs", nt.indexOf("setup")<0 && nt.indexOf("staff")<0 && nt.indexOf("audit")<0);
  T("nav: staff labels by job", tabLabel("selfroster")==="Book shifts" && tabLabel("daily")==="Day board" && tabLabel("planner")==="Leave" && tabLabel("equity")==="Fairness");
  S.viewAs="admin"; var na=navTabs().map(function(t){return t.id;});
  T("nav: admin order starts Roster, Round, Day board, Requests", na.slice(0,4).join(",")==="roster,selfroster,daily,requests");
  T("nav: admin labels", tabLabel("setup")==="Settings" && tabLabel("audit")==="Audit log" && tabLabel("selfroster")==="Round");
  cset().rosterMode="rolling"; S.rosterMode="rolling";
  T("nav: admin booking tab says Booking on a rolling cycle", tabLabel("selfroster")==="Booking");
  cset().rosterMode="rounds"; S.rosterMode="rounds";
  T("nav: primary set is at most 4 and More holds the rest", navPrimary().length<=4 && navPrimary().length+navMore().length===navTabs().length);
  S.features={equity:false};
  T("nav: a switched-off feature drops out of the list", navTabs().every(function(t){return t.id!=="equity";}));
  S.features={};
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tests/run.py | grep -E "nav:|passed"` — expected: HARNESS ERROR / FAIL lines mentioning `navTabs is not defined`.

- [ ] **Step 3: Implement** (insert directly after the `const TABS=[…]` line)

```js
const TAB_SCOPE=Object.fromEntries(TABS.map(t=>[t[0],t[2]]));
const NAV_ORDER={ staff:["my","selfroster","roster","requests","daily","planner","equity","messages","help"],
                  admin:["roster","selfroster","daily","requests","staff","setup","planner","equity","messages","audit","help"] };
const NAV_PRIMARY={ staff:["my","selfroster","roster","requests"], admin:["roster","selfroster","requests","setup"] };   // bottom bar on phones; everything else under More
const NAV_LABELS={setup:"Settings",staff:"Staff",roster:"Roster",daily:"Day board",planner:"Leave",equity:"Fairness",requests:"Requests",my:"My shifts",messages:"Messages",help:"Help",audit:"Audit log"};
function tabLabel(id){ if(id==="selfroster") return isAdmin()?(isRolling()?"Booking":"Round"):"Book shifts"; return NAV_LABELS[id]||id; }
function navVisible(id){ if(TAB_SCOPE[id]==="admin"&&!isAdmin())return false; if(id==="equity"&&!featOn("equity"))return false; if(id==="planner"&&!featOn("planner"))return false; return true; }
function navTabs(){ return NAV_ORDER[isAdmin()?"admin":"staff"].filter(navVisible).map(id=>({id,label:tabLabel(id)})); }
function navPrimary(){ return NAV_PRIMARY[isAdmin()?"admin":"staff"].filter(navVisible).map(id=>({id,label:tabLabel(id)})); }
function navMore(){ const p=new Set(NAV_PRIMARY[isAdmin()?"admin":"staff"]); return navTabs().filter(t=>!p.has(t.id)); }
```

Then in `render()` replace the two lines that build `#tabs` from `TABS.filter(...)` with:

```js
  document.getElementById("tabs").innerHTML=navTabs()
    .map(({id,label})=>`<button class="tab ${S.tab===id?"active":""}" role="tab" aria-selected="${S.tab===id?"true":"false"}" data-tab="${id}">${label}</button>`).join("");
```

- [ ] **Step 4: Run tests** — `python3 tests/run.py | tail -1` → expected `124 passed, 0 failed`.
- [ ] **Step 5: Commit** — `git add app.html tests/suite.js && git commit -m "UI phase 1: navigation model — role-ordered tabs named by job (Book shifts, Day board, Leave, Fairness, Settings, Audit log)"`

---

### Task 2: `go()` helper, `data-go` links, landing tab on sign-in

**Files:**
- Modify: `app.html` — new `go()` next to `saveLocal()` (~862); `wire()` (~3429) adds `[data-go]`; sign-in line (~716) uses `landingTab()`; `openRoundBanner()` (~1527) and the Self-roster control card copy (~2120–2130) and `setupGuideHTML()` step 3 (~2797) use `data-go` links.
- Test: `tests/suite.js`.

**Interfaces:**
- Produces: `go(tab, {cycle?, anchor?})` — switches cycle (with hydration) and tab, closes any open sheet, saves locally, renders, scrolls to `#anchor`. `goStr(tab,cycle,anchor) → "tab|cycle|anchor"` and `parseGo(str) → {tab,cycle,anchor}`. `landingTab(viewAs) → "my"` for staff, current tab for admin.

- [ ] **Step 1: Failing tests**

```js
  // ---- Phase 1: go() helper + landing tab ----
  S.cycles.push({id:"c-next",cycle:{start:FUT(30),weeks:8},assign:{},status:"draft",archived:false,settings:{},roles:{}});
  S.viewAs="s1"; S.tab="equity"; go("requests");
  T("go: switches tab", S.tab==="requests");
  go("selfroster",{cycle:"c-next"});
  T("go: switches cycle and tab together", S.activeId==="c-next" && S.tab==="selfroster");
  go("my",{cycle:"c1"});
  T("go: back to the first cycle", S.activeId==="c1" && S.tab==="my");
  T("go: ignores an unknown cycle id", (go("roster",{cycle:"nope"}), S.activeId==="c1" && S.tab==="roster"));
  var g=parseGo(goStr("requests","c1","req-x"));
  T("go: string round-trips", g.tab==="requests" && g.cycle==="c1" && g.anchor==="req-x");
  T("go: string without extras", parseGo("my").tab==="my" && !parseGo("my").cycle);
  T("landing: staff land on My shifts, admin keeps their tab", landingTab("s1")==="my" && (S.tab="roster", landingTab("admin")==="roster"));
  S.cycles=S.cycles.filter(function(c){return c.id!=="c-next";}); S.activeId="c1";
```

- [ ] **Step 2: Run to verify failure** — `python3 tests/run.py | grep -E "go:|landing|passed"` → FAIL / not defined.

- [ ] **Step 3: Implement** (after `function saveLocal(){…}`)

```js
let _moreOpen=false, _notifsOpen=false;   // phone sheets — device-only UI state, never in S
function goStr(tab,cycle,anchor){ return [tab,cycle||"",anchor||""].join("|").replace(/\|+$/,""); }
function parseGo(str){ const p=String(str||"").split("|"); return {tab:p[0]||"my",cycle:p[1]||null,anchor:p[2]||null}; }
function go(tab,o){ o=o||{};
  if(o.cycle&&o.cycle!==S.activeId&&S.cycles.some(c=>c.id===o.cycle)){ S.activeId=o.cycle; dailyDate=null; window._range=null; hydrateCycleSettings(); hydrateCycleRoles(); }
  S.tab=tab; _moreOpen=false; _notifsOpen=false; saveLocal(); render();
  if(o.anchor){ const el=document.getElementById(o.anchor); if(el&&el.scrollIntoView)try{ el.scrollIntoView({block:"start",behavior:"smooth"}); }catch(e){} } }
function landingTab(viewAs){ return viewAs==="admin"?S.tab:"my"; }
```

In `wire()` next to the `[data-tab]` handler add:

```js
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{ const g=parseGo(b.dataset.go); go(g.tab,{cycle:g.cycle,anchor:g.anchor}); });
```

At the sign-in line (~716) change `S.viewAs=id; _realAdmin=(id==="admin"); authState="in";` to `S.viewAs=id; _realAdmin=(id==="admin"); S.tab=landingTab(id); authState="in";`.

Replace prose cross-references with links:
- `openRoundBanner()`: `<button class="btn sm primary" data-gocyc="${other.id}">Go to that cycle →</button>` stays; change the bold text to `<b>Booking is open</b>`.
- Self-roster control card (~2121): the sentence `(Open it in Admin settings to let staff book)` becomes `(<a href="#" data-go="setup||card-status">open it in Settings</a> to let staff book)` and `② release for self-roster (Admin settings → Roster status)` becomes `② <a href="#" data-go="setup||card-status">open booking</a> (Settings → Roster status)`. Give the Roster status card in `viewSetup` the id: change `<h2>Roster status` card wrapper to `<div class="card" id="card-status">`.
- `setupGuideHTML()` step 3: `on the <b>Self-roster</b> tab use` → `on the <a href="#" data-go="selfroster">${escapeHTML(tabLabel("selfroster"))}</a> tab use`.
- Add to CSS: `a[data-go]{color:var(--accent-ink);font-weight:600;text-decoration:underline;text-underline-offset:2px}`.

- [ ] **Step 4: Run tests** → `132 passed, 0 failed`.
- [ ] **Step 5: Commit** — `git commit -am "UI phase 1: go() helper, data-go prose links, staff land on My shifts at sign-in"`

---

### Task 3: Bottom bar on phones, More sheet, slimmer header

**Files:**
- Modify: `app.html` — shell (~345–358): add `<nav id="bottomnav" class="bottomnav" aria-label="Sections"></nav>` and `<div id="sheetRoot"></div>` after `<div id="modalRoot"></div>`; remove `<span class="pill" id="statusPill"></span>`; `render()` builds the bar and the sheet; CSS block for `.bottomnav`, `.sheet`, phone header hiding; `wire()` handlers for `#bnMore`, sheet rows, `#viewAsSheet`, `#sheetSignOut`, `#sheetSwitch`.
- Test: `tests/suite.js`.

**Interfaces:**
- Produces: `bottomNavHTML() → string` (4 primary + More, active state), `moreSheetHTML() → string` (rest of tabs + account rows), `NIC` icon map (my, book, roster, requests, settings, more), `closeSheets()`.
- Consumes: `navPrimary()`, `navMore()`, `tabLabel()` from Task 1; `_moreOpen` from Task 2.

- [ ] **Step 1: Failing tests**

```js
  // ---- Phase 1: bottom bar + More sheet ----
  S.viewAs="s1"; S.tab="my"; var bn=bottomNavHTML();
  T("bottom bar: primary tabs + More", bn.indexOf('data-tab="my"')>=0 && bn.indexOf('data-tab="selfroster"')>=0 && bn.indexOf('id="bnMore"')>=0 && (bn.match(/class="bn/g)||[]).length===5);
  T("bottom bar: active state follows S.tab", /class="bn active"[^>]*data-tab="my"/.test(bn));
  S.tab="equity"; bn=bottomNavHTML();
  T("bottom bar: More lights up for a tab it holds", /class="bn active"[^>]*id="bnMore"/.test(bn));
  _moreOpen=true; var ms=moreSheetHTML();
  T("More sheet: lists the remaining tabs and the account rows", ms.indexOf('data-tab="planner"')>=0 && ms.indexOf('data-tab="my"')<0 && ms.indexOf("Signed in as")>=0);
  S.viewAs="admin"; ms=moreSheetHTML();
  T("More sheet: admin gets View as", ms.indexOf('id="viewAsSheet"')>=0);
  _moreOpen=false; S.tab="my";
```

- [ ] **Step 2: Run to verify failure** → not defined.

- [ ] **Step 3: Implement**

Icons (add after `const EIC=…`):

```js
const NIC={
  my:'<svg viewBox="0 0 24 24" class="nic"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4M8 14h4"/></svg>',
  selfroster:'<svg viewBox="0 0 24 24" class="nic"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
  roster:'<svg viewBox="0 0 24 24" class="nic"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/></svg>',
  requests:'<svg viewBox="0 0 24 24" class="nic"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5z"/></svg>',
  setup:'<svg viewBox="0 0 24 24" class="nic"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  more:'<svg viewBox="0 0 24 24" class="nic"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>' };
```

Functions (after `navMore()`):

```js
function bottomNavHTML(){
  const prim=navPrimary(); const moreIds=navMore().map(t=>t.id); const moreActive=moreIds.includes(S.tab)||_moreOpen;
  return prim.map(({id,label})=>`<button class="bn${S.tab===id&&!_moreOpen?" active":""}" data-tab="${id}" aria-current="${S.tab===id?"page":"false"}">${NIC[id]||NIC.roster}<span>${label}</span></button>`).join("")
       +`<button class="bn${moreActive?" active":""}" id="bnMore" aria-haspopup="dialog" aria-expanded="${_moreOpen?"true":"false"}">${NIC.more}<span>More</span></button>`;
}
function moreSheetHTML(){
  const rows=navMore().map(({id,label})=>`<button class="sheetrow${S.tab===id?" on":""}" data-tab="${id}">${label}</button>`).join("");
  const me=nameOf(S.viewAs);
  const acct=[`<div class="sheetlbl">Account</div>`, `<div class="sheetrow static">Signed in as <b>${escapeHTML(me)}</b>${cloudOn()?` · <span class="muted small">${cloudState==="connected"?"synced":"offline"}</span>`:""}</div>`];
  if(!cloudOn()||_realAdmin) acct.push(`<label class="sheetrow static">View as <select id="viewAsSheet"><option value="admin">Admin</option>${S.staff.map(s=>`<option value="${s.id}" ${s.id===S.viewAs?"selected":""}>${escapeHTML(s.name)}</option>`).join("")}</select></label>`);
  if(cloudOn()&&authState==="in"&&_orgCount>1) acct.push(`<button class="sheetrow" id="sheetSwitch">Switch roster ⇄</button>`);
  if(cloudOn()&&authState==="in") acct.push(`<button class="sheetrow" id="sheetSignOut">Sign out</button>`);
  return `<div class="overlay sheetwrap" id="ovlMore"><div class="sheet" role="dialog" aria-modal="true" aria-label="More"><div class="sheetgrab"></div>${rows}${acct.join("")}</div></div>`;
}
function closeSheets(){ _moreOpen=false; _notifsOpen=false; render(); }
```

In `render()`, after the `#tabs` innerHTML line:

```js
  document.getElementById("bottomnav").innerHTML=authMode?"":bottomNavHTML();
  document.getElementById("sheetRoot").innerHTML=(!authMode&&_moreOpen)?moreSheetHTML():"";
```

(`authMode` is defined earlier in render(); the early `return` for the sign-in screen must also clear both: add `document.getElementById("bottomnav").innerHTML=""; document.getElementById("sheetRoot").innerHTML="";` before `document.getElementById("app").innerHTML=authScreen();`.)

Remove the status pill: delete `<span class="pill" id="statusPill"></span>` from the shell and the three `statusPill` lines in `render()`; the cycle select already carries the status in its option text. Style the select as a chip: `#cycleSel{border-radius:999px;padding:6px 30px 6px 12px;font-weight:600;background:var(--accent-bg);border-color:transparent;color:var(--accent-ink)}`.

`wire()` additions (next to the `[data-tab]` handler; the existing `[data-tab]` handler already covers the bottom bar and sheet rows — extend it to close sheets):

```js
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;_moreOpen=false;_notifsOpen=false;saveLocal();render();});
  const bm=document.getElementById("bnMore"); if(bm)bm.onclick=()=>{ _moreOpen=!_moreOpen; _notifsOpen=false; render(); };
  const om=document.getElementById("ovlMore"); if(om)om.onclick=e=>{ if(e.target.id==="ovlMore")closeSheets(); };
  const vs=document.getElementById("viewAsSheet"); if(vs)vs.onchange=()=>{ S.viewAs=vs.value; _moreOpen=false; saveLocal(); render(); };
  const ss=document.getElementById("sheetSignOut"); if(ss)ss.onclick=authSignOut;
  const sw=document.getElementById("sheetSwitch"); if(sw)sw.onclick=()=>{ try{localStorage.removeItem("myrosta_org");}catch(e){} location.reload(); };
```

Add an Escape key close once (near the other global listeners, e.g. after `wire()` definition): `document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&(_moreOpen||_notifsOpen))closeSheets(); });`

CSS (base, outside media queries):

```css
  .bottomnav{display:none}
  .nic{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .sheetwrap{align-items:flex-end;padding:0}
  .sheet{background:var(--surface);border-radius:18px 18px 0 0;width:100%;max-width:640px;padding:8px 12px max(16px,env(safe-area-inset-bottom));box-shadow:0 -12px 40px -12px rgba(11,18,32,.35);max-height:80vh;overflow:auto}
  .sheetgrab{width:40px;height:4px;border-radius:2px;background:var(--line2);margin:4px auto 10px}
  .sheetrow{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:10px 12px;border:none;background:none;border-radius:10px;font:inherit;font-size:16px;color:var(--text);text-align:left;cursor:pointer}
  .sheetrow:hover{background:var(--hover)} .sheetrow.on{background:var(--accent-bg);color:var(--accent-ink);font-weight:600} .sheetrow.static{cursor:default}
  .sheetrow select{margin-left:auto;min-height:40px}
  .sheetlbl{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--hint);padding:12px 12px 4px;border-top:1px solid var(--line);margin-top:6px}
```

Inside `@media(max-width:640px)`:

```css
    .tabs,#viewAsWrap,#logoutBtn,#switchOrgBtn,#cloudPill{display:none !important}   /* the bottom bar and the More sheet take over on phones */
    .bottomnav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:60;background:var(--topbar);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom)}
    .bn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:56px;border:none;background:none;color:var(--muted);font:inherit;font-size:11px;font-weight:500;padding:6px 2px}
    .bn.active{color:var(--accent-ink)} .bn.active .nic{stroke-width:2.2}
    .wrap{padding-bottom:calc(76px + env(safe-area-inset-bottom))}
    .topbar{gap:6px 8px} #cycleWrap{width:auto;order:0;flex:1 1 auto;min-width:0} #cycleWrap select{max-width:100%}
```

Add `.bottomnav` to the print block's hidden list. Remove the earlier `#cycleWrap{width:100%;order:1}` rule (the cycle chip now shares the brand row).

- [ ] **Step 4: Run tests** → `137 passed`. Then browser check at 375 px: header ≤ 120 px, `.bottomnav` 56 px + inset, More opens/closes, `document.documentElement.scrollWidth<=375`.
- [ ] **Step 5: Commit** — `git commit -am "UI phase 1: bottom bar + More sheet on phones, cycle chip replaces the status pill"`

---

### Task 4: Notifications as an actionable sheet

**Files:**
- Modify: `app.html` — `notify()` (~729) gains a 4th argument; `viewNotifs()` (~2222) becomes `notifsSheetHTML()`; `render()` renders it into `#sheetRoot` when `_notifsOpen`; bell handler (~3426) toggles; the `S.tab==="notifs"` mark-read block (~3755) moves; ~10 `notify()` call sites gain targets.
- Test: `tests/suite.js`.

**Interfaces:**
- Produces: `notify(to,text,id,go)` where `go={tab,cycle?,anchor?}` stored as `n.go`; `notifsSheetHTML() → string`; rows carry `data-go`.

- [ ] **Step 1: Failing tests**

```js
  // ---- Phase 1: notifications with targets ----
  S.notifications=[]; notify("all","Booking is open for X.","t-open",{tab:"selfroster",cycle:"c1"}); notify("s1","Your leave was approved.","t-lv",{tab:"requests"}); notify("s1","Plain text alert");
  var n0=S.notifications.find(function(n){return n.id==="t-open";});
  T("notify: stores the target", n0 && n0.go && n0.go.tab==="selfroster" && n0.go.cycle==="c1");
  T("notify: no target is fine", S.notifications.some(function(n){return n.text==="Plain text alert" && !n.go;}));
  S.viewAs="s1"; _notifsOpen=true; var sh=notifsSheetHTML();
  T("notif sheet: targeted rows are links, plain rows are not", /data-go="selfroster\|c1"/.test(sh) && /data-go="requests"/.test(sh) && sh.indexOf("Plain text alert")>=0);
  T("notif sheet: has Mark all read", sh.indexOf('id="notifsRead"')>=0);
  _notifsOpen=false; S.notifications=[];
```

- [ ] **Step 2: Run to verify failure**.

- [ ] **Step 3: Implement**

```js
function notify(to,text,id,go){if(id&&(S.notifications||[]).some(n=>n.id===id))return;const n={id:id||("n"+Date.now()+Math.random().toString(36).slice(2,5)),to,text,ts:Date.now(),readBy:[]}; if(go&&go.tab)n.go={tab:go.tab,cycle:go.cycle||null,anchor:go.anchor||null}; S.notifications.unshift(n);}
```

Replace `viewNotifs()` with:

```js
function notifsSheetHTML(){
  const me=S.viewAs, list=notifFor(me);
  const items=list.length?list.map(n=>{
    const read=(n.readBy||[]).includes(me), body=`<span class="dot"></span><div class="grow"><div>${escapeHTML(n.text)}</div><div class="muted small">${tsFmt(n.ts)}</div></div>`;
    return n.go?`<button class="notif act ${read?"read":""}" data-go="${escapeHTML(goStr(n.go.tab,n.go.cycle,n.go.anchor))}">${body}<span class="chev">›</span></button>`:`<div class="notif ${read?"read":""}">${body}</div>`;
  }).join(""):emptyState(EIC.bell,"You're all caught up","Approvals, roster changes and alerts will appear here.");
  return `<div class="overlay sheetwrap" id="ovlNotifs"><div class="sheet" role="dialog" aria-modal="true" aria-label="Notifications"><div class="sheetgrab"></div>
    <div class="row" style="align-items:center;margin-bottom:6px"><h2 style="font-size:17px">Notifications</h2><span class="grow"></span>${list.length?`<button class="btn sm" id="notifsRead">Mark all read</button>`:""}</div>${items}</div></div>`;
}
function viewNotifs(){ return notifsSheetHTML(); }   // kept for any stored S.tab==="notifs"
```

`render()`: `document.getElementById("sheetRoot").innerHTML=(!authMode&&_moreOpen)?moreSheetHTML():((!authMode&&_notifsOpen)?notifsSheetHTML():"");` and in the tab dispatch change `else if(S.tab==="notifs")content=viewNotifs();` to `else if(S.tab==="notifs"){S.tab="my";content=viewMy();}`.

`wire()`: replace the bell handler with `if(bell)bell.onclick=()=>{ _notifsOpen=!_notifsOpen; _moreOpen=false; if(_notifsOpen)markNotifsRead(S.viewAs); render(); };` and add `const on_=document.getElementById("ovlNotifs"); if(on_)on_.onclick=e=>{ if(e.target.id==="ovlNotifs")closeSheets(); }; const nr=document.getElementById("notifsRead"); if(nr)nr.onclick=()=>{ markNotifsRead(S.viewAs); render(); };`. Delete the old `if(S.tab==="notifs"){ markNotifsRead… }` block (~3755).

CSS: `button.notif{width:100%;border:none;background:none;font:inherit;text-align:left;cursor:pointer;color:var(--text)} button.notif:hover{background:var(--hover)} .notif .chev{color:var(--hint);font-size:18px;align-self:center}` and on phones `.notif{min-height:56px}`.

Targets at call sites (add the 4th argument; keep ids where present):
- ~811 auto-open: `notify("all","Booking is open for "+cyLabel(cyc)+".","n-auto-open-"+cyc.id,{tab:"selfroster",cycle:cyc.id})`; ~812 auto-close: `…"Booking has closed for "…,{tab:"my",cycle:cyc.id}`.
- ~1097 open shift posted, ~1109 offered: `,{tab:"my",anchor:"openshifts"}` (ids stay as they are).
- ~1146 giveaway taken, ~1161 claim approved: `{tab:"my"}`.
- ~1222, ~1233 request comment / needs info; ~2244, ~2251, ~2258, ~2260 approvals/declines; ~2354, ~2357, ~2377, ~2380, ~2384, ~2389, ~2401, ~2402, ~2407 swap/cancel outcomes: `{tab:"requests"}`.
- ~1290 waves started, ~1300 wave advance: `{tab:"selfroster"}`.
- ~1390, ~1394 fixed pattern: `{tab:"my"}`.
- ~3519 published/live: `{tab:"my",cycle:active().id}`; ~3520 opened: `notify("all","Booking is open for "+cyLabel(active())+".",null,{tab:"selfroster",cycle:active().id})`.
- Give the marketplace card an anchor: in `marketMyHTML()` both `<div class="card">` openers become `<div class="card" id="openshifts">`.

- [ ] **Step 4: Run tests** → `141 passed`. Browser: bell opens the sheet, a targeted row navigates, Escape/backdrop closes.
- [ ] **Step 5: Commit** — `git commit -am "UI phase 1: notifications are a sheet whose rows take you to the shift, request or round they mention"`

---

### Task 5: My shifts rebuilt by urgency

**Files:**
- Modify: `app.html` — `viewMy()` (~3152–3222): new helpers `actionRowHTML(sid,s)`, `weekStripHTML(sid)`, `quotaStripHTML(sid,s)`, sections via `<details class="sec">`; `wire()` gains `#calToggle`; CSS for `.actrow`, `.wk-row`, `details.sec`, `.osstrip`.
- Test: `tests/suite.js`.

**Interfaces:**
- Produces: `weekStripHTML(sid, fromISO) → string` (7 rows; consecutive Off days collapse to one), `actionRowHTML(sid,s) → string`, `quotaStripHTML(sid,s) → string`, `window._showCal` (device-only).
- Consumes: `bookingGate`, `isRolling`, `osActive`, `featOn`, `getShift`, `shiftLabel`, `periodTime`, `isPH`, `go`/`data-go`.

- [ ] **Step 1: Failing tests**

```js
  // ---- Phase 1: My shifts by urgency ----
  S.viewAs="s1"; S.cycles[0].status="published"; S.cycles[0].assign={}; var d0=FUT(1), d1=FUT(2), d4=FUT(5);
  S.cycles[0].cycle.start=iso(mondayOf(parseISO(d0))); S.cycles[0].assign["s1|"+d1]={kind:"clinical",period:"PM",zone:"z1"};
  var ws=weekStripHTML("s1",d0);
  T("week strip: shows the booked day with its time and zone", ws.indexOf("Resus")>=0 && ws.indexOf(periodTime("PM"))>=0);
  T("week strip: collapses consecutive off days into one line", (ws.match(/wk-off/g)||[]).length<=3 && /Off/.test(ws));
  var ar=actionRowHTML("s1",S.staff[0]);
  T("action row: published rounds cycle → no Book, but Request and Calendar", ar.indexOf('data-go="selfroster"')<0 && ar.indexOf('data-go="requests"')>=0 && ar.indexOf('id="calToggle"')>=0);
  S.cycles[0].status="open"; ar=actionRowHTML("s1",S.staff[0]);
  T("action row: open round → Book shifts", ar.indexOf('data-go="selfroster"')>=0 && ar.indexOf("Book shifts")>=0);
  cset().rosterMode="rolling"; S.rosterMode="rolling"; S.cycles[0].status="published"; ar=actionRowHTML("s1",S.staff[0]);
  T("action row: rolling live → Add or drop shifts", ar.indexOf("Add or drop shifts")>=0);
  cset().rosterMode="rounds"; S.rosterMode="rounds";
  S.marketOn=true; S.viewAs="admin"; postOpenShift(FUT(3),"AM","z2","cover"); S.viewAs="s1"; ar=actionRowHTML("s1",S.staff[0]);
  T("action row: open shifts count links to the marketplace card", /Open shifts \(1\)/.test(ar) && ar.indexOf('data-go="my||openshifts"')>=0);
  S.openShifts=[]; S.marketOn=false;
  var vm=viewMy();
  T("My shifts: order is hero → actions → this week → quota → sections", vm.indexOf('class="nextcard"')<vm.indexOf('class="actrow"') && vm.indexOf('class="actrow"')<vm.indexOf('class="weekstrip"') && vm.indexOf('class="weekstrip"')<vm.indexOf('class="quotastrip"') && vm.indexOf('class="quotastrip"')<vm.indexOf('<details class="sec"'));
  T("My shifts: legacy ids survive inside the sections", ['id="rFrom"','id="rTo"','id="icsBtn"','id="vAgenda"','id="myBody"'].every(function(x){return vm.indexOf(x)>=0;}));
```

- [ ] **Step 2: Run to verify failure**.

- [ ] **Step 3: Implement** (helpers placed just above `function viewMy(){`)

```js
function weekStripHTML(sid,fromISO){
  const ds=cycleDates(); if(!ds.length)return "";
  const start=fromISO>=iso(ds[0])?fromISO:iso(ds[0]);
  const days=ds.filter(d=>iso(d)>=start).slice(0,7); if(!days.length)return "";
  let out="", offRun=[];
  const flush=()=>{ if(!offRun.length)return; const a=offRun[0], b=offRun[offRun.length-1];
    out+=`<div class="wk-row wk-off"><span class="wk-d">${DOW[a.getDay()]} ${a.getDate()}${offRun.length>1?" – "+DOW[b.getDay()]+" "+b.getDate():""}</span><span class="wk-s muted">Off</span></div>`; offRun=[]; };
  days.forEach(d=>{ const k=iso(d), sh=getShift(sid,k), we=d.getDay()===0||d.getDay()===6, ph=isPH(k);
    if(!sh||sh.kind==="off"||!sh.kind){ offRun.push(d); return; } flush();
    const when=sh.kind==="clinical"?periodTime(sh.period):(sh.kind==="cst"?(effShiftTimes().CST.start+"–"+effShiftTimes().CST.end):"");
    out+=`<div class="wk-row ${we?"we":""} ${sh.kind}"><span class="wk-d">${DOW[d.getDay()]} ${d.getDate()}${ph?' <span class="ph-badge">PH</span>':""}</span><span class="wk-s"><b>${escapeHTML(shiftLabel(sh))}</b>${when?` · ${when}`:""}</span></div>`; });
  flush();
  return `<div class="weekstrip"><div class="sub" style="margin-bottom:6px"><b>This week</b></div>${out}</div>`;
}
function actionRowHTML(sid,s){
  const adm=isAdmin(), g=bookingGate(active()); const btns=[];
  if(!adm&&g.ok)btns.push(`<button class="btn primary" data-go="selfroster">${isRolling()?"Add or drop shifts":"Book shifts"}</button>`);
  if(!adm)btns.push(`<button class="btn" data-go="requests">Request leave or swap</button>`);
  const open=(featOn("marketplace")&&S.marketOn)?osActive().filter(o=>o.status==="open").length:0;
  if(open)btns.push(`<button class="btn" data-go="my||openshifts">Open shifts (${open})</button>`);
  btns.push(`<button class="btn" id="calToggle" aria-expanded="${window._showCal?"true":"false"}">Calendar</button>`);
  return `<div class="actrow">${btns.join("")}</div>`;
}
function quotaStripHTML(sid,s){
  const t=shiftTally(sid), periods=cyclePeriods(), cycClin=t.am+t.pm, quota=+s.quota||0;
  return `<div class="quotastrip"><span class="pill ${quota&&cycClin>=quota?"ok":"muted"}">Booked ${cycClin}/${quota||"—"}</span>${periods.map(p=>{const b=bookedInPeriod(sid,p),tg=periodTarget(s,p.index);return `<span class="pill ${b>=tg?"ok":"warn"}">${p.label} ${b}/${tg}</span>`;}).join("")}</div>`;
}
```

Rewrite the return of `viewMy()` (keep every computed value above it). The new template, in order:

```js
  const showCal=!!window._showCal, openSec=!isMobile();
  return `<div class="card">
    <h2>My shifts${adm?"":" — "+escapeHTML(s.name)}</h2>
    ${adm?`<div class="row"><div class="field"><label>${ROLEC()}</label><select id="mySel">${rosterStaff().map(x=>`<option value="${x.id}" ${x.id===sid?"selected":""}>${escapeHTML(x.name)}</option>`).join("")}</select></div></div>`:""}
    <div class="nextcard">
      <div class="nextlbl">Your next shift</div>
      <div class="nextrow"><div class="nextmain">${escapeHTML(nextMain)}</div>${nextSh?`<div class="nextwhen">${whenStr}</div>`:""}</div>
      <div class="qbar"><div class="qbar-top"><span class="muted small">Booked this cycle</span><span class="qnum"><b>${cycClin}</b> / ${quota||"—"}</span></div><div class="qtrack"><div class="qfill" style="width:${qpct}%"></div></div></div>
    </div>
    ${actionRowHTML(sid,s)}
    ${weekStripHTML(sid,todayISO)}
    ${quotaStripHTML(sid,s)}
    <details class="sec" ${openSec?"open":""}><summary>Whole cycle</summary>
      <div class="seg" style="margin-top:8px"><button class="on" id="vAgenda">Agenda</button><button id="vMonth">Month</button></div>
      <div id="myBody">${agendaHTML(sid,r.from,r.to)}</div>
    </details>
    <details class="sec" ${openSec?"open":""}><summary>Stats &amp; tally</summary>
      <div class="grid-tiles" style="margin:12px 0">
        <div class="tile"><div class="tilehead">${TIC.cal}<span class="k">Clinical shifts</span></div><div class="v">${clin}</div></div>
        <div class="tile"><div class="tilehead">${TIC.cst}<span class="k">CST</span></div><div class="v">${cst}</div></div>
        <div class="tile"><div class="tilehead">${TIC.leave}<span class="k">Leave days</span></div><div class="v">${leave}</div></div>
        <div class="tile"><div class="tilehead">${TIC.cme}<span class="k">CME days</span></div><div class="v">${cme}</div></div>
        <div class="tile"><div class="tilehead">${TIC.clock}<span class="k">Clinical hours</span></div><div class="v">${hrs}</div></div>
        <div class="tile"><div class="tilehead">${TIC.target}<span class="k">Quota (cycle)</span></div><div class="v">${clin}/${s.quota}</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <span class="chip am">AM ${t.am}</span><span class="chip pm">PM ${t.pm}</span><span class="chip cst">CST ${t.cst}</span>
        ${Object.keys(t.zones).sort().map(zn=>`<span class="pill muted">${escapeHTML(zn)} ×${t.zones[zn]}</span>`).join("")}
        ${t.locum?`<span class="chip locumleg" title="Clinical shifts you covered as locum">Locum ${t.locum}</span>`:""}
      </div>
      ${Object.keys(t.leave).length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${["CME","AL","PL","LSL","Sab","PH","UA","UPL","Other","Orientation","Vacant"].filter(c=>t.leave[c]).map(c=>{const l=leaveStyle(c);return `<span class="chip" style="background:${l.bg};color:${l.t}">${l.name} ${t.leave[c]}</span>`;}).join("")}</div>`:""}
      ${(()=>{const py=plannerYear(),yt=leaveCodeDaysInRange(sid,py.from,py.to),al=leaveStyle("AL"),cm=leaveStyle("CME");return `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="muted small">This year (${py.from.slice(0,4)}):</span><span class="chip" style="background:${al.bg};color:${al.t}">Annual used ${yt.AL||0}</span><span class="chip" style="background:${cm.bg};color:${cm.t}">CME used ${yt.CME||0}</span></div>`;})()}
    </details>
    <details class="sec" id="calSec" ${showCal||openSec?"open":""}><summary>Calendar &amp; export</summary>
      <div class="row" style="margin-top:8px">
        <div class="drange">
          <div class="field"><label>From</label><input type="date" id="rFrom" value="${r.from}"></div>
          <div class="field"><label>To</label><input type="date" id="rTo" value="${r.to}"></div>
        </div>
        <div class="presets"><button class="btn sm" data-preset="all">Whole cycle</button><button class="btn sm" data-preset="2wk">Next 2 wks</button></div>
        <button class="btn primary" id="icsBtn">Add to calendar (.ics)</button>${cloudOn()?` <button class="btn" id="subLive">Live calendar${window._showSub?" ▴":""}</button>`:""}
        ${window._showSub?subFeedHTML(s):""}
      </div>
    </details>
  </div>${(featOn("marketplace")&&S.marketOn)?marketMyHTML():""}${(s.mode==="fixed"||s.mode==="preference")?fixedPatternEditorHTML(s,adm||sid===S.viewAs,!adm):""}`;
```

(Every value referenced — `clin cst leave cme hrs t periods r nextMain nextSh whenStr cycClin quota qpct todayISO` — is already computed at the top of `viewMy()`; do not remove those lines.)

`wire()`: `const ct=document.getElementById("calToggle"); if(ct)ct.onclick=()=>{ window._showCal=!window._showCal; const cs=document.getElementById("calSec"); if(cs){cs.open=window._showCal; if(cs.open&&cs.scrollIntoView)cs.scrollIntoView({block:"start",behavior:"smooth"});} ct.setAttribute("aria-expanded",window._showCal?"true":"false"); };`

CSS:

```css
  .actrow{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
  .weekstrip{margin:0 0 12px} .wk-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);min-height:44px}
  .wk-row.we{background:var(--we);margin:0 -8px;padding:9px 8px;border-radius:8px} .wk-d{font-weight:600;min-width:96px} .wk-s{text-align:right} .wk-off .wk-s{color:var(--muted)}
  .wk-row.clinical .wk-s b{color:var(--am-t)} .wk-row.cst .wk-s b{color:var(--cst-t)} .wk-row.leave .wk-s b{color:var(--leave-t)}
  .quotastrip{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}
  details.sec{border-top:1px solid var(--line);padding:6px 0} details.sec>summary{cursor:pointer;font-weight:600;padding:10px 0;list-style:none;display:flex;align-items:center;gap:8px;min-height:44px}
  details.sec>summary::-webkit-details-marker{display:none} details.sec>summary::before{content:"›";display:inline-block;transition:transform .15s;color:var(--hint)} details.sec[open]>summary::before{transform:rotate(90deg)}
  @media(max-width:640px){ .actrow .btn{flex:1 1 45%;justify-content:center} }
```

- [ ] **Step 4: Run tests** → `150 passed`. Browser at 375 px as staff: hero + action row + this week visible without scrolling past ~900 px; sections closed; ids present.
- [ ] **Step 5: Commit** — `git commit -am "UI phase 1: My shifts by urgency — next shift, actions, this week, quota, then collapsible sections"`

---

### Task 6: The word is "booking" — in-app strings and Help follow the new tab names

**Files:**
- Modify: `app.html` strings at ~799, ~811–812, ~1290, ~1300, ~1532, ~2113–2115, ~2159, ~2189, ~3049, ~3520 and every literal `Admin settings` (13) → `Settings`.
- Test: `tests/suite.js`.

- [ ] **Step 1: Failing tests**

```js
  // ---- Phase 1: copy follows the tab names ----
  S.viewAs="s1"; var hh2=viewHelp();
  T("copy: Help no longer says Admin settings or Self-roster tab", hh2.indexOf("Admin settings")<0 && hh2.indexOf("‘Self‑roster’")<0);
  S.cycles[0].status="published"; cset().rosterMode="rounds"; S.rosterMode="rounds";
  S.cycles[0].window={enabled:true,open:FUT(2)+"T09:00",close:FUT(9)+"T17:00",fired:null};
  T("copy: gate reason says booking", /Booking hasn't opened yet/.test(bookingGate(S.cycles[0]).reason||"") || S.cycles[0].status!=="open");
  S.cycles[0].window=null;
```

- [ ] **Step 2: Run** — the Help assertion fails today.

- [ ] **Step 3: Implement** — apply with a script and read every diff hunk:

```bash
python3 - <<'EOF'
import pathlib,re
p=pathlib.Path('app.html'); s=p.read_text()
pairs=[("Self-roster hasn't opened yet.","Booking hasn't opened yet."),("Self-roster has closed.","Booking has closed."),
 ('notify("all","Self‑roster is open for "','notify("all","Booking is open for "'),('notify("all","Self‑roster has closed for "','notify("all","Booking has closed for "'),
 ('"Self-roster has opened in waves. Wave 1 is picking now."','"Booking has opened in waves. Wave 1 is picking now."'),('"Self-roster wave "','"Booking wave "'),
 ("<b>Self-roster is open</b> for","<b>Booking is open</b> for"),("<b>Self‑roster opens</b>","<b>Booking opens</b>"),("<b>Self‑roster is open</b>","<b>Booking is open</b>"),("<b>Self‑roster closed</b>","<b>Booking closed</b>"),
 ('<h2>Self-roster</h2><div class="sub">${escapeHTML(_gate.reason','<h2>Book shifts</h2><div class="sub">${escapeHTML(_gate.reason'),('<h2>Self-roster${adm?"":" — "','<h2>Book shifts${adm?"":" — "'),
 ("go to ‘Self‑roster’","go to ‘Book shifts’"),('notify("all","Self-roster is open for "+cyLabel(active())+"."','notify("all","Booking is open for "+cyLabel(active())+".",null,{tab:"selfroster",cycle:active().id}'),
 ("Admin settings","Settings")]
for a,b in pairs:
    n=s.count(a); print(f"{n:2d} × {a[:60]}"); s=s.replace(a,b)
p.write_text(s)
EOF
```

Check the `Admin settings` replacements did not touch the `NAV_LABELS` line (it already says `Settings`) or any function name; `git diff app.html | grep -c "^[-+]"` should be ≈ 2× the number of replacements.

- [ ] **Step 4: Run tests** → `152 passed`.
- [ ] **Step 5: Commit** — `git commit -am "UI phase 1: the word is booking — alerts, banners, gate reasons and Help follow the new tab names"`

---

### Task 7: Sync, measure, adversarial review, changelog

**Files:** `deploy/app.html`, `preview.html`, `CHANGELOG.md`, `MYROSTA-UI-STRATEGY.md`.

- [ ] **Step 1: Sync copies** — `cp app.html deploy/app.html`; regenerate `preview.html` by swapping only the `const CLOUD=` line (keep preview's blanked line); `python3 tests/run.py deploy/app.html | tail -1` → all passed.
- [ ] **Step 2: Measure at 375 px** on the review copy (`scratchpad/ui-review/site/ui-review.html` rebuilt from `preview.html` + the seed block): `.topbar` height ≤ 120; `.bottomnav` present, 56 px + inset; zero interactive elements under 44 px on My shifts / Requests / Day board (staff) except none; `document.documentElement.scrollWidth === 375`; the More sheet opens and closes; a targeted notification row navigates; desktop 1280 px: strip in the new order, no bottom bar.
- [ ] **Step 3: Adversarial review** (Workflow, 3 skeptics, read-only): (a) wiring — every id/handler that existed still binds (ids inside `<details>`, duplicate-id check for `viewAs` vs `viewAsSheet`, the `[data-tab]` handler now closing sheets), (b) navigation edge cases — `S.tab` persisted as `notifs`/`setup` for staff, feature flags off, rolling label, `_orgCount>1`, sign-in landing, Escape/backdrop, print, (c) My shifts — admin picker path, empty staff, cycle in the past/future, `window._range` reset, marketplace anchor, `.ics` and live-calendar buttons still wired.
- [ ] **Step 4: Fix what they confirm; re-run tests; re-measure.**
- [ ] **Step 5: Changelog + strategy note + commit** — CHANGELOG "8 Sep 2026 — UI phase 1"; mark Phase 1 DONE in `MYROSTA-UI-STRATEGY.md`; `git commit -am "UI phase 1: sync deploy/preview, changelog"`. The user pushes; verify `curl -s https://myrosta.com.au/app.html | grep -c bottomnav` > 0.

---

## Self-review

- **Spec coverage:** bottom bar (T3) · role-ordered/renamed tabs (T1) · slimmer header: status pill gone, cycle chip, account items in More (T3) — the desktop avatar menu from the strategy is deferred: desktop keeps View as / Sign out / ⇄ Group in the bar, which is not a phone problem · My shifts by urgency (T5) · open-shift strip: delivered as the "Open shifts (n)" action + anchor, not a separate strip (the count is the signal; the card is one tap away) · actionable notifications (T4) · "booking" wording (T6) · landing on My shifts (T2).
- **Placeholders:** none; every step has code.
- **Type consistency:** `go(tab,{cycle,anchor})`, `goStr/parseGo` with `"tab|cycle|anchor"`, `notify(to,text,id,go)`, `navTabs/navPrimary/navMore → [{id,label}]`, `tabLabel(id)`, `bottomNavHTML/moreSheetHTML/notifsSheetHTML → string`, `_moreOpen/_notifsOpen` module lets, `window._showCal` — used identically across tasks.
