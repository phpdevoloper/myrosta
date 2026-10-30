"use strict";
/* Group switches that are not clocking's but lived beside it: instant booking. */
function instantBookOn(){ return S.instantBook!==false; }   // the group switch (9 Oct 2026): a tap books the shift at once — first tap wins, no basket. Since 12 Oct 2026 absent means ON (the owner's call: the basket doubled the process); an admin who wants the basket switches it off, stored as false
function instantBookSwitch(on){ if(on)delete S.instantBook; else S.instantBook=false; logAudit("settings.instantBook",on?"on":"off","admin"); save(); }   // on is the default, so on clears the key
