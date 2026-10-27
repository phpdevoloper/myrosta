// Myrosta engine tests — browser/Deno stand-ins so app.html's script can run under JavaScriptCore.
// Regenerate nothing by hand: `python3 tests/run.py` splices these around the CURRENT app.html.

var LOG=[]; function T(name,cond){ LOG.push((cond?"PASS":"FAIL")+"  "+name); }
function wireMyShiftsSrc(){ try{ return wire.toString(); }catch(e){ return ""; } }   // the wiring function's own source, for tests on handlers the DOM stub cannot click
var __cache={};
function _el(){ return {style:{setProperty:function(k,v){this[k]=v;},getPropertyValue:function(k){return this[k]||"";}},dataset:{},innerHTML:"",textContent:"",value:"",className:"",checked:false,
  appendChild:function(){},removeChild:function(){},querySelectorAll:function(){return [];},querySelector:function(){return null;},
  addEventListener:function(){},select:function(){},setSelectionRange:function(){},focus:function(){},blur:function(){},click:function(){},
  scrollIntoView:function(){},remove:function(){},setAttribute:function(k,v){this._a=this._a||{};this._a[k]=String(v);},getAttribute:function(k){return (this._a&&(k in this._a))?this._a[k]:null;},removeAttribute:function(k){if(this._a)delete this._a[k];},insertAdjacentHTML:function(){},parentNode:null,
  classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false;}}}; }
var document={ getElementById:function(id){ if(!__cache[id])__cache[id]=_el(); return __cache[id]; },
  querySelectorAll:function(){return [];}, querySelector:function(){return null;},
  addEventListener:function(){}, removeEventListener:function(){},
  createElement:function(){return _el();}, createTextNode:function(s){return {textContent:String(s)};}, body:_el(), documentElement:_el(),
  activeElement:null, hidden:false, visibilityState:"visible", title:"" };
var _lsStore={};
var localStorage={ getItem:function(k){return _lsStore[k]===undefined?null:_lsStore[k];}, setItem:function(k,v){_lsStore[k]=String(v);}, removeItem:function(k){delete _lsStore[k];} };
var sessionStorage=localStorage;
var navigator={ userAgent:"testagent", standalone:false };
var location={ protocol:"https:", search:"", href:"https://test/app.html", hash:"", pathname:"/app.html", origin:"https://test", reload:function(){} };
var history={ replaceState:function(){} };
var window=this; window.navigator=navigator; window.location=location;
window.matchMedia=function(){return {matches:false,addListener:function(){},addEventListener:function(){}};};
var matchMedia=window.matchMedia;
window.addEventListener=function(){};
function _sbStub(){
  var chain={ maybeSingle:function(){return Promise.resolve({data:null});} };
  chain.eq=function(){return chain;}; chain.select=function(){return chain;}; chain.gt=function(){return chain;}; chain.order=function(){return chain;}; chain.limit=function(){return chain;};
  return {
    auth:{ getSession:function(){return Promise.resolve({data:{}});},
           onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}};},
           getUser:function(){return Promise.resolve({data:{}});},
           signOut:function(){return Promise.resolve({});},
           signInWithOtp:function(){return Promise.resolve({});},
           verifyOtp:function(){return Promise.resolve({});} },
    from:function(){ return chain; },
    rpc:function(){ return Promise.resolve({data:[],error:null}); },
    channel:function(){ return { on:function(){ return { subscribe:function(){} }; } }; }
  };
}
window.supabase={ createClient:_sbStub };
var crypto={ getRandomValues:function(a){ for(var i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256); return a; }, randomUUID:function(){return "u"+Math.random();} };
var alert=function(){}; var confirm=function(){return true;};
var setInterval=function(){return 0;}; var setTimeout=function(f){return 0;}; var clearTimeout=function(){}; var clearInterval=function(){};
var fetch=function(){ return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); };
var Notification={ requestPermission:function(){ return Promise.resolve("granted"); }, permission:"default" };
var Blob=function(){}; var URL={ createObjectURL:function(){return "blob:x";}, revokeObjectURL:function(){} };
var IntersectionObserver=function(){ return {observe:function(){},unobserve:function(){}}; };
var atob=function(b64){ var chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str=String(b64).replace(/=+$/,""), out="", bc=0, bs=0, buffer, i=0;
  while((buffer=str.charAt(i++))){ buffer=chars.indexOf(buffer); if(buffer===-1)continue;
    bs=bc%4?bs*64+buffer:buffer; if(bc++%4)out+=String.fromCharCode(255&bs>>(-2*bc&6)); }
  return out; };
var Uint8Array_from=Uint8Array.from;
