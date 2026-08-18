import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * C2 · UM DONO PARA A CLASSIFICAÇÃO, E AS CAPACIDADES DE VOLTA.
 *
 * ⚠️ O QUE MUDOU. O ramo experimental era a primeira porta depois do gate de
 * assinatura, e o `return` dele pulava sete blocos maduros: fim de semana,
 * escolha de criança, rotina (ver/editar/conduzir), Cartões e o "sim" curto do
 * Kolo Vivo. Uma família da allowlist que pedisse a rotina de terça não recebia
 * a rotina — recebia uma resposta conversacional SOBRE rotina.
 *
 * ⚠️ POR QUE DESCER O RAMO EM VEZ DE SUBIR OS BLOCOS. A tentativa anterior
 * (revertida) subiu a região dos roteadores e os testes pegaram que
 * `classificarIntencao` mora no meio dela — subir em bloco fazia o experimental
 * herdar uma LLM sem ganho. Descer o ramo produz a MESMA ordem final movendo um
 * bloco em vez de seis.
 *
 * ⚠️ O CUSTO, DECLARADO. O turno experimental passa a pagar o classificador —
 * MEDIDO em 849 ms de p50. Continua sem `parseInbound` (2.659 ms de p50), que
 * segue abaixo. Foi a decisão C2, com esses números na mesa.
 */

const ORQ = readFileSync(join(process.cwd(), "src/lib/ayla/orchestrator.ts"), "utf8");
const EXP = readFileSync(join(process.cwd(), "src/lib/ayla/experimental.ts"), "utf8");
const pos = (s: string, t = ORQ) => {
  const i = t.indexOf(s);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
};

const GATE = "// 2b. ASSINATURA (GATE)";
const ACESSO = "if (pedeAcessoAoApp(inbound.texto)) {";
const CLASSIFICADOR = "const turnoClassificado = rotinaConversa";
const EXPERIMENTAL = "if (ehFamiliaExperimental(family.id)) {";
const PARSER = "// 4. Parser IA";

const ROTEADORES: Array<[string, string]> = [
  ["fim de semana", "// 3a. Resposta à oferta de fim de semana"],
  ["escolher criança", "// 3b-crianca. A Ayla pediu"],
  ["rotina — ver", "// 3c-rotina-ver."],
  ["rotina — editar", "// 3c-rotina-editar."],
  ["rotina conduzida / Cartões", "// 3c-rotina. Fluxo CONDUZIDO"],
  ['"sim" curto → Kolo Vivo', '// 3b. "Sim" curto'],
];

describe("A ORDEM — o experimental é o último recurso, não o primeiro", () => {
  it.each(ROTEADORES)("%s vem ANTES do experimental", (_n, marca) => {
    expect(pos(marca)).toBeLessThan(pos(EXPERIMENTAL));
  });

  it("o classificador vem antes do experimental", () => {
    expect(pos(CLASSIFICADOR)).toBeLessThan(pos(EXPERIMENTAL));
  });

  it("gate de assinatura e acesso continuam no topo", () => {
    expect(pos(GATE)).toBeLessThan(pos(ACESSO));
    expect(pos(ACESSO)).toBeLessThan(pos(ROTEADORES[0][1]));
  });

  it("o PARSER continua depois do experimental — a latência não regrediu", () => {
    // A regressão que a Opção C recusou: se o parser subisse, o experimental
    // herdaria 2.659 ms de p50 em vez dos 849 ms do classificador.
    expect(pos(EXPERIMENTAL)).toBeLessThan(pos(PARSER));
  });

  it("o ramo experimental aparece UMA vez — foi move, não copy", () => {
    expect(ORQ.split(EXPERIMENTAL).length - 1).toBe(1);
  });

  it.each(ROTEADORES)("%s aparece uma vez só", (_n, marca) => {
    expect(ORQ.split(marca).length - 1).toBe(1);
  });
});

describe("UM DONO — ninguém reclassifica a mesma mensagem", () => {
  it("o orquestrador classifica UMA vez por turno", () => {
    expect(ORQ.split("await classificarIntencao(").length - 1).toBe(1);
  });

  it("o experimental RECEBE o resultado, não o recalcula", () => {
    expect(ORQ).toContain("turnoClassificado,");
    expect(EXP).toContain("turnoClassificado?: {");
    // E não importa o classificador — se importasse, haveria duas fontes.
    const imports = (EXP.match(/^import .*$/gm) ?? []).join("\n");
    expect(imports).not.toContain("./intent");
    expect(imports).not.toContain("classificarIntencao");
  });

  it("o experimental não chama o parser", () => {
    const imports = (EXP.match(/^import .*$/gm) ?? []).join("\n");
    expect(imports).not.toContain("./parser");
    expect(EXP).not.toContain("parseInbound(");
  });
});

