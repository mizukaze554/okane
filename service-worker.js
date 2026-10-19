const CACHE_NAME = "okane-v5";
const ASSETS = ["./","./index.html","./styles.css","./src/app.js","./src/storage.js","./src/finance.js","./manifest.json","./icon.svg","./icon-192.svg","./icon-512.svg"];
self.addEventListener("install", event => {
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", event => {
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("okane-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", event => {
 const request=event.request;
 if(request.method!=="GET"||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  try{
   const response=await fetch(request);
   if(response.ok)cache.put(request,response.clone()).catch(()=>{});
   return response;
  }catch{
   return cached || (request.mode==="navigate"?await cache.match("./index.html"):Response.error());
  }
 })());
});