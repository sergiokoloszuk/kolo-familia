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
};

export default nextConfig;