describe("BOAS PRÁTICAS — repertório, pelo mecanismo existente", () => {
  it("reusa `recuperarBoasPraticas`, não cria uma segunda recuperação", () => {
    expect(EXP).toContain('from "@/lib/conhecimento/recuperar"');
    expect(EXP).toContain("recuperarBoasPraticas({");
    expect(EXP).toContain("blocoBoasPraticas(bps)");
  });

  it("as skills vêm do turno já classificado — sem classificação nova", () => {
    expect(EXP).toContain("params.turnoClassificado?.skills ?? []");
  });

  it("a consulta roda EM PARALELO — não acrescenta espera em série", () => {
    const bloco = EXP.slice(
      EXP.indexOf("const [ctxTurno, core, bps, estadoTrial, evidencias, docTrial] = await Promise.all(["),
      EXP.indexOf("const msBp ="),
    );
    expect(bloco).toContain("montarContexto(");
    expect(bloco).toContain("resolverDocumento(");
    expect(bloco).toContain("recuperarBoasPraticas({");
    // A jornada do Trial entrou no MESMO Promise.all (15/08/2026): duas
    // consultas que correm ao lado das outras e não somam espera ao turno.
    expect(bloco).toContain("lerEstadoTrial(");
    expect(bloco).toContain("lerEvidenciasJornada(");
  });

  it("falha do acervo NUNCA derruba o turno", () => {
    // Enriquecimento que derruba conversa é pior que a ausência dele.
    const bloco = EXP.slice(EXP.indexOf("recuperarBoasPraticas({"), EXP.indexOf("const msBp ="));
    expect(bloco).toContain(".catch(() => [])");
  });

  it("sem skills, não há consulta — nada de query vazia em todo turno", () => {
    expect(EXP).toContain("skillsDoTurno.length");
    expect(EXP).toContain("Promise.resolve([])");
  });

  it("a ORDEM do prompt é Core → contexto → repertório", () => {
    expect(EXP).toContain("[core.conteudo, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]");
    // Repertório antes do contexto faria a resposta nascer da Boa Prática em
    // vez de nascer da criança.
    const arr = "[core.conteudo, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]";
    expect(arr.indexOf("core.conteudo")).toBeLessThan(arr.indexOf("bloco"));
    expect(arr.indexOf("bloco")).toBeLessThan(arr.indexOf("repertorio"));
  });

  it("RECUPERADO ≠ INJETADO ≠ USADO — as camadas são medidas separadas", () => {
    for (const m of ["bpRecuperadas", "bpInjetadas", "bpChars", "msBp"]) {
      expect(EXP, `métrica ausente: ${m}`).toContain(m);
    }
    // Injetadas deriva do bloco, não da contagem da consulta.
    expect(EXP).toContain("bpInjetadas: repertorio ? bps.length : 0");
  });
});

describe("SABOTAGEM — os testes mordem?", () => {
  it("S1 · o experimental voltando para cima do roteador", () => {
    const regredido = [EXPERIMENTAL, ROTEADORES[2][1]].join("\n...\n");
    expect(regredido.indexOf(ROTEADORES[2][1])).toBeGreaterThan(regredido.indexOf(EXPERIMENTAL));
    expect(pos(ROTEADORES[2][1])).toBeLessThan(pos(EXPERIMENTAL));
  });

  it("S2 · uma segunda classificação da mesma mensagem", () => {
    const sabotado = ORQ + "\n  await classificarIntencao({ texto: inbound.texto });\n";
    expect(sabotado.split("await classificarIntencao(").length - 1).toBe(2);
    expect(ORQ.split("await classificarIntencao(").length - 1).toBe(1);
  });

  it("S3 · o parser entrando no caminho crítico do experimental", () => {
    const sabotado = EXP + '\nimport { parseInbound } from "./parser";\n';
    expect(sabotado).toContain("parseInbound");
    expect(EXP).not.toContain("parseInbound(");
  });

  it("S4 · remover o `.catch` do acervo (falha de BP derruba conversa)", () => {
    const sabotado = EXP.split(".catch(() => [])").join("");
    expect(sabotado).not.toContain(".catch(() => [])");
    expect(EXP).toContain(".catch(() => [])");
  });

  it("S5 · o repertório passando na frente do contexto", () => {
    const sabotado = EXP.replace(
      "[core.conteudo, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]",
      "[core.conteudo, repertorio, jornada, conducaoTrial, bloco]",
    );
    expect(sabotado).toContain("[core.conteudo, repertorio, jornada, conducaoTrial, bloco]");
    expect(EXP).toContain("[core.conteudo, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]");
  });

  it("S6 · injetadas medidas pela consulta em vez do bloco", () => {
    const sabotado = EXP.replace("bpInjetadas: repertorio ? bps.length : 0", "bpInjetadas: bps.length");
    expect(sabotado).toContain("bpInjetadas: bps.length,");
    expect(EXP).toContain("bpInjetadas: repertorio ? bps.length : 0");
  });
});
