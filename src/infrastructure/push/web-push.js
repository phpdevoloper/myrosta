"use strict";
// moved from js/roster.js lines 1253-1293 (Phase 1 split, no edits)
/* ----- web push (phones hear about open shifts even with the app closed) ----- */
let _osPushQueue=null;
function _osFlushPush(){ const q=_osPushQueue; _osPushQueue=null; if(!q||!S.pushOn||!cloudOn()||!CLOUD.vapidPublic)return;
  if(Array.isArray(q.targets)&&!q.targets.length)return;   // an empty audience is nobody; only null means the whole group
  try{ pushSendEvent(q.title,q.body,q.targets,"os-"+q.type+"-"+q.osId); }catch(e){} }
function _pushDeviceKey(){ try{ let k=localStorage.getItem(KEY+"_pushdev"); if(!k){k="d"+Date.now()+Math.random().toString(36).slice(2,8);localStorage.setItem(KEY+"_pushdev",k);} return k; }catch(e){ return "d0"; } }
function myPushSub(){ const sid=S.viewAs; const dk=_pushDeviceKey(); return (S.pushSubs||[]).find(p=>p.staffId===sid&&p.deviceKey===dk); }
function _b64ToU8(b64){ const pad="=".repeat((4-b64.length%4)%4); const raw=atob((b64+pad).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
async function pushEnable(){
  if(!(S.pushOn&&cloudOn()&&CLOUD.vapidPublic)){ toast("Push isn't switched on for this organisation yet."); return; }
  if(!("serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window)){ toast("This browser can't do notifications."); return; }
  const iosNotInstalled=iosNeedsInstall();
  if(iosNotInstalled){ toast("First add Myrosta to your Home Screen (Share \u2192 Add to Home Screen), then open it from the icon and tap this again."); return; }
  const perm=await Notification.requestPermission(); if(perm!=="granted"){ toast("Notifications are blocked for this site."); return; }
  let reg=null; try{ reg=await navigator.serviceWorker.register("sw.js"); }catch(e){ console.error("sw",e); }
  if(!reg){ toast("Couldn't set up notifications."); return; }
  try{ const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:_b64ToU8(CLOUD.vapidPublic)});
    const j=sub.toJSON(), sid=S.viewAs, dk=_pushDeviceKey();
    commitGuarded(()=>{ S.pushSubs=(S.pushSubs||[]).filter(p=>!(p.staffId===sid&&p.deviceKey===dk));
      S.pushSubs.unshift({id:"ps-"+dk+"-"+sid,staffId:sid,deviceKey:dk,sub:j,ua:(navigator.userAgent||"").slice(0,80),ts:Date.now()});
      logAudit("push.on",nameOf(sid)+" enabled phone alerts",sid); return {ok:true}; });
    toast("Alerts on \u2014 this phone will now hear about open shifts.","ok");
  }catch(e){ console.error(e); toast("Couldn't subscribe this device."); }
}
async function pushDisable(){
  try{ const reg=await navigator.serviceWorker.getRegistration("sw.js"); const sub=reg&&await reg.pushManager.getSubscription(); if(sub)await sub.unsubscribe(); }catch(e){}
  const sid=S.viewAs, dk=_pushDeviceKey();
  commitGuarded(()=>{ S.pushSubs=(S.pushSubs||[]).filter(p=>!(p.staffId===sid&&p.deviceKey===dk));
    logAudit("push.off",nameOf(sid)+" disabled phone alerts",sid); return {ok:true}; });
}
async function pushSendEvent(title,body,targets,tag){
  if(Array.isArray(targets)&&!targets.length)return;   // nobody to tell: push-send would read a missing audience as every phone in the group
  try{ const {data}=await _sb.auth.getSession(); const tok=data&&data.session&&data.session.access_token; if(!tok)return;
    fetch(CLOUD.url+"/functions/v1/push-send",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":CLOUD.key},
      body:JSON.stringify({org:_org,title:title,body:body,targets:Array.isArray(targets)?targets:null,tag:tag,exclude:S.viewAs})}).catch(()=>{});
  }catch(e){}
}
function whoseTurn(){const d=active().draft;if(!d)return null;return draftOrder()[d.turnIdx]||null;}
function advanceTurn(){const d=active().draft;if(!d)return;d.turnIdx++;if(d.turnIdx>=d.base.length){d.round++;d.turnIdx=0;}save();}
function stopRounds(){active().draft=null;save();}

