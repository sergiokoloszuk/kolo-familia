import { describe, expect, it } from "vitest";
import {
  contextoTemSinalDeRisco,
  filtrarDuro,
  normalizarContexto,
  PESOS,
  pontuar,
  selecionar,
  termos,
  type ChunkParaPontuar,
  type ContextoBia,
} from "./pontuacao";

/**
 * Testes do NÚCLEO PURO do retriever. Rodam sem banco, sem rede e sem IA — que
 * é exatamente o motivo de a pontuação viver separada do serviço.
 *
 * Cada `it` aqui trava uma decisão de qualidade da recuperação. Se um deles
 * quebrar, a BIA passou a devolver conhecimento que ela não deveria devolver —
 * e isso é pior do que não devolver nada, porque chegaria à mãe com cara de
 * método curado.
 */

let seq = 0;
function chunk(over: Partial<ChunkParaPontuar> = {}): ChunkParaPontuar {
  seq += 1;
  return {
    id: `c${seq}`,
    nucleo: "comunicacao",
    secao: "7. Estratégias Práticas",
    titulo: "7. Estratégias Práticas",
    tipo_conhecimento: "estrategia",
    faixa_etaria_min_meses: null,
    faixa_etaria_max_meses: null,
    faixa_rotulo: null,
    situacoes_relacionadas: [],
    diagnosticos_relacionados: [],
    nivel_de_cautela: "baixo",
    muda_conduta: null,
    texto_original:
      "Sentar de frente para a criança e imitar exatamente o que ela está fazendo com os objetos dela.",
    revisao_pendente: false,
    ordem: seq,
    ...over,
  };
}

const ctxComunicacao: ContextoBia = {
  idadeAnos: 4,
  perfil: "TEA",
  dominio: "comunicacao",
  contexto: "escola",
  dificuldade: "não fala e puxa a minha mão para pedir",
  objetivo: "quero ajudar ele a pedir",
  textoDaConversa: "ele puxa minha mão até o armário e não olha pra mim",
};

describe("filtros duros", () => {
  it("NUNCA devolve chunk com revisão pendente", () => {
    const c = chunk({ revisao_pendente: true });
    expect(filtrarDuro(c, normalizarContexto(ctxComunicacao))).toBe("revisao_pendente");

    // E, pela porta da frente, também não sai.
    const saida = selecionar([c], ctxComunicacao);
    expect(saida).toHaveLength(0);
  });

  it("exclui faixa etária incompatível", () => {
    // Conhecimento de 13-18 anos não serve para uma criança de 4.
    const adolescente = chunk({
      faixa_etaria_min_meses: 156,
      faixa_etaria_max_meses: 216,
      faixa_rotulo: "13-18 anos",
    });
    expect(filtrarDuro(adolescente, normalizarContexto(ctxComunicacao))).toBe("faixa_etaria");
    expect(selecionar([adolescente], ctxComunicacao)).toHaveLength(0);
  });

  it("faixa aberta serve para qualquer idade", () => {
    const geral = chunk();
    expect(filtrarDuro(geral, normalizarContexto(ctxComunicacao))).toBeNull();
  });

  it("sem idade no contexto, nenhuma faixa é excluída", () => {
    const adolescente = chunk({ faixa_etaria_min_meses: 156, faixa_etaria_max_meses: 216 });
    const ctx = normalizarContexto({ ...ctxComunicacao, idadeAnos: null });
    expect(filtrarDuro(adolescente, ctx)).toBeNull();
  });

  it("'não usar sem contexto' só passa quando o domínio é o do chunk", () => {
    const delicado = chunk({ nivel_de_cautela: "nao_usar_sem_contexto", nucleo: "sono" });
    // Domínio pedido é comunicação → fora.
    expect(filtrarDuro(delicado, normalizarContexto(ctxComunicacao))).toBe(
      "nao_usar_sem_contexto",
    );
    // Domínio pedido é sono → passa.
    const ctxSono = normalizarContexto({ ...ctxComunicacao, dominio: "sono" });
    expect(filtrarDuro(delicado, ctxSono)).toBeNull();
  });
});

