"use strict";
/* Composition root for clocking: the ports the use cases call, filled from infrastructure and presentation. Each is a thin
   lambda, so a test (or a later module) that replaces save, render or toast is still the one called. Loaded before main.js. */
Object.assign(clockingPorts,{
  save:()=>save(), render:()=>render(), toast:(msg,type)=>toast(msg,type),
  locate:cb=>clockLocate(cb), newKey:()=>clockNewKey(),
  commit:(mutate,busyKey)=>commitGuarded(mutate,busyKey), shiftLabel:sh=>shiftLabel(sh),
  download:(content,filename,mime)=>download(content,filename,mime) });
