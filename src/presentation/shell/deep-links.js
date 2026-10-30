"use strict";
/* ?go=help from the landing page: remembered through the sign-in, then opens Help at the videos. */
function goReadURL(){ const m=/[?&]go=(help)\b/.exec(String(location.search||"")); if(!m)return null;   // the landing page's "Every chapter" link (12 Oct 2026): ?go=help waits for the sign-in, then opens Help at the videos
  try{ sessionStorage.setItem("myrosta_go",m[1]); }catch(e){} try{ history.replaceState(null,"",location.pathname); }catch(e){} return m[1]; }
function goApplyURL(){ let g=null; try{ g=sessionStorage.getItem("myrosta_go"); sessionStorage.removeItem("myrosta_go"); }catch(e){} if(g!=="help")return null;
  S.tab="help"; _moreOpen=false; save(); render(); setTimeout(()=>{ const h=document.getElementById("videos"); if(h&&h.scrollIntoView)h.scrollIntoView({block:"start"}); },60); return g; }
