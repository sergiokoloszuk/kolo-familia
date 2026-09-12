import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  habilidadesProvadasDoPerfil,
  habilidadesProvadasDaLinha,
  textoPorCampoDaLinha,
  provasSaoDoVocabulario,
  HABILIDADES_SEM_FONTE_ESTRUTURADA,
  TABELA_DE_PROVAS,
} from "./habilidades-provadas";
import { BIA_HABILIDADES, habilidadesImplicadas } from "./tipos";
import { filtrarDuro, normalizarContexto, type ChunkParaPontuar } from "./pontuacao";
import { parsearSubcampos, subcamposDe } from "@/lib/kolo-vivo/subcampos";

/**
 * O PRODUTOR DE `habilidadesProvadas` — PEND-197.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROVA, e o que ele deliberadamente NÃO prova. O lado
 * do VETO já tem bancada própria (`veto-habilidade.test.ts`, 17 casos): que
 * veto é veto e não penalidade, que leitura não apaga fala, que frase não vira
 * conversa. Aqui se prova o lado de ENTRADA: quais campos do Perfil Vivo
 * podem virar prova, e — mais importante — quais NÃO podem.
 *
 * A assimetria do erro manda no arquivo inteiro. Um falso positivo aqui apaga
 * conhecimento de quem mais precisa dele, sem ninguém perceber o que não
 * chegou. Por isso a maior parte dos testes é sobre o produtor devolvendo
 * MENOS, não mais.
 */

// ── perfis, na forma exata em que o banco os guarda ────────────────────────
const perfil = (extras: Record<string, string>) => ({ categorias_extras: Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, { texto: v }])) });

