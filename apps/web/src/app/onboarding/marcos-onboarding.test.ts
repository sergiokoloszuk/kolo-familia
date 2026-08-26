import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * OS MARCOS DO ONBOARDING — 26/08/2026.
 *
 * ⚠️ O QUE ESTES TESTES PROTEGEM, e por que eles existem.
 *
 * MEDI em produção: das 57 contas criadas desde 29/07 (quando o rascunho entrou
 * no ar, `518751c`) que não concluíram, **53 não têm rascunho nenhum** — e 51
 * delas estão em `onboarding_step = 1`. Como `rascunhar()` só dispara ao
 * AVANÇAR de uma pergunta, "sem rascunho" significa "nunca avançou da
 * primeira". Mas esse silêncio confunde três coisas diferentes: abriu e saiu,
 * respondeu e fechou antes de gravar, ou a tela nem abriu.
 *
 * Sem separá-las, qualquer conclusão sobre a causa é palpite — e a hipótese
 * mais citada (o WhatsApp) está na pergunta **8 de 13**, sete perguntas depois.
 *
 * Estes testes leem o próprio fonte. Prendem uma decisão estrutural (§12): que
 * os marcos existam, que não usem `unload`, e que não carreguem PII.
 */
const TELA = fs.readFileSync(
  path.join(__dirname, "conversacional.tsx"),
  "utf8",
);

describe("os marcos que faltavam", () => {
  it("1. a tela vista é registrada — é o denominador do funil", () => {
    expect(TELA).toMatch(/marco\("onboarding_passo_1_visualizado"/);
  });

  it("2. chegar ao campo de WhatsApp é registrado — a pergunta 8 de 13", () => {
    expect(TELA).toMatch(/marco\("campo_whatsapp_visualizado"/);
  });

  it("3. avançar é registrado, com o passo — separa 'abriu e saiu' de 'respondeu e saiu'", () => {
    expect(TELA).toMatch(/marco\("avancar_clicado", \{ idx, passo/);
  });

  it("4. preencher o WhatsApp e concluir o onboarding fecham a conta", () => {
    expect(TELA).toMatch(/marco\("whatsapp_preenchido"\)/);
    expect(TELA).toMatch(/marco\("onboarding_concluido"\)/);
  });

  it("5. MORDE: NADA de `unload` — evento de saída mede o navegador, não a pessoa", () => {
    // O abandono se infere DEPOIS, pela ausência de progressão. Um listener de
    // saída daria um número que parece medição e não é.
    expect(TELA).not.toMatch(/beforeunload|onunload|visibilitychange|pagehide/);
  });

  it("6. MORDE: nenhum marco carrega conteúdo sensível", () => {
    const chamadas = [...TELA.matchAll(/marco\((.*?)\);/g)].map((m) => m[1]);
    expect(chamadas.length).toBeGreaterThanOrEqual(5);
    for (const c of chamadas) {
      // nem o nome da criança, nem o telefone, nem a resposta digitada
      expect(c).not.toMatch(/answers|merged|nome|telefone|whatsPendente|texto\b/);
    }
  });

  it("7. MORDE: telemetria nunca segura o cadastro", () => {
    const i = TELA.indexOf("function marco(");
    const corpo = TELA.slice(i, TELA.indexOf("\n}", i));
    // fire-and-forget, com catch, e sem `await`
    expect(corpo).toMatch(/void fetch\("\/api\/track"/);
    expect(corpo).toMatch(/\.catch\(/);
    expect(corpo).not.toMatch(/await /);
  });

  it("8. MORDE: reusa /api/track — nenhuma rota nem tabela nova", () => {
    // A rota já existia e carimba a família pela sessão (o cliente não manda
    // id). Criar outra abriria uma segunda porta para o mesmo dado.
    expect(TELA).toMatch(/"\/api\/track"/);
    expect(TELA).not.toMatch(/"\/api\/track-onboarding|\/api\/eventos-onboarding/);
  });
});