describe("pontuação estruturada", () => {
  it("o domínio é o sinal mais forte: vence coincidência textual de outro núcleo", () => {
    const noDominio = chunk({ nucleo: "comunicacao", texto_original: "orientação geral." });
    const foraDoDominio = chunk({
      nucleo: "sono",
      // Casa MUITO com o texto da conversa, mas é de outro núcleo.
      titulo: "puxa a mão armário olhar",
      texto_original: "ele puxa minha mão até o armário e não olha pra mim, no armário",
    });

    const saida = selecionar([foraDoDominio, noDominio], ctxComunicacao);
    expect(saida[0].chunk.id).toBe(noDominio.id);
    expect(saida[0].motivos.some((m) => m.codigo === "dominio")).toBe(true);
  });

  it("faixa etária específica compatível pontua mais que faixa aberta", () => {
    const especifico = chunk({
      faixa_etaria_min_meses: 36,
      faixa_etaria_max_meses: 60,
      faixa_rotulo: "3-5 anos",
    });
    const generico = chunk();
    const saida = selecionar([generico, especifico], ctxComunicacao);
    expect(saida[0].chunk.id).toBe(especifico.id);
    expect(saida[0].motivos.some((m) => m.codigo === "faixa_etaria")).toBe(true);
  });

  it("situação do cotidiano e diagnóstico entram como motivo", () => {
    const c = chunk({
      situacoes_relacionadas: ["escola"],
      diagnosticos_relacionados: ["tea"],
    });
    const [r] = selecionar([c], ctxComunicacao);
    expect(r.motivos.map((m) => m.codigo)).toContain("situacao");
    expect(r.motivos.map((m) => m.codigo)).toContain("diagnostico");
  });

  it("regra SE/ENTÃO vence conceito, com tudo o mais igual", () => {
    const regra = chunk({ tipo_conhecimento: "regra_operacional" });
    const conceito = chunk({ tipo_conhecimento: "conceito" });
    const saida = selecionar([conceito, regra], ctxComunicacao);
    expect(saida[0].chunk.id).toBe(regra.id);
  });

  it("pergunta que MUDA CONDUTA pontua acima da que não muda", () => {
    const muda = chunk({ tipo_conhecimento: "pergunta_investigativa", muda_conduta: true });
    const naoMuda = chunk({ tipo_conhecimento: "pergunta_investigativa", muda_conduta: false });
    const saida = selecionar([naoMuda, muda], ctxComunicacao);
    expect(saida[0].chunk.id).toBe(muda.id);
    expect(saida[0].motivos.some((m) => m.codigo === "muda_conduta")).toBe(true);
  });
});

describe("segurança e prioridade", () => {
  it("encaminhamento afunda quando não há sinal de risco", () => {
    const encaminhamento = chunk({
      tipo_conhecimento: "encaminhamento",
      nivel_de_cautela: "requer_encaminhamento",
    });
    const comum = chunk({ tipo_conhecimento: "estrategia" });
    const saida = selecionar([encaminhamento, comum], ctxComunicacao);
    expect(saida[0].chunk.id).toBe(comum.id);
  });

  it("encaminhamento sobe na frente quando HÁ sinal de risco", () => {
    const encaminhamento = chunk({
      tipo_conhecimento: "encaminhamento",
      nivel_de_cautela: "requer_encaminhamento",
    });
    const comum = chunk({ tipo_conhecimento: "estrategia" });
    const ctxRisco: ContextoBia = {
      ...ctxComunicacao,
      textoDaConversa: "ele perdeu palavras que já falava, teve uma regressão",
    };
    const saida = selecionar([comum, encaminhamento], ctxRisco);
    expect(saida[0].chunk.id).toBe(encaminhamento.id);
    expect(saida[0].motivos.some((m) => m.codigo === "sinal_de_alerta")).toBe(true);
  });

  it("detecta sinal de risco sem se assustar com conversa comum", () => {
    expect(contextoTemSinalDeRisco({ textoDaConversa: "ele bate a cabeça na parede" })).toBe(true);
    expect(contextoTemSinalDeRisco({ textoDaConversa: "ele perdeu habilidades" })).toBe(true);
    expect(contextoTemSinalDeRisco({ textoDaConversa: "não come há três dias" })).toBe(true);
    // Rotina difícil não é risco à vida.
    expect(contextoTemSinalDeRisco({ textoDaConversa: "a hora do banho tá impossível" })).toBe(
      false,
    );
    expect(contextoTemSinalDeRisco({ textoDaConversa: "ele não quis comer o almoço" })).toBe(
      false,
    );
    expect(contextoTemSinalDeRisco({})).toBe(false);
  });

  it("o núcleo 'fundamentos' é penalizado — já vive no Core da Ayla", () => {
    const parteUm = chunk({ nucleo: "fundamentos", tipo_conhecimento: "fundamento" });
    const [r] = selecionar([parteUm], { ...ctxComunicacao, dominio: null }, { scoreMinimo: -999 });
    expect(r?.motivos.some((m) => m.codigo === "penalidade")).toBe(true);
    expect(r?.score).toBeLessThan(0);
  });
});