describe("sanidade do vocabulário", () => {
  it("toda prova aponta para uma habilidade que existe na taxonomia", () => {
    expect(provasSaoDoVocabulario()).toBe(true);
  });

  it("todo par campo/sub-campo da tabela existe no schema, e é SELETOR FECHADO", () => {
    // ⚠️ É esta asserção que impede o produtor de virar leitor de prosa por
    // descuido: se alguém adicionar uma prova apontando para campo de texto
    // livre, o teste morde aqui.
    for (const p of TABELA_DE_PROVAS) {
      const subs = subcamposDe(p.campo);
      expect(subs, `${p.campo} não tem sub-campos`).toBeTruthy();
      const def = subs!.find((s) => s.key === p.subcampo);
      expect(def, `${p.campo}.${p.subcampo} não existe`).toBeTruthy();
      expect(def!.opcoes, `${p.campo}.${p.subcampo} NÃO é seletor fechado`).toBeTruthy();
      // E cada valor declarado tem de pertencer ao enum de verdade.
      for (const v of p.valores) expect(def!.opcoes).toContain(v);
    }
  });

  /**
   * ⚠️ ESTE TESTE MUDOU DE LADO EM 12/09/2026, E DE PROPÓSITO — PEND-202.
   *
   * Ele afirmava que `conversa_reciproca` e `leitura_escrita` NÃO tinham fonte
   * estruturada, porque nenhum dos 110 sub-campos as provava. A PEND-202
   * criou os seletores que faltavam, então a lista esvaziou. O invariante que
   * importa não era a lista — era a coerência entre ela e a tabela de provas.
   */
  it("nenhuma habilidade fica sem fonte E sem declaração", () => {
    const provaveis = new Set(TABELA_DE_PROVAS.map((p) => p.prova));
    const semFonte = new Set<string>(HABILIDADES_SEM_FONTE_ESTRUTURADA);
    // Habilidade declarada sem fonte não pode ter prova — seria contradição.
    for (const h of HABILIDADES_SEM_FONTE_ESTRUTURADA) expect(provaveis.has(h)).toBe(false);
    // E toda habilidade da taxonomia é provável, transitiva, ou declarada.
    const transitivas = new Set(["atencao_compartilhada", "troca_de_turnos", "fala_funcional"]);
    for (const h of BIA_HABILIDADES) {
      expect(provaveis.has(h) || transitivas.has(h) || semFonte.has(h), h).toBe(true);
    }
  });

  it("as duas lacunas da PEND-197 FECHARAM — e cada uma tem um seletor próprio", () => {
    const provas = TABELA_DE_PROVAS.map((p) => `${p.campo}.${p.subcampo}->${p.prova}`);
    expect(provas).toContain("comunicacao.reciprocidade->conversa_reciproca");
    expect(provas).toContain("aprendizado.leitura_escrita->leitura_escrita");
    expect(HABILIDADES_SEM_FONTE_ESTRUTURADA).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("A · criança que fala em frases", () => {
  it("`forma = Fala frases` prova `frases`, e o fecho dá o resto", () => {
    const h = habilidadesProvadasDaLinha(perfil({ comunicacao: "Como se comunica: Fala frases" }));
    expect([...h.diretas]).toEqual(["frases"]);
    expect(h.todas.has("fala_funcional")).toBe(true);
    expect(h.todas.has("troca_de_turnos")).toBe(true);
    expect(h.todas.size).toBe(8);
  });

  it("NÃO prova `conversa_reciproca` — frase ecolálica é frase", () => {
    const h = habilidadesProvadasDaLinha(perfil({ comunicacao: "Como se comunica: Fala frases" }));
    expect(h.todas.has("conversa_reciproca")).toBe(false);
  });

  it("NÃO prova `leitura_escrita` — falar não é ler", () => {
    const h = habilidadesProvadasDaLinha(perfil({ comunicacao: "Como se comunica: Fala frases" }));
    expect(h.todas.has("leitura_escrita")).toBe(false);
  });
});

describe("B · criança pré-verbal", () => {
  it("`Não-verbal` não prova NADA — e não é confundido com `verbal`", () => {
    // ⚠️ SUBSTRING MATARIA ESTA CRIANÇA. "Não-verbal" contém "verbal"; um
    // `includes` provaria fala para quem não fala e apagaria a escada inteira
    // de quem mais precisa dela. A comparação é por IGUALDADE.
    const h = habilidadesProvadasDaLinha(perfil({ comunicacao: "Como se comunica: Não-verbal" }));
    expect(h.todas.size).toBe(0);
  });

  it("o gesto intencional é creditado — e só ele", () => {
    // O caso real da criança que leva pela mão / aponta. Ela merece o crédito
    // do degrau que já tem, sem herdar os de cima.
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Não-verbal\nMostra o que quer ou espera?: Mostra o que quer" }),
    );
    expect([...h.diretas]).toEqual(["gestos_intencionais"]);
    expect(h.todas.has("fala_funcional")).toBe(false);
    expect(h.todas.has("comunicacao_simbolica")).toBe(false);
  });

  it("`Espera oferecerem` não prova gesto", () => {
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Não-verbal\nMostra o que quer ou espera?: Espera oferecerem" }),
    );
    expect(h.diretas.size).toBe(0);
  });

  it("palavra solta prova símbolo, mas NÃO fala funcional", () => {
    // Palavra isolada pode ser rótulo, não pedido. O degrau de cima fica.
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Fala palavras soltas" }),
    );
    expect([...h.diretas]).toEqual(["comunicacao_simbolica"]);
    expect(h.todas.has("fala_funcional")).toBe(false);
    expect(h.todas.has("frases")).toBe(false);
  });
});

describe("C · imitação e atenção social", () => {
  it("`Imita bastante` e `Às vezes` provam imitação; `Pouco` e `Quase não imita` não", () => {
    for (const v of ["Imita bastante", "Às vezes"]) {
      const h = habilidadesProvadasDaLinha(perfil({ imitacao: `Imita?: ${v}` }));
      expect(h.diretas.has("imitacao"), v).toBe(true);
    }
    for (const v of ["Pouco", "Quase não imita"]) {
      const h = habilidadesProvadasDaLinha(perfil({ imitacao: `Imita?: ${v}` }));
      expect(h.diretas.has("imitacao"), v).toBe(false);
    }
  });

  it("interagir com pares prova o piso da escada; `Raramente` não", () => {
    for (const v of ["Com facilidade", "Às vezes"]) {
      const h = habilidadesProvadasDaLinha(
        perfil({ socializacao: `Interage com outras pessoas (pares): ${v}` }),
      );
      expect(h.diretas.has("atencao_social"), v).toBe(true);
    }
    const h = habilidadesProvadasDaLinha(
      perfil({ socializacao: "Interage com outras pessoas (pares): Raramente" }),
    );
    expect(h.todas.size).toBe(0);
  });

  it("`socializacao.divide = Sim` NÃO prova troca de turnos", () => {
    // CANDIDATO DESCARTADO, e o teste existe para que ele não volte por
    // pressão de cobertura: dividir brinquedo e sustentar alternância
    // proto-conversacional são construtos diferentes, e aceitar isso vetaria
    // o conteúdo que ENSINA troca de turnos.
    const h = habilidadesProvadasDaLinha(
      perfil({ socializacao: "Divide e espera a vez: Sim" }),
    );
    expect(h.todas.has("troca_de_turnos")).toBe(false);
    expect(h.todas.size).toBe(0);
  });
});

describe("D · o que NÃO é evidência", () => {
  it("perfil vazio devolve vazio — ausência de dado não é ausência de habilidade", () => {
    expect(habilidadesProvadasDoPerfil({}).todas.size).toBe(0);
    expect(habilidadesProvadasDaLinha(null).todas.size).toBe(0);
    expect(habilidadesProvadasDaLinha({}).todas.size).toBe(0);
  });

  it("PROSA NÃO PROVA NADA — o caso Mario, literal", () => {
    /**
     * ⚠️ ESTE É O PERFIL REAL DO MARIO (`7da80c3a`), e ele é o caso que
     * originou a PEND-196. "Conversa bem" está em **Outras observações** —
     * texto livre, escrito pelo caminho antigo. O produtor devolve VAZIO, e
     * isso é correto por desenho: ler prosa aqui repetiria, com sinal
     * invertido, o erro que a PEND-194 existe para corrigir.
     *
     * A consequência é honesta e está no relatório: **hoje o Mario não é
     * protegido pelo veto.** O que protege o Mario é o seletor `forma` ser
     * preenchido — e é exatamente isso que a Fase 2 passou a fazer.
     */
    const h = habilidadesProvadasDaLinha(
      perfil({
        comunicacao:
          "Outras observações: Conversa bem, estamos treinando ter autonomia e ligar para resolver coisas",
        socializacao:
          "Como é socializar pra ele(a): Custa / cansa\nInterage com outras pessoas (pares): Raramente",
      }),
    );
    expect(h.todas.size).toBe(0);
  });

  it("prosa que NEGA a habilidade também não vira prova — nem ao contrário", () => {
    // Perfil real de produção: "Ele fala muito pouco, não fala frases". Um
    // produtor com regex por "frases" provaria `frases` aqui. Medi isso: das
    // 5 ocorrências que um regex de medição pegou, 3 eram negação ou eram
    // sobre a MÃE ("ajustes na forma de conversar").
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Outras observações: Ele fala muito pouco, não fala frases" }),
    );
    expect(h.todas.size).toBe(0);
  });

  it("crise, sensorial, sono, foco e autonomia não provam habilidade de comunicação", () => {
    const h = habilidadesProvadasDaLinha(
      perfil({
        emocional: "Como costuma ser: Crises intensas",
        sensorial: "Perfil sensorial: Hipersensível",
        sono: "Como costuma ser o sono: Acorda à noite",
        foco: "Como é o foco: Hiperfoco intenso",
        autonomia: "Autonomia no dia a dia: Faz bastante sozinha",
        aprendizado: "Como aprende melhor: Repetindo",
      }),
    );
    // "Repetindo" é canal de aprendizagem, não imitação.
    expect(h.todas.size).toBe(0);
  });

  it("VALOR FORA DO ENUM é ignorado em silêncio — não prova e não quebra", () => {
    // Existe 1 perfil real com `forma = "Fala frases curtas"`, provavelmente
    // editado à mão. Não é um dos três valores do seletor: não prova.
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Fala frases curtas" }),
    );
    expect(h.todas.size).toBe(0);
  });

  it("campo desconhecido e lixo estrutural não derrubam o produtor", () => {
    expect(() =>
      habilidadesProvadasDoPerfil({ campo_que_nao_existe: "qualquer coisa", comunicacao: "" }),
    ).not.toThrow();
    expect(() => habilidadesProvadasDaLinha({ categorias_extras: null })).not.toThrow();
    expect(() => habilidadesProvadasDaLinha({ comunicacao: "texto cru" })).not.toThrow();
  });
});

