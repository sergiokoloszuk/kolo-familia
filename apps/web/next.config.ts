import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Aponta o root para a raiz do monorepo, evitando warning de
    // múltiplos lockfiles detectados em workspaces npm.
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default nextConfig;
