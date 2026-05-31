// V12 intentionally does not cache the app. Old service workers are unregistered by app.js.
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => { event.waitUntil(self.registration.unregister().then(()=>self.clients.claim())); });
