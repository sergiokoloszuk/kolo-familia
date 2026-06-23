import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

// GTM só nas telas de cadastro/login (funil) — NÃO nas telas internas do app,
// que mostram dado de saúde de criança (LGPD). Atende o tracking de conversão
// da agência sem expor as páginas privadas. Container fornecido pela agência.
const GTM_ID = "GTM-PR4NGFW2";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Script id="gtm-base" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="gtm"
        />
      </noscript>
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
          <Link href="/" aria-label="Kolo Família — início">
            <Logo tone="light" size={24} />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}
