import type { MetadataRoute } from "next";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://kolofamilia.com.br"
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const now = new Date();
  const rotas: Array<{
    path: string;
    changeFrequency: "yearly" | "monthly" | "weekly";
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/precos", changeFrequency: "monthly", priority: 0.9 },
    { path: "/sobre", changeFrequency: "monthly", priority: 0.7 },
    { path: "/contato", changeFrequency: "monthly", priority: 0.6 },
    { path: "/privacidade", changeFrequency: "yearly", priority: 0.4 },
    { path: "/termos", changeFrequency: "yearly", priority: 0.4 },
    { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
  ];

  return rotas.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