describe("seleção e diversidade", () => {
  it("respeita o teto por tipo — não devolve só regras", () => {
    const regras = Array.from({ length: 6 }, () =>
      chunk({ tipo_conhecimento: "regra_operacional" }),
    );
    const pergunta = chunk({ tipo_conhecimento: "pergunta_investigativa" });
    const saida = selecionar([...regras, pergunta], ctxComunicacao, {
      limite: 4,
      maxPorTipo: 3,
    });
    const tipos = saida.map((r) => r.chunk.tipo_conhecimento);
    expect(tipos.filter((t) => t === "regra_operacional")).toHaveLength(3);
    expect(tipos).toContain("pergunta_investigativa");
  });

  it("respeita o limite", () => {
    const muitos = Array.from({ length: 20 }, () => chunk());
    expect(selecionar(muitos, ctxComunicacao, { limite: 3 })).toHaveLength(3);
  });

  it("empate desempata pela ordem no documento (estável)", () => {
    const a = chunk({ ordem: 10 });
    const b = chunk({ ordem: 2 });
    const saida = selecionar([a, b], ctxComunicacao);
    expect(saida[0].chunk.ordem).toBe(2);
  });

  it("sem nada em comum, não devolve nada — silêncio é melhor que ruído", () => {
    const alheio = chunk({
      nucleo: "motor",
      titulo: "Circuito de equilíbrio",
      secao: "Circuito de equilíbrio",
      tipo_conhecimento: "brincadeira",
      texto_original: "Fita crepe no chão para andar como se fosse uma ponte.",
    });
    const saida = selecionar([alheio], {
      dominio: "sono",
      textoDaConversa: "xxxxx yyyyy zzzzz",
    });
    expect(saida).toHaveLength(0);
  });
});

describe("explicabilidade", () => {
  it("todo resultado informa POR QUE foi selecionado", () => {
    const c = chunk({
      tipo_conhecimento: "estrategia",
      situacoes_relacionadas: ["escola"],
      diagnosticos_relacionados: ["tea"],
      faixa_etaria_min_meses: 36,
      faixa_etaria_max_meses: 60,
      faixa_rotulo: "3-5 anos",
    });
    const [r] = selecionar([c], ctxComunicacao);

    const codigos = r.motivos.map((m) => m.codigo);
    expect(codigos).toContain("dominio");
    expect(codigos).toContain("faixa_etaria");
    expect(codigos).toContain("tipo");

    // A explicação é legível e some com nada.
    expect(r.explicacao).toContain("Comunicação");
    expect(r.explicacao).toContain("faixa etária compatível");
    expect(r.explicacao).toContain("estratégia");
    // E o score é a soma dos pesos — sem número mágico solto.
    expect(r.score).toBe(r.motivos.reduce((s, m) => s + m.peso, 0));
  });

  it("a correspondência textual aparece e diz quais termos casaram", () => {
    const c = chunk({
      nucleo: "sono",
      titulo: "Despertares noturnos",
      secao: "Despertares noturnos",
      texto_original: "Sobre os despertares noturnos e como voltar a dormir.",
    });
    const [r] = selecionar([c], {
      dominio: "sono",
      textoDaConversa: "ela tem despertares noturnos toda madrugada",
    });
    const textual = r.motivos.find((m) => m.codigo === "texto");
    expect(textual).toBeTruthy();
    expect(textual!.descricao).toContain("despertares");
  });

  it("a contribuição textual tem teto — texto longo não compra posição", () => {
    const longo = chunk({
      nucleo: "sono",
      titulo: "sono",
      secao: "sono",
      texto_original: Array.from({ length: 200 }, (_, i) => `termo${i}`).join(" "),
    });
    const ctx: ContextoBia = {
      dominio: "sono",
      textoDaConversa: Array.from({ length: 200 }, (_, i) => `termo${i}`).join(" "),
    };
    const [r] = selecionar([longo], ctx);
    const textual = r.motivos.find((m) => m.codigo === "texto");
    expect(textual!.peso).toBeLessThanOrEqual(PESOS.textoMaximo);
  });

  it("pontua por COBERTURA da pergunta, não por tamanho do chunk", () => {
    // Curto e certeiro: cobre os dois termos perguntados.
    const certeiro = chunk({
      nucleo: "sono",
      titulo: null,
      secao: null,
      texto_original: "Sobre despertares e madrugada.",
    });
    // Longo e disperso: cobre um só, afogado em texto.
    const disperso = chunk({
      nucleo: "sono",
      titulo: null,
      secao: null,
      texto_original:
        "madrugada " + Array.from({ length: 300 }, (_, i) => `assunto${i}`).join(" "),
    });
    const ctx: ContextoBia = { dominio: "sono", textoDaConversa: "despertares madrugada" };
    const saida = selecionar([disperso, certeiro], ctx);
    expect(saida[0].chunk.id).toBe(certeiro.id);
  });

  it("dentro do mesmo núcleo, quem responde à pergunta vence quem só cita o diagnóstico", () => {
    // O caso real medido na bancada em 30/07: a regra que responde à pergunta
    // perdia para um conceito genérico que apenas mencionava autismo.
    const regraQueResponde = chunk({
      nucleo: "comunicacao",
      titulo: "14. Conhecimento para IA",
      secao: "14. Conhecimento para IA",
      tipo_conhecimento: "regra_operacional",
      diagnosticos_relacionados: [],
      texto_original:
        "SE a criança puxa a mão do adulto como ferramenta para alcançar algo sem fazer contato visual, ENTÃO deduzir intenção comunicativa com déficit de atenção compartilhada.",
    });
    const genericoComTea = chunk({
      nucleo: "comunicacao",
      titulo: "6. Mecanismos",
      secao: "6. Mecanismos",
      tipo_conhecimento: "conceito",
      diagnosticos_relacionados: ["tea"],
      texto_original:
        "O cérebro de uma pessoa com autismo funciona e aprende de maneira diferente, não errada.",
    });

    const saida = selecionar([genericoComTea, regraQueResponde], {
      idadeAnos: 3,
      perfil: "TEA",
      dominio: "comunicacao",
      textoDaConversa: "ele puxa minha mão até o armário sem fazer contato visual",
    });
    expect(saida[0].chunk.id).toBe(regraQueResponde.id);
  });
});

