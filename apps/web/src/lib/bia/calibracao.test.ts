import { describe, expect, it } from "vitest";
import {
  contextoTemMudancaAbrupta,
  contextoTemSinalDeRisco,
  normalizarContexto,
  pontuar,
  selecionar,
  type ChunkParaPontuar,
  type ContextoBia,
} from "./pontuacao";

/**
 * A CALIBRAÇÃO QUE A BANCADA DOS 15 CHUNKS COBROU — 10/09/2026.
 *
 * ⚠️ OS TRÊS DEFEITOS AQUI SÃO REAIS E FORAM MEDIDOS, não imaginados:
 *
 *   1. No caso "crise súbita" ("começou do nada… nunca foi assim"), o ÚNICO
 *      chunk que respondia — procurar dor física antes de plano comportamental
 *      — levava −40 e era descartado pela cota. Entrava no lugar hierarquia de
 *      dicas de imitação, para uma criança de 5 anos em crise.
 *   2. O turno real do Mario veio com `tema: ["comunicacao","emocional"]` e o
 *      contexto aceitava UM domínio. Lido por "comunicacao": apraxia no topo.
 *      Lido por "emocional": exatamente os dois chunks certos.
 *   3. `nucleos_relacionados` e `habilidades_relacionadas` existiam na migração
 *      0071, eram gravados pelo importador e NÃO participavam da recuperação.
 *
 * ⚠️ METADE DESTE ARQUIVO MEDE FALSO POSITIVO. Uma calibração que só prova que
 * o score subiu não prova nada: subir score é trivial. O que precisa ser
 * verdade é que ele subiu SÓ onde devia.
 */

let seq = 0;
function chunk(over: Partial<ChunkParaPontuar> = {}): ChunkParaPontuar {
  seq += 1;
  return {
    id: `k${seq}`,
    nucleo: "comunicacao",
    secao: null,
    titulo: null,
    tipo_conhecimento: "estrategia",
    faixa_etaria_min_meses: null,
    faixa_etaria_max_meses: null,
    faixa_rotulo: null,
    situacoes_relacionadas: [],
    diagnosticos_relacionados: [],
    nucleos_relacionados: [],
    habilidades_relacionadas: [],
    nivel_de_cautela: "baixo",
    muda_conduta: null,
    texto_original: "conteúdo de apoio sobre o tema em questão",
    revisao_pendente: false,
    ordem: 0,
    ...over,
  };
}

const ctxDe = (over: Partial<ContextoBia> = {}): ContextoBia => ({
  idadeAnos: 6,
  perfil: "TEA",
  dominio: "emocional",
  contexto: "casa",
  ...over,
});

// ============================================================
// 1 · Mudança abrupta
// ============================================================

