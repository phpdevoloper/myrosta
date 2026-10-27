// Recast rename (6 Oct 2026, before any take): s = localStorage.getItem('myrosta_demo_v6'); s = s.split('Amara Okafor').join('Emma Walsh').split('Alex Chen').join('Alex Campbell');
//   localStorage.setItem('myrosta_demo_v6', s); load(); S.staff.find(x => x.id === 'demo-3').initials = 'EW'; save(); render();   — the seed itself is unchanged.
// The seven takes, as Playwright run-code functions (page = the MCP's page; the phone/laptop pages are found by viewport width).
// Shared helpers used by every take:
//   const loop = capture every 80 ms into .playwright-mcp/film/rec/<take>/f00000.jpg … (see mk.sh)
//   tap(sel)      phone: ripple at the element's centre, then mouse.click
//   click(sel)    laptop: glide the cursor div to the element, wait 520 ms, mouse.click
//   hold(ms)      waitForTimeout
// Selectors (demo sandbox, 6 Oct 2026):
//   tabs: .bn[data-tab="selfroster"] (phone bottom nav), .tab[data-tab="equity"|"audit"|"daily"] (laptop)
//   Book shifts: [data-bday="YYYY-MM-DD"] day row → [data-dsper="PM"] period → [data-pick="YYYY-MM-DD|AM|resus"] zone chip
//                → .srConfirm ("Confirm N picks") → receipt "That's your share — N of N booked."
//   Swap: [data-go="requests"] → #reqSwap → [data-swmode="all"] (Ask everyone) → select #swMine → #swAsk
//         Alex: select .wrap select (#swofs-<id>) → [data-swoffer] (Send offer)
//         Emma: [data-swaccept] → #cfOk (the in-app confirm)
//         Admin: [data-approveswap] (no confirm)
//   My shifts whole-cycle list: details[data-sec="cycle"] summary, rows .agday (dn = weekday, dd = day number) after .weekhdr "Week N"
//   Round (admin): [data-status="closed"] (Close booking) → [data-status="published"] (Publish) → #cfOk
//   Notifications: #bell → sheet; close with #dsClose
//   Roster grid (laptop): table.roster, cells .cellbtn[data-s][data-d]; Day board week view [data-dm="week"]
// R1: open docs/film/inserts/r1-mock-spreadsheet.html at 1920x1080, drift with window.gridScroll(t*0.085, t*0.03) for 12 s.
// R2 (phone, Emma): hold 1.2 → tap Book shifts → scroll to 20 Oct → tap row → tap Resus chip → scroll to 19 Nov → tap row → PM → EPIC chip → .srConfirm → scroll top (receipt).
//      Prep: Emma's quota 24 (c.roles['demo-3'].quota and the staff record), one AM off 20 Oct, one PM off 19 Nov.
// R2b (phone, Emma, added 6 Oct): My shifts → details[data-sec="cycle"] summary (Whole cycle) → #vMonth → scroll the month grid → open details[data-sec="cal"] → #icsBtn (Add to calendar). Close any open notifications overlay (#ovlNotifs) first: it intercepts clicks.
// R3 (laptop, admin, Roster): snapshot c.assign; delete 60% of the other people's clinical shifts in weeks 1–3 (keep demo-0 and demo-3);
//      capture 1.7 s; restore in three groups 1.7 s apart; verify the assign map is identical; save().
// R4 (phone): Emma My shifts → Request leave or swap → Request a swap → Ask everyone → Sat 24 Oct → Ask everyone;
//      S.viewAs='demo-4' Requests → offer Thu 5 Nov → Send offer; S.viewAs='demo-3' Requests → Accept → #cfOk.
// R5 (phone): admin Requests → Approve swap (first 4.6 s); then Emma My shifts → Whole cycle → scroll to Sat 24 (Off) then Thu 5 Nov (Resus).
// R6 (laptop, admin): Day board → Week → Fairness (scroll 420 px) → Audit log (scroll 520 px).
// R7 (phone, admin): Round → Close booking → Publish → #cfOk → "Published (live)"; S.viewAs='demo-3' → #bell → the notification.
// R8 (phone, added 7 Oct): Emma Requests → #reqLeave → #lvFrom/#lvTo (set .value + input/change events) → #lvReason typed → #lvSubmit → toast; S.viewAs='admin' Requests → scroll 260 → [data-approve] (no confirm) → 'Approved'; S.viewAs='demo-3' Requests → the request reads Approved. Snapshot the state first; the leave takes her off the roster for those days.
