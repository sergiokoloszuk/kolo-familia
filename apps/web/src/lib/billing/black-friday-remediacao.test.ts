import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("migração de bloqueio do checkout Black Friday 2026", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "../../supabase/migrations/0100_bloquear_checkout_duplicado_bf2026.sql",
    ),
    "utf8",
  );

  it("não reabre checkout concluído", () => {
    expect(migration).toMatch(/checkout_concluido_em\s+is\s+null/i);
  });

  it("não libera checkout quando já existe assinatura", () => {
    expect(migration).toMatch(/stripe_subscription_id\s+is\s+not\s+null/i);
    expect(migration).toMatch(/s\.status\s*=\s*'active'/i);
  });

  it("não confunde assinatura antiga cancelada com assinatura existente", () => {
    expect(migration).toMatch(/s\.status\s*<>\s*'canceled'/i);
  });
});
