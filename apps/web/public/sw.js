// Kolo Família — service worker minimalista.
// Estratégia:
//  - Network-first para HTML (sempre tenta rede; cache só pra fallback offline).
//  - Cache-first para assets versionados do /_next/static (imutáveis).
//  - Bypass total pra POST/PUT/DELETE/PATCH — nunca mexer em mutação.
//  - Bypass total pra /api/* e /auth/* — sempre online.
//
// PRD §13.5: PWA é "casca offline" + instalação. Não caching agressivo
// de dados sensíveis (Kolo Vivo, diários) — esses sempre online.

const VERSION = "kolo-v1";
const SHELL_CACHE = `shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const SHELL_FILES = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_FILES)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, STATIC_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Mesma origem apenas
  if (url.origin !== self.location.origin) return;

  // Bypass total
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (url.pathname.startsWith("/r/")) return; // links vivos públicos

  // Cache-first para assets imutáveis do Next
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Fontes/imagens estáticas
  if (
    /\.(?:woff2?|ttf|otf|svg|png|jpg|jpeg|gif|webp|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // HTML/navegação: network-first com fallback offline
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstWithOfflineFallback(req));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (e) {
    return new Response("offline", { status: 503 });
  }
}

async function networkFirstWithOfflineFallback(req) {
  try {
    const resp = await fetch(req);
    return resp;
  } catch (e) {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response("Sem conexão. Volte online pra usar o Kolo Família.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }
}
