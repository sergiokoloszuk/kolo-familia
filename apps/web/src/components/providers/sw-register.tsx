"use client";

import { useEffect } from "react";

/**
 * Registra o service worker em /sw.js. Skipa em dev pra não confundir
 * caches durante hot-reload.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Best-effort: PWA é progressivo, falha de registro não é fatal
        });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  return null;
}
