// Service worker do Café, Graça & Fralda: faz o site abrir como app e funcionar sem internet.
// Gerado por _src/build.py; a versão muda a cada publicação para os celulares baixarem a novidade.
const CACHE = "cgf-45317d1ddc";
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "img/familia-1.jpg",
  "img/pai-e-filhos.jpg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon-32.png"
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Página: busca a versão nova primeiro; sem internet, abre a última salva.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Fotos, ícones e fontes: usa o que já está salvo e atualiza em segundo plano.
  if (url.origin === self.location.origin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
  // Demais endereços (WhatsApp, Supabase, Google) seguem direto para a internet.
});
