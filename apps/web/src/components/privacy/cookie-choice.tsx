"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { UtmCapture } from "@/components/tracking/utm-capture";

const COOKIE = "kolo_cookie_choice";
const GTM_ID = "GTM-PR4NGFW2";
type Escolha = "aceitos" | "recusados" | null;
const EVENTO_ESCOLHA = "kolo-cookie-choice";

function lerEscolha(): Escolha {
  if (typeof document === "undefined") return null;
  const valor = document.cookie.split("; ").find((item) => item.startsWith(`${COOKIE}=`))
    ?.split("=")[1];
  return valor === "aceitos" || valor === "recusados" ? valor : null;
}

function observarEscolha(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENTO_ESCOLHA, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENTO_ESCOLHA, onChange);
  };
}

export function CookieChoice({ carregarAnalise = false }: { carregarAnalise?: boolean }) {
  const escolha = useSyncExternalStore(observarEscolha, lerEscolha, () => null);

  function salvar(valor: Exclude<Escolha, null>) {
    document.cookie = `${COOKIE}=${valor}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
    window.dispatchEvent(new Event(EVENTO_ESCOLHA));
  }

  return (
    <>
      {carregarAnalise && escolha === "aceitos" ? (
        <>
          <UtmCapture />
          <Script id="gtm-base-consentido" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        </>
      ) : null}

      {escolha === null ? (
        <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border bg-white p-5 shadow-2xl" aria-label="Escolha de cookies">
          <p className="font-semibold text-foreground">Você aceita cookies opcionais?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Os essenciais mantêm login e segurança. Os opcionais medem cadastro e ajudam a melhorar a experiência. Você pode aceitar ou recusar; o app funciona nos dois casos. Veja a <Link href="/cookies" className="underline">Política de Cookies</Link>.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => salvar("recusados")} className="rounded-full border border-brand-purple px-4 py-2 font-semibold text-brand-purple">
              Recusar opcionais
            </button>
            <button type="button" onClick={() => salvar("aceitos")} className="rounded-full border border-brand-purple bg-brand-purple px-4 py-2 font-semibold text-white">
              Aceitar opcionais
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
