/* Myrosta push service worker — notifications only, deliberately NO caching:
   the app must always load fresh from the network (deploys land instantly). */
self.addEventListener("install", function (e) { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (e) {
  var d = { title: "Myrosta", body: "Roster update", tag: "" };
  try {
    if (e.data) { var j = e.data.json(); d.title = j.title || d.title; d.body = j.body || d.body; d.tag = j.tag || ""; }
  } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    tag: d.tag || undefined,
    icon: "img/icon-192.png",
    badge: "img/icon-192.png",
    data: { url: "./app.html" }
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url && c.url.indexOf("app.html") >= 0 && "focus" in c) return c.focus();
    }
    return self.clients.openWindow("./app.html");
  }));
});