describe("mudança abrupta de padrão", () => {
  const POSITIVOS = [
    "Essa semana ele começou do nada a ter crises muito fortes.",
    "Do nada começou a chorar sem parar.",
    "Ela nunca foi assim, mudou de uma hora para outra.",
    "Nunca foi desse jeito, começou de repente.",
    "Ele nunca tinha feito isso antes.",
    "As crises pioraram de repente.",
  ];
  const NEGATIVOS = [
    // ⚠️ O ADVÉRBIO DE NARRATIVA. "de repente" sozinho aparece em metade das
    // conversas ("aí de repente ele grita") e não afirma novidade de padrão.
    "Ele está brincando e aí de repente ele grita e sai correndo.",
    "Ela chora na hora do banho, sempre foi assim desde pequena.",
    "Ele tem dificuldade de dormir sozinho há uns dois anos.",
    "Mudamos de escola esse ano e ele está se adaptando.",
    "Quero ajudar ele a se comunicar melhor quando fica frustrado.",
    "",
  ];

  for (const t of POSITIVOS) {
    it(`reconhece: "${t.slice(0, 42)}…"`, () => {
      expect(contextoTemMudancaAbrupta({ textoDaConversa: t })).toBe(true);
    });
  }
  for (const t of NEGATIVOS) {
    it(`NÃO confunde com mudança abrupta: "${t.slice(0, 42)}…"`, () => {
      expect(contextoTemMudancaAbrupta({ textoDaConversa: t })).toBe(false);
    });
  }

  it("mudança abrupta NÃO é sinal de risco — são detectores separados", () => {
    const ctx = { textoDaConversa: "Começou do nada a ter crises essa semana." };
    expect(contextoTemMudancaAbrupta(ctx)).toBe(true);
    expect(contextoTemSinalDeRisco(ctx)).toBe(false);
  });

  it("suspende a penalidade SEM premiar: o score fica idêntico ao de um chunk comum", () => {
    const alerta = chunk({ tipo_conhecimento: "sinal_de_alerta", nucleo: "regulacao_emocional" });
    const semMudanca = pontuar(alerta, normalizarContexto(ctxDe({ textoDaConversa: "ele chora no banho" })))!;
    const comMudanca = pontuar(alerta, normalizarContexto(ctxDe({ textoDaConversa: "começou do nada essa semana" })))!;
    // A diferença tem de ser EXATAMENTE a penalidade retirada — nem um ponto a mais.
    expect(comMudanca.score - semMudanca.score).toBe(40);
    expect(comMudanca.motivos.some((m) => m.codigo === "mudanca_abrupta" && m.peso === 0)).toBe(true);
  });

  it("risco de verdade continua promovendo com +60, e mudança abrupta não o substitui", () => {
    const alerta = chunk({ tipo_conhecimento: "encaminhamento", nucleo: "regulacao_emocional" });
    const comRisco = pontuar(alerta, normalizarContexto(ctxDe({ textoDaConversa: "ele se machuca, bate a cabeça na parede" })))!;
    expect(comRisco.motivos.some((m) => m.codigo === "sinal_de_alerta" && m.peso === 60)).toBe(true);
    expect(comRisco.motivos.some((m) => m.codigo === "mudanca_abrupta")).toBe(false);
  });

  it("o caso real: o alerta de dor orgânica vence a estratégia genérica", () => {
    const dor = chunk({
      id: "dor",
      nucleo: "regulacao_emocional",
      tipo_conhecimento: "sinal_de_alerta",
      situacoes_relacionadas: ["casa"],
      diagnosticos_relacionados: ["tea"],
      texto_original: "Desregulação de início súbito exige investigar dor física silenciosa antes de plano comportamental.",
    });
    const generica = chunk({
      id: "generica",
      nucleo: "comunicacao",
      tipo_conhecimento: "estrategia",
      situacoes_relacionadas: ["casa"],
      diagnosticos_relacionados: ["tea"],
    });
    const ctx = ctxDe({
      textoDaConversa: "Essa semana ele começou do nada a ter crises muito fortes. Nunca foi assim.",
    });
    const [primeiro] = selecionar([dor, generica], ctx, { limite: 2 });
    expect(primeiro.chunk.id).toBe("dor");
  });
});

// ============================================================
// 2 · Multidomínio
// ============================================================

describe("contexto com mais de um domínio", () => {
  it("um chunk de CADA domínio recebe o bônus — e o turno deixa de depender da escolha", () => {
    const com = chunk({ id: "com", nucleo: "comunicacao" });
    const emo = chunk({ id: "emo", nucleo: "regulacao_emocional" });
    const ctx = ctxDe({ dominio: null, dominios: ["comunicacao", "emocional"] });
    for (const c of [com, emo]) {
      expect(pontuar(c, normalizarContexto(ctx))!.motivos.some((m) => m.codigo === "dominio")).toBe(true);
    }
  });

  it("NÃO soma bônus por domínio: dois domínios não valem +100", () => {
    // `pensamentos_crencas` e `regulacao_emocional` mapeiam ambos para "emocional".
    const c = chunk({ nucleo: "regulacao_emocional" });
    const um = pontuar(c, normalizarContexto(ctxDe({ dominio: "emocional" })))!;
    const dois = pontuar(c, normalizarContexto(ctxDe({ dominio: null, dominios: ["emocional", "emocional", "comunicacao"] })))!;
    expect(dois.score).toBe(um.score);
    expect(dois.motivos.filter((m) => m.codigo === "dominio")).toHaveLength(1);
  });

  it("compatibilidade: quem passa só `dominio` não muda de comportamento", () => {
    const c = chunk({ nucleo: "comunicacao" });
    const antes = pontuar(c, normalizarContexto(ctxDe({ dominio: "comunicacao" })))!;
    expect(antes.motivos.some((m) => m.codigo === "dominio" && m.peso === 50)).toBe(true);
  });

  it("domínio que não bate continua não pontuando — a lista não abre a porteira", () => {
    const c = chunk({ nucleo: "sono" });
    const r = pontuar(c, normalizarContexto(ctxDe({ dominio: null, dominios: ["comunicacao", "emocional"] })))!;
    expect(r.motivos.some((m) => m.codigo === "dominio")).toBe(false);
  });
});

