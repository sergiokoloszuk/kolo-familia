import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FLAG_PILOTO, pilotoEstrategiasLigado } from "./piloto";

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

afterEach(() => {
  delete process.env[FLAG_PILOTO];
});

describe("a flag", () => {
  it("1. ausente = desligado — o padrão nunca é ligar", () => {
    delete process.env[FLAG_PILOTO];
    expect(pilotoEstrategiasLigado()).toBe(false);
  });

  it("2. só '1' liga; qualquer outra coisa não", () => {
    for (const v of ["", "0", "true", "sim", "on", "ativo"]) {
      process.env[FLAG_PILOTO] = v;
      expect(pilotoEstrategiasLigado(), `"${v}" não deveria ligar`).toBe(false);
    }
    process.env[FLAG_PILOTO] = "1";
    expect(pilotoEstrategiasLigado()).toBe(true);
  });
});

describe("FASE 4A.1 · as três leituras estão atrás da flag", () => {
  const contexto = src("ia/context.ts");

  it("3. o piloto exige flag E relato — sem texto não há o que ranquear", () => {
    expect(contexto).toMatch(
      /const piloto =\s*pilotoEstrategiasLigado\(\) && Boolean\(params\.relato\?\.trim\(\)\)/,
    );
  });

  it("4. MORDE: as três leituras não podem rodar fora do piloto", () => {
    // Se alguém tirar a guarda de qualquer uma delas, o WhatsApp e o resto da
    // web passam a receber contexto que ninguém mediu.
    expect(contexto).toMatch(/relato: piloto \? params\.relato : undefined/);
    expect(contexto).toMatch(/const base2 =\s*\n?\s*piloto &&/);
    expect(contexto).toMatch(/const perfilConsultavel =\s*\n?\s*piloto &&/);
  });

  it("5. MORDE: o ranking entra ANTES do corte — depois não escolheria nada", () => {
    const rec = src("conhecimento/recuperar.ts");
    const iRank = rec.indexOf("ordenarPorAderencia(");
    const iCorte = rec.indexOf("finais.slice(0, p.limite");
    expect(iRank).toBeGreaterThan(-1);
    expect(iCorte).toBeGreaterThan(iRank);
  });

  it("6. MORDE: sem `relato`, `recuperarBoasPraticas` se comporta como antes", () => {
    const rec = src("conhecimento/recuperar.ts");
    // O ternário é o que garante o byte-a-byte para o WhatsApp.
    expect(rec).toMatch(/const finais = p\.relato\?\.trim\(\)\s*\n?\s*\?/);
    expect(rec).toMatch(/:\s*ordenadas;/);
  });
});

describe("o WhatsApp não mudou", () => {
  it("7. MORDE: nenhum caminho do WhatsApp passa `relato`", () => {
    // `orchestrator.ts` e `responder.ts` chamam `recuperarBoasPraticas` direto.
    // Se um deles passar `relato`, o ranking liga no WhatsApp sem medição.
    for (const f of ["ayla/orchestrator.ts", "ayla/responder.ts"]) {
      const t = src(f);
      const chamadas = t.split("recuperarBoasPraticas(").slice(1);
      for (const c of chamadas) {
        const args = c.slice(0, c.indexOf("})"));
        expect(args, `${f} passou relato para recuperarBoasPraticas`).not.toMatch(/\brelato\s*:/);
      }
    }
  });

  it("8. MORDE: o WhatsApp não passa por buildContext", () => {
    for (const f of ["ayla/orchestrator.ts", "ayla/responder.ts"]) {
      expect(src(f), `${f} passou a usar buildContext`).not.toMatch(/buildContext\(/);
    }
  });
});

describe("o que a 4A.1 NÃO liga", () => {
  it("9. a âncora e a licença entraram na 4A.2 — e só no prompt", () => {
    // Este teste guardava a AUSÊNCIA na 4A.1, para que a medição de "o que muda
    // só porque a Ayla enxerga melhor" fosse separável. A 4A.1 foi medida, e
    // agora ele guarda o oposto: as duas peças existem, e existem no prompt.
    expect(src("ia/prompt.ts")).toMatch(/conducao\/composicao/);
    expect(src("ia/prompt.ts")).toMatch(/ANCORA_PERFIL/);
    expect(src("ia/prompt.ts")).toMatch(/LICENCA_GENERATIVA/);
  });

  it("9b. MORDE: a licença só entra se houver material sobre o que operar", () => {
    // Sem perfil, sem BASE 2 e sem repertório, a licença sozinha só aumenta a
    // invenção — foi exatamente o que a bancada pegou.
    expect(src("ia/prompt.ts")).toMatch(
      /if \(ctx\.perfilConsultavel \|\| ctx\.base2\.length \|\| ctx\.boasPraticas\.length\)/,
    );
  });

  it("9c. MORDE: nada disto pode vazar para o núcleo compartilhado", () => {
    expect(src("conducao/diretrizes.ts")).not.toMatch(/LASTRO, NÃO TEXTO PARA COPIAR/);
    expect(src("conducao/diretrizes.ts")).not.toMatch(/O PERFIL É ÂNCORA/);
  });

  it("10. MORDE: nenhum caminho de produto ativa os 10 rascunhos", () => {
    const rec = src("conhecimento/recuperar.ts");
    expect(rec).toMatch(/p\.statusAceitos \?\? \["ativo"\]/);
    // FASE 4A.3 · a web passa `statusAceitos` — mas SÓ dentro do piloto, e os
    // registros continuam em `rascunho` no banco. Nenhum caminho de produção
    // publica nada; desligar a flag basta para eles sumirem.
    expect(src("ia/context.ts")).toMatch(
      /statusAceitos: piloto \? \["ativo", "rascunho"\] : undefined/,
    );
    // O WhatsApp continua sem passar nada.
    for (const f of ["ayla/orchestrator.ts", "ayla/responder.ts"]) {
      expect(src(f), `${f} passou statusAceitos`).not.toMatch(/statusAceitos/);
    }
  });
});

describe("o bloco do perfil", () => {
  const prompt = src("ia/prompt.ts");

  it("11. distingue vazio de NEGATIVO — é a distinção que evita repergunta", () => {
    expect(prompt).toMatch(/NÃO se aplica:/);
    expect(prompt).toMatch(/ainda não sabemos:/);
    expect(prompt).toMatch(/NÃO pergunte o que está em "sabemos"/);
  });

  it("12. a BASE 2 entra marcada como material interno, não como resposta", () => {
    expect(prompt).toMatch(/Material INTERNO de raciocínio/);
    expect(prompt).toMatch(/transforme as bifurcações em questionário/);
    expect(prompt).toMatch(/faça no máximo UMA pergunta/);
  });
});
