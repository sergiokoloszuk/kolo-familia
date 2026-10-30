import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function ler(caminho: string) {
  return readFileSync(resolve(process.cwd(), caminho), "utf8");
}

describe("governança da Black Friday 2026", () => {
  it("chega desligada e exige prova de backup para ativar", () => {
    const sql = ler("../../supabase/migrations/0096_black_friday_2026.sql");
    expect(sql).toContain("'black_friday_2026_estado', 'desligada'");
    expect(sql).toContain("BF2026_BACKUP_RESTAURADO_NAO_PROVADO");
    expect(sql).toContain("if v_admin is null or not public.is_admin()");
  });

  it("não autoriza marketing pela simples ausência de recusa", () => {
    const signup = ler("src/app/(auth)/signup/page.tsx");
    const envio = ler("src/lib/ayla/orchestrator.ts");
    expect(signup).toContain("aceito_marketing");
    expect(signup).toContain("Essa escolha é opcional");
    expect(envio).toContain("marketing_consentido_em");
    expect(envio).toContain("Sem consentimento para novidades e promoções");
  });

  it("rotinas destrutivas nascem em simulação e exigem segredo", () => {
    const retencao = ler("src/app/api/cron/retencao-contas/route.ts");
    expect(retencao).toContain('process.env.ACCOUNT_DELETE_ENABLED === "true"');
    expect(retencao).toContain('process.env.BF2026_RETENTION_DELETE_ENABLED === "true"');
    expect(retencao).toContain("CRON_SECRET não configurado");
    expect(retencao).toContain("dry_run");
  });
});
