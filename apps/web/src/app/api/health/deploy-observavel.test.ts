import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "PUBLICADO" E "DEPLOYADO" SÃO ESTADOS DIFERENTES — e até 17/08/2026 não havia
 * como distinguir os dois de fora da Vercel.
 *
 * O custo real disso já foi medido neste repositório: a PEND-071 (P0,
 * segurança abaixo do gate de assinatura) ficou marcada como "CORRIGIDA, NÃO
 * PUBLICADA" enquanto o commit `0fc1feb` já era ancestral de `origin/main` há
 * semanas, mergeado pelo PR #98. A auditoria dependia de memória, não de
 * medição — e a memória errou.
 *
 * `/api/health` agora responde QUAL commit está servindo. Este teste existe
 * para que ninguém remova esse campo achando que é enfeite.
 */

const ROTA = readFileSync(
  join(process.cwd(), "src/app/api/health/route.ts"),
  "utf8",
);

describe("O HEALTH DIZ QUAL COMMIT ESTÁ NO AR", () => {
  it("expõe o SHA do commit que a Vercel está servindo", () => {
    expect(ROTA).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(ROTA).toContain("commit:");
  });

  it("expõe também o branch e o ambiente — um SHA sozinho não diz de onde veio", () => {
    expect(ROTA).toContain("VERCEL_GIT_COMMIT_REF");
    expect(ROTA).toContain("VERCEL_ENV");
  });

  it("`deploy` vai no corpo da resposta, não só é calculado", () => {
    const retorno = ROTA.slice(ROTA.indexOf("return NextResponse.json("));
    expect(retorno).toContain("deploy,");
  });

  it("ausência das variáveis vira `null`, e não quebra o health", () => {
    // Fora da Vercel (local, CI) as três não existem. O health precisa
    // continuar respondendo — ele é o smoke test pós-deploy.
    expect(ROTA).toMatch(/VERCEL_GIT_COMMIT_SHA\s*\?\?\s*null/);
    expect(ROTA).toMatch(/VERCEL_GIT_COMMIT_REF\s*\?\?\s*null/);
    expect(ROTA).toMatch(/VERCEL_ENV\s*\?\?\s*null/);
  });

  it("NÃO vaza segredo — o bloco novo só carrega dado público", () => {
    const bloco = ROTA.slice(ROTA.indexOf("const deploy = {"), ROTA.indexOf("return NextResponse.json("));
    // SHA e nome de branch são públicos no repositório. Chave, token e senha
    // não podem aparecer aqui de forma nenhuma.
    expect(bloco).not.toMatch(/KEY|SECRET|TOKEN|PASSWORD|SERVICE_ROLE/i);
  });

  it("SABOTAGEM · remover o campo seria pego", () => {
    const sabotado = ROTA.replace("deploy,", "");
    expect(sabotado).not.toContain("deploy,");
    expect(ROTA).toContain("deploy,");
  });
});
