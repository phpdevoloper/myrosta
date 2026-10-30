"use strict";
/* The device side of clocking: the phone's location, random poster keys, the poster's link, and reading a scanned link. */
function clockLocate(cb){   // one answer, once: the phone's position, or null when it refuses, times out or has no location at all
  const g=(typeof navigator!=="undefined")&&navigator.geolocation; if(!g||!g.getCurrentPosition){ cb(null); return; } let done=false; const fin=v=>{ if(done)return; done=true; cb(v); };
  try{ g.getCurrentPosition(p=>fin({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}),()=>fin(null),{enableHighAccuracy:true,timeout:10000,maximumAge:0}); }catch(e){ fin(null); } setTimeout(()=>fin(null),11000); }
function clockNewKey(){ const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b=new Uint8Array(16); crypto.getRandomValues(b); let k=""; for(let i=0;i<16;i++)k+=A[b[i]%32]; return k; }
function clockPosterLink(key){ return location.origin+location.pathname.replace(/[^\/]*$/,"")+"app.html?org="+encodeURIComponent(_org)+"&clock="+encodeURIComponent(key||""); }
function clockReadURL(){ const q=String(location.search||""), m=/[?&]clock=([^&#]+)/.exec(q); if(!m)return null; const om=/[?&]org=([^&#]+)/.exec(q); let token="", org=""; try{ token=decodeURIComponent(m[1]); org=om?decodeURIComponent(om[1]):""; }catch(e){ return null; }
  const pending={org:org,token:token}; try{ sessionStorage.setItem("myrosta_clock",JSON.stringify(pending)); if(org)localStorage.setItem("myrosta_org",org); }catch(e){}   // the scan waits for the sign-in, and names the group the poster belongs to
  try{ history.replaceState(null,"",location.pathname); }catch(e){} return pending; }   // a refresh never taps again