describe("normalização do contexto", () => {
  it("converte anos em meses e mapeia domínio → núcleos", () => {
    const n = normalizarContexto({ idadeAnos: 4, dominio: "nutricional" });
    expect(n.idadeMeses).toBe(48);
    expect(n.nucleosDoDominio).toEqual(["alimentacao"]);
  });

  it("idadeMeses tem precedência sobre idadeAnos", () => {
    expect(normalizarContexto({ idadeAnos: 4, idadeMeses: 30 }).idadeMeses).toBe(30);
  });

  it("um domínio pode alimentar mais de um núcleo", () => {
    // `emocional` serve Regulação Emocional E o capítulo transversal de crenças.
    const n = normalizarContexto({ dominio: "emocional" });
    expect(n.nucleosDoDominio).toContain("regulacao_emocional");
    expect(n.nucleosDoDominio).toContain("pensamentos_crencas");
  });

  it("reconhece o diagnóstico como a família escreve", () => {
    expect(normalizarContexto({ perfil: "TEA nível 1" }).diagnosticos).toContain("tea");
    expect(normalizarContexto({ perfil: "autismo e TDAH" }).diagnosticos).toEqual(
      expect.arrayContaining(["tea", "tdah"]),
    );
  });
});

describe("relato curto não vira pertinência (calibração da cobertura)", () => {
  /**
   * Achado da bancada: "oi Ayla, tudo bem?" recuperava regra operacional
   * aleatória e injetava ~614 tokens no prompt. Duas causas, dois testes.
   */

  it("saudação não gera nenhum termo de busca", () => {
    expect(termos("oi Ayla, tudo bem?").size).toBe(0);
    expect(termos("bom dia, obrigada!").size).toBe(0);
    // Mas relato de verdade continua gerando termos.
    expect(termos("ele acorda de madrugada").size).toBeGreaterThan(1);
  });

  it("cobrir 1 termo de 1 não vale o mesmo que cobrir 3 de 3", () => {
    const chunk = (texto: string) => ({
      id: texto.slice(0, 8),
      nucleo: "sono" as const,
      secao: null,
      titulo: null,
      tipo_conhecimento: "conceito" as const,
      faixa_etaria_min_meses: null,
      faixa_etaria_max_meses: null,
      faixa_rotulo: null,
      situacoes_relacionadas: [],
      diagnosticos_relacionados: [],
      nivel_de_cautela: "baixo" as const,
      muda_conduta: null,
      texto_original: texto,
      revisao_pendente: false,
      ordem: 1,
    });

    const alvo = chunk("madrugada");
    const curto = pontuar(alvo, normalizarContexto({ textoDaConversa: "madrugada" }));
    const longo = pontuar(
      chunk("madrugada despertar noturno"),
      normalizarContexto({ textoDaConversa: "madrugada despertar noturno" }),
    );

    const texto = (r: ReturnType<typeof pontuar>) =>
      r?.motivos.find((m) => m.codigo === "texto")?.peso ?? 0;

    // Os dois cobrem 100% do que foi perguntado, mas um cobre 1 termo e o outro
    // 3. Sem o piso, os dois valiam igual.
    expect(texto(curto)).toBeLessThan(texto(longo));
  });
});
