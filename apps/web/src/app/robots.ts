import type { MetadataRoute } from "next";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://kolofamilia.com.br"
  );
}

export default function robots(): MetadataRoute.Robots {
  const base = baseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/precos", "/sobre", "/contato", "/privacidade", "/termos", "/cookies"],
        disallow: [
          "/painel",
          "/registrar",
          "/conversar",
          "/apoio",
          "/aprender",
          "/galeria",
          "/kolo-vivo",
          "/relatorios",
          "/configuracoes",
          "/assinatura",
          "/admin",
          "/onboarding",
          "/api",
          "/auth",
          "/r",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
