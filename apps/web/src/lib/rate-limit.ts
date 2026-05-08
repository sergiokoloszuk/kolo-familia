/**
 * Rate limit em memória do processo. Bom o suficiente pra abuso casual
 * em endpoints públicos. Em produção multi-instância (escala horizontal),
 * trocar por Redis/Upstash.
 *
 * Estratégia: token bucket simples.
 *   - capacidade: máx requisições no burst
 *   - refilPorMinuto: quantos tokens repõem por minuto
 *
 * Cada chave (IP, ou IP+email) tem seu bucket. Garbage collected quando
 * map cresce demais.
 */

import type { NextRequest } from "next/server";

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const BUCKETS = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitConfig = {
  capacidade: number;
  refilPorMinuto: number;
};

export type RateLimitResult = {
  ok: boolean;
  restantes: number;
  retry_after_s?: number;
};

export function checkRateLimit(
  chave: string,
  cfg: RateLimitConfig,
): RateLimitResult {
  const agora = Date.now();
  let bucket = BUCKETS.get(chave);

  if (!bucket) {
    bucket = { tokens: cfg.capacidade, lastRefill: agora };
    BUCKETS.set(chave, bucket);
    if (BUCKETS.size > MAX_BUCKETS) gc(agora);
  } else {
    const minutos = (agora - bucket.lastRefill) / 60_000;
    if (minutos > 0) {
      bucket.tokens = Math.min(
        cfg.capacidade,
        bucket.tokens + minutos * cfg.refilPorMinuto,
      );
      bucket.lastRefill = agora;
    }
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { ok: true, restantes: Math.floor(bucket.tokens) };
  }

  // Calcula quanto tempo até voltar 1 token
  const segundosParaUm = Math.ceil((60 / cfg.refilPorMinuto) * (1 - bucket.tokens));
  return { ok: false, restantes: 0, retry_after_s: segundosParaUm };
}

function gc(agora: number) {
  // Remove buckets cheios e antigos (>10min sem refill)
  const dezMin = 10 * 60_000;
  for (const [k, b] of BUCKETS) {
    if (agora - b.lastRefill > dezMin) BUCKETS.delete(k);
  }
}

/**
 * Identificador da requisição: IP do x-forwarded-for ou x-real-ip.
 */
export function clientKey(request: NextRequest, prefix: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return `${prefix}:${ip}`;
}
