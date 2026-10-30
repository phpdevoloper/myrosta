// Loaded only when tests/run.py runs the suite under Node (no osascript). The suite and tests/oncall-golden.js were written
// against JavaScriptCore on macOS, whose en-GB data writes "Sep" and "Fri 30 Oct". Node 16's newer CLDR writes "Sept" and
// "Fri, 30 Oct". This shim maps Node's date strings back to that reference so the same assertions hold on Windows and Linux.
// It changes nothing in the app: browsers keep their own locale data (30 Oct 2026).
(function(){
  function ref(s){ return String(s).replace(/\bSept\b/g, "Sep").replace(/^([A-Z][a-z]+), (?=\d)/, "$1 "); }
  var P = Date.prototype, d = P.toLocaleDateString, a = P.toLocaleString;
  P.toLocaleDateString = function(){ return ref(d.apply(this, arguments)); };
  P.toLocaleString = function(){ return ref(a.apply(this, arguments)); };
})();
