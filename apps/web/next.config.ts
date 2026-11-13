import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Aponta o root para a raiz do monorepo, evitando warning de
    // múltiplos lockfiles detectados em workspaces npm.
    root: path.resolve(__dirname, "..", ".."),
  },
  // Server Actions têm limite de body padrão de 1MB — pequeno demais pra fotos
  // de desenho (e imagens coladas, que costumam ser PNGs grandes). Sobe pra 12MB
  // (mesmo teto que a action enviarDesenho valida).
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // Não anunciar a stack em toda resposta (`X-Powered-By: Next.js`).
  poweredByHeader: false,
  // Cabeçalhos de segurança (auditoria de 12/11/2026: em produção só havia
  // HSTS). Nada aqui restringe script, estilo ou imagem — a CSP abaixo só
  // proíbe o app de ser aberto dentro de iframe de outro site (clickjacking).
  // Conferido: o site do Base44 não embute o app; os iframes do app são de
  // vídeo (YouTube) e não são afetados. Nenhuma tela usa câmera, microfone ou
  // localização pelo navegador.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Áreas internas e links com token: fora de buscador mesmo que alguém
        // publique o endereço; nos links com token, o endereço não vaza como
        // Referer.
        source: "/:area(admin|dashboards)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:area(fiscal|r)/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