describe("E · direta × transitiva ficam separadas", () => {
  it("`todas` é superconjunto de `diretas`, e o fecho é o da PEND-196", () => {
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Fala frases", imitacao: "Imita?: Às vezes" }),
    );
    expect([...h.diretas].sort()).toEqual(["frases", "imitacao"]);
    for (const d of h.diretas) expect(h.todas.has(d)).toBe(true);
    // Nada é inventado: `todas` é exatamente o fecho de `diretas`.
    expect([...h.todas].sort()).toEqual([...habilidadesImplicadas([...h.diretas])].sort());
  });

  it("a evidência diz QUAL campo provou o quê, sem palavra de família", () => {
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Fala frases\nOutras observações: segredo da família" }),
    );
    expect(h.evidencias).toEqual([
      { campo: "comunicacao", subcampo: "forma", valor: "Fala frases", prova: "frases" },
    ]);
    expect(JSON.stringify(h.evidencias)).not.toContain("segredo");
  });

  it("`textoPorCampoDaLinha` lê coluna de topo e `categorias_extras`", () => {
    const t = textoPorCampoDaLinha({
      sensorial: { texto: "Perfil sensorial: Misto" },
      categorias_extras: { comunicacao: { texto: "Como se comunica: Fala frases" } },
    });
    expect(t.sensorial).toContain("Misto");
    expect(t.comunicacao).toContain("Fala frases");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * A PONTE COM O VETO — produtor → `filtrarDuro`, ponta a ponta.
 *
 * Usa os `pressupoe_ausencia_de` reais do corpus versionado, lidos do arquivo:
 * se o corpus mudar, o teste acompanha em vez de mentir.
 */
describe("F · ponta a ponta — perfil real vira veto", () => {
  const corpus = JSON.parse(
    readFileSync(new URL("../../../../../data/bia/corpus-pos-v1.json", import.meta.url), "utf8"),
  );
  const lista: Array<Record<string, unknown>> = Array.isArray(corpus) ? corpus : corpus.chunks;
  const comPressuposto = lista.filter(
    (c) => ((c.pressupoe_ausencia_de as string[]) ?? []).length > 0,
  );

  const chunkDe = (c: Record<string, unknown>): ChunkParaPontuar =>
    ({
      id: String(c.id),
      nucleo: "comunicacao",
      secao: null,
      titulo: null,
      tipo_conhecimento: "regra_operacional",
      faixa_etaria_min_meses: null,
      faixa_etaria_max_meses: null,
      faixa_rotulo: null,
      situacoes_relacionadas: [],
      diagnosticos_relacionados: [],
      nucleos_relacionados: [],
      habilidades_relacionadas: [],
      pressupoe_ausencia_de: (c.pressupoe_ausencia_de as string[]) ?? [],
      nivel_de_cautela: "baixo",
      muda_conduta: null,
      texto_original: "x",
      revisao_pendente: false,
      ordem: 0,
    }) as ChunkParaPontuar;

  const vetados = (linha: unknown) => {
    const h = habilidadesProvadasDaLinha(linha as Record<string, unknown>);
    const ctx = normalizarContexto({
      idadeAnos: 9,
      perfil: "TEA",
      dominio: "comunicacao",
      habilidadesProvadas: [...h.todas],
    });
    return comPressuposto.filter((c) => filtrarDuro(chunkDe(c), ctx) !== null);
  };

  it("o corpus versionado tem os 9 chunks com pressuposto", () => {
    expect(lista.length).toBe(45);
    expect(comPressuposto.length).toBe(9);
  });

  it("criança que fala em frases: os 9 são vetados", () => {
    expect(vetados(perfil({ comunicacao: "Como se comunica: Fala frases" })).length).toBe(9);
  });

  it("criança pré-verbal: NENHUM é vetado — a escada continua chegando", () => {
    expect(vetados(perfil({ comunicacao: "Como se comunica: Não-verbal" })).length).toBe(0);
  });

  it("palavra solta: veta pouco, e o que ensina fala CONTINUA chegando", () => {
    const v = vetados(
      perfil({
        comunicacao: "Como se comunica: Fala palavras soltas",
        socializacao: "Interage com outras pessoas (pares): Às vezes",
      }),
    );
    // `pos-a-03-contato` pressupõe ausência de atenção social, que ela provou.
    expect(v.map((c) => String(c.id))).toContain("pos-a-03-contato");
    // Mas a escada de pré-requisitos de FALA permanece elegível.
    expect(v.map((c) => String(c.id))).not.toContain("pos-a-03-escada");
  });

  it("MARIO HOJE: conjunto vazio ⇒ nenhum veto ⇒ conteúdo abaixo do nível dele AINDA entra", () => {
    // ⚠️ ESTE TESTE AFIRMA UM DEFEITO ABERTO, de propósito. Ele não está aqui
    // para passar bonito: está para que o dia em que o Perfil do Mario ganhar
    // `forma` preenchido — pela Fase 2 — esta expectativa quebre e alguém
    // tenha de vir aqui atualizar o número, vendo que o problema fechou.
    const v = vetados(
      perfil({
        comunicacao: "Outras observações: Conversa bem, estamos treinando ter autonomia",
        socializacao: "Interage com outras pessoas (pares): Raramente",
      }),
    );
    expect(v.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G · sabotagens", () => {
  const escada: Partial<ChunkParaPontuar> = {
    id: "escada",
    pressupoe_ausencia_de: ["fala_funcional", "frases", "conversa_reciproca"],
  };
  const chunk = (over: Partial<ChunkParaPontuar>): ChunkParaPontuar =>
    ({
      id: "c",
      nucleo: "comunicacao",
      secao: null,
      titulo: null,
      tipo_conhecimento: "regra_operacional",
      faixa_etaria_min_meses: null,
      faixa_etaria_max_meses: null,
      faixa_rotulo: null,
      situacoes_relacionadas: [],
      diagnosticos_relacionados: [],
      nucleos_relacionados: [],
      habilidades_relacionadas: [],
      pressupoe_ausencia_de: [],
      nivel_de_cautela: "baixo",
      muda_conduta: null,
      texto_original: "x",
      revisao_pendente: false,
      ordem: 0,
      ...over,
    }) as ChunkParaPontuar;

  const ctxCom = (hab: string[]) =>
    normalizarContexto({
      idadeAnos: 15,
      perfil: "TEA",
      dominio: "comunicacao",
      habilidadesProvadas: hab,
    });

  it("DESLIGAR `habilidadesProvadas` faz o caso problemático voltar", () => {
    // O adolescente que fala bem recebendo a escada pré-verbal — o defeito
    // medido que originou a PEND-196.
    const h = habilidadesProvadasDaLinha(perfil({ comunicacao: "Como se comunica: Fala frases" }));
    // ⚠️ `filtrarDuro` devolve o MOTIVO quando exclui, e `null` quando o chunk
    // passa. Vetado = string; elegível = null.
    expect(filtrarDuro(chunk(escada), ctxCom([...h.todas]))).toBe("habilidade_ja_provada");
    // sem o produtor, o chunk volta a ser elegível
    expect(filtrarDuro(chunk(escada), ctxCom([]))).toBeNull();
  });

  it("QUEBRAR A TRANSITIVIDADE é detectado: `frases` tem de arrastar `fala_funcional`", () => {
    const h = habilidadesProvadasDaLinha(perfil({ comunicacao: "Como se comunica: Fala frases" }));
    expect(h.todas.has("fala_funcional")).toBe(true);
    // e o fecho é o que faz `frases` vetar um chunk que pressupõe ausência de
    // um degrau ABAIXO dele. Sem transitividade, este veto não aconteceria.
    expect(filtrarDuro(chunk(escada), ctxCom(["frases"]))).toBe("habilidade_ja_provada");
    expect(
      filtrarDuro(
        chunk({ id: "x", pressupoe_ausencia_de: ["troca_de_turnos"] } as Partial<ChunkParaPontuar>),
        ctxCom(["frases"]),
      ),
    ).toBe("habilidade_ja_provada");
  });

  it("VALOR FORA DA TAXONOMIA não derruba o turno nem veta conteúdo", () => {
    expect(() => ctxCom(["habilidade_inventada", "fala", "verbal"])).not.toThrow();
    // Nada provado ⇒ nada vetado ⇒ o chunk continua elegível (`null`).
    expect(filtrarDuro(chunk(escada), ctxCom(["habilidade_inventada", "fala", "verbal"]))).toBeNull();
  });

  it("o produtor é determinístico: mesma entrada, mesma saída", () => {
    const p = perfil({ comunicacao: "Como se comunica: Fala frases", imitacao: "Imita?: Às vezes" });
    const a = habilidadesProvadasDaLinha(p);
    const b = habilidadesProvadasDaLinha(p);
    expect([...a.todas].sort()).toEqual([...b.todas].sort());
    expect(a.evidencias).toEqual(b.evidencias);
  });

  it("o produtor NÃO lê prosa — nenhum regex sobre texto de família no módulo", () => {
    const SRC = readFileSync(new URL("./habilidades-provadas.ts", import.meta.url), "utf8");
    // Sem literais de regex, sem `.test(`, sem `match(`, sem `includes(` sobre texto.
    expect(SRC).not.toMatch(/\.test\(/);
    expect(SRC).not.toMatch(/\.match\(/);
    expect(SRC).not.toMatch(/new RegExp/);
    // O único `includes` permitido é o do enum, sobre a lista de valores.
    const includes = SRC.match(/\.includes\(/g) ?? [];
    expect(includes.length).toBeLessThanOrEqual(2);
    // E nenhuma chamada de modelo, nenhuma escrita, nenhum IO.
    expect(SRC).not.toMatch(/getAnthropicClient|extrairAtualizacoes|from\("perfil_vivo/);
    expect(SRC).not.toMatch(/\.upsert\(|\.insert\(|\.update\(/);
  });

  it("toda habilidade da taxonomia é ou provável, ou declarada sem fonte", () => {
    // Impede a lista de habilidades e a tabela de provas de se separarem em
    // silêncio: habilidade nova sem prova e sem declaração vira lacuna oculta.
    const provaveis = new Set(TABELA_DE_PROVAS.map((p) => p.prova));
    const semFonte = new Set<string>(HABILIDADES_SEM_FONTE_ESTRUTURADA);
    // as que só chegam por transitividade
    const transitivas = new Set(["atencao_compartilhada", "troca_de_turnos", "fala_funcional"]);
    for (const h of BIA_HABILIDADES) {
      expect(
        provaveis.has(h) || semFonte.has(h) || transitivas.has(h),
        `${h} não é provável, nem transitiva, nem declarada sem fonte`,
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * OS TRÊS SELETORES DA PEND-202 — e o que cada valor deliberadamente NÃO prova.
 */
describe("H · reciprocidade, CAA e leitura/escrita", () => {
  it("`Mantém e argumenta` prova conversa recíproca; os outros três NÃO", () => {
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Fala frases\nVai-e-vem na conversa: Mantém e argumenta" }),
    );
    expect(h.diretas.has("conversa_reciproca")).toBe(true);
    expect(h.todas.size).toBe(9);
    for (const v of ["Mantém com apoio", "Fala, mas trava no vai-e-vem", "Ainda não sustenta"]) {
      const x = habilidadesProvadasDaLinha(
        perfil({ comunicacao: `Como se comunica: Fala frases\nVai-e-vem na conversa: ${v}` }),
      );
      expect(x.todas.has("conversa_reciproca"), v).toBe(false);
      // e continua provando o que `forma` provava — a correção não tira nada
      expect(x.diretas.has("frases"), v).toBe(true);
    }
  });

  it("O CASO DA PEND-192, agora estruturado: fala frases e trava no vai-e-vem", () => {
    // Era isto que "Conversa bem" em prosa não conseguia distinguir. Agora a
    // criança recebe o veto do pré-verbal E continua recebendo o conteúdo de
    // reciprocidade, que é o que ela precisa.
    const h = habilidadesProvadasDaLinha(
      perfil({
        comunicacao: "Como se comunica: Fala frases\nVai-e-vem na conversa: Fala, mas trava no vai-e-vem",
      }),
    );
    expect(h.todas.has("fala_funcional")).toBe(true);
    expect(h.todas.has("conversa_reciproca")).toBe(false);
  });

  it("CAA no dia a dia prova símbolo — e tira a criança não-verbal do conjunto vazio", () => {
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Não-verbal\nUsa comunicação alternativa?: Usa no dia a dia" }),
    );
    expect(h.diretas.has("comunicacao_simbolica")).toBe(true);
    // mas NÃO ganha fala: CAA não é fala
    expect(h.todas.has("fala_funcional")).toBe(false);
    expect(h.todas.has("frases")).toBe(false);
  });

  it("`Em treino` e `Já tentou e não engajou` NÃO provam CAA", () => {
    for (const v of ["Em treino / às vezes", "Já tentou e não engajou", "Não usa"]) {
      const h = habilidadesProvadasDaLinha(
        perfil({ comunicacao: `Como se comunica: Não-verbal\nUsa comunicação alternativa?: ${v}` }),
      );
      expect(h.todas.size, v).toBe(0);
    }
  });

  it("lê e escreve com autonomia prova leitura — e NUNCA fala", () => {
    // O perfil real não-verbal que "usa pintura e escrita como comunicação".
    const h = habilidadesProvadasDaLinha(
      perfil({
        comunicacao: "Como se comunica: Não-verbal",
        aprendizado: "Leitura e escrita: Lê e escreve com autonomia",
      }),
    );
    expect(h.diretas.has("leitura_escrita")).toBe(true);
    expect(h.todas.has("comunicacao_simbolica")).toBe(true); // pelo fecho
    expect(h.todas.has("fala_funcional")).toBe(false);
    expect(h.todas.has("frases")).toBe(false);
  });

  it("`Está alfabetizando` e `Reconhece letras` NÃO provam leitura", () => {
    for (const v of ["Está alfabetizando", "Reconhece letras e palavras", "Ainda não"]) {
      const h = habilidadesProvadasDaLinha(perfil({ aprendizado: `Leitura e escrita: ${v}` }));
      expect(h.todas.size, v).toBe(0);
    }
  });

  it("`iniciativa` funciona para quem FALA — o `mostrarSe` saiu", () => {
    const h = habilidadesProvadasDaLinha(
      perfil({ comunicacao: "Como se comunica: Fala palavras soltas\nMostra o que quer ou espera?: Mostra o que quer" }),
    );
    expect(h.diretas.has("gestos_intencionais")).toBe(true);
    expect(h.diretas.has("comunicacao_simbolica")).toBe(true);
  });
});

describe("I · o schema não regrediu", () => {
  it("os campos novos entram ANTES de `outras` — senão viram sumidouro de prosa", () => {
    // ⚠️ `parsearSubcampos` joga a linha sem rótulo reconhecido no ÚLTIMO
    // sub-campo do domínio, e `ehBaldeDeSobra` chama o último de balde de
    // sobra. Campo novo depois de `outras` capturaria a prosa antiga de 19
    // perfis e quebraria a métrica da PEND-194 de uma vez.
    for (const dom of ["comunicacao", "aprendizado"]) {
      const subs = subcamposDe(dom)!;
      expect(subs[subs.length - 1].key, dom).toBe("outras");
    }
  });

  it("PROSA ANTIGA continua parseando depois dos campos novos", () => {
    // Perfil real do Mario, escrito antes da PEND-202.
    const h = habilidadesProvadasDaLinha(
      perfil({
        comunicacao: "Outras observações: Conversa bem, estamos treinando ter autonomia",
        socializacao: "Interage com outras pessoas (pares): Raramente",
      }),
    );
    // segue vazio — e o importante é que não explodiu e não inventou prova
    expect(h.todas.size).toBe(0);
    const subs = subcamposDe("comunicacao")!;
    const v = parsearSubcampos(subs, "Outras observações: Conversa bem");
    expect(v.outras).toBe("Conversa bem");
    expect(v.reciprocidade ?? "").toBe("");
  });

  it("texto LEGADO sem rótulo continua caindo em `outras`, não nos campos novos", () => {
    const subs = subcamposDe("comunicacao")!;
    const v = parsearSubcampos(subs, "frase solta escrita antes de existir rótulo");
    expect(v.outras).toContain("frase solta");
    expect(v.reciprocidade ?? "").toBe("");
    expect(v.caa_uso ?? "").toBe("");
  });

  it("os seletores novos não ganharam `mostrarSe` — e isso é o ponto", () => {
    const c = subcamposDe("comunicacao")!;
    const a = subcamposDe("aprendizado")!;
    for (const k of ["reciprocidade", "caa_uso", "iniciativa"]) {
      const def = c.find((s) => s.key === k)!;
      expect(def, k).toBeTruthy();
      expect((def as { mostrarSe?: unknown }).mostrarSe, k).toBeUndefined();
    }
    expect((a.find((s) => s.key === "leitura_escrita") as { mostrarSe?: unknown }).mostrarSe).toBeUndefined();
  });

  it("os campos ANTIGOS de texto seguem intactos — nada foi reescrito", () => {
    const c = subcamposDe("comunicacao")!;
    for (const k of ["conversa", "caa", "mostra", "entende", "vocabulario", "ecolalia", "contato"]) {
      const def = c.find((s) => s.key === k);
      expect(def, k).toBeTruthy();
      expect((def as { opcoes?: unknown }).opcoes, `${k} virou seletor`).toBeUndefined();
    }
  });
});