// ============================================================
// 3 · Cross-domínio
// ============================================================

describe("núcleo relacionado e habilidade relacionada", () => {
  it("o chunk sensorial alcança um turno de foco quando se declara relacionado", () => {
    const c = chunk({ nucleo: "sensorial", nucleos_relacionados: ["foco_executivas"] });
    const r = pontuar(c, normalizarContexto(ctxDe({ dominio: "foco" })))!;
    expect(r.motivos.some((m) => m.codigo === "nucleo_relacionado" && m.peso === 20)).toBe(true);
  });

  it("relacionado vale MENOS que o próprio núcleo, e nunca os dois juntos", () => {
    const proprio = chunk({ nucleo: "foco_executivas", nucleos_relacionados: ["foco_executivas"] });
    const r = pontuar(proprio, normalizarContexto(ctxDe({ dominio: "foco" })))!;
    expect(r.motivos.filter((m) => m.codigo === "dominio")).toHaveLength(1);
    expect(r.motivos.some((m) => m.codigo === "nucleo_relacionado")).toBe(false);
  });

  it("núcleo relacionado que não bate com o turno não pontua", () => {
    const c = chunk({ nucleo: "sensorial", nucleos_relacionados: ["sono"] });
    const r = pontuar(c, normalizarContexto(ctxDe({ dominio: "foco" })))!;
    expect(r.motivos.some((m) => m.codigo === "nucleo_relacionado")).toBe(false);
  });

  it("habilidade nomeada pela família é ponte de vocabulário", () => {
    const c = chunk({ habilidades_relacionadas: ["apontar", "gestos"] });
    const r = pontuar(c, normalizarContexto(ctxDe({ textoDaConversa: "ela aponta para o que quer" })))!;
    expect(r.motivos.some((m) => m.codigo === "habilidade_relacionada" && m.peso === 8)).toBe(true);
  });

  it("conta UMA vez, por mais habilidades que batam — não é um segundo peso textual", () => {
    const c = chunk({ habilidades_relacionadas: ["apontar", "imitacao", "gestos"] });
    const r = pontuar(c, normalizarContexto(ctxDe({ textoDaConversa: "ela aponta, faz gestos e imita tudo" })))!;
    expect(r.motivos.filter((m) => m.codigo === "habilidade_relacionada")).toHaveLength(1);
  });

  it("habilidade que a família NÃO nomeou não pontua", () => {
    const c = chunk({ habilidades_relacionadas: ["apontar"] });
    const r = pontuar(c, normalizarContexto(ctxDe({ textoDaConversa: "ele não dorme direito" })))!;
    expect(r.motivos.some((m) => m.codigo === "habilidade_relacionada")).toBe(false);
  });

  it("chunk sem os campos novos continua pontuando igual — nada regride por ausência", () => {
    const c = chunk();
    const r = pontuar(c, normalizarContexto(ctxDe({ dominio: "comunicacao" })))!;
    expect(r.motivos.some((m) => m.codigo === "nucleo_relacionado")).toBe(false);
    expect(r.motivos.some((m) => m.codigo === "habilidade_relacionada")).toBe(false);
    expect(r.score).toBeGreaterThan(0);
  });
});
