import { describe, it, expect } from "vitest";
import {
  montarContextoBase,
  interessesAtuais,
  desafiosAtuais,
  pareceInformacao,
  TETO_CONTEXTO_BASE,
} from "./experimental-contexto";
import { resolverFoco, blocoDeFoco } from "./experimental-foco";
import { eventosRelevantes, blocoDeEventos } from "./experimental-memoria";
import { BancoMemoria } from "./__harness/banco-memoria";

/**
 * O QUE A AYLA EXPERIMENTAL SABE — Fase 1, 15/08/2026.
 *
 * ⚠️ AS FIXTURES SÃO O DADO REAL DE PRODUÇÃO. Os perfis abaixo foram copiados
 * das três famílias de QA (Karina/Mario+Manu, Sérgio/André, Rosangela/Matheo).
 * Fixture inventada provaria o código contra a minha imaginação; estas provam
 * contra o que as famílias realmente têm — incluindo o lixo.
 */

const MARIO = { id: "m-mario", nome: "Mario" };
const MANU = { id: "m-manu", nome: "Manu" };

const PV_MANU = {
  como_e: {
    texto: "Adora uva passa.",
    interesses: ["Cozinha", "Dinossauro", "Massinha"],
  },
  desafios_regulacao: {
    texto: "Não monta frases ainda; comunicação verbal limitada a palavras soltas.",
    atualizado_em: "2026-05-24T01:50:16.475Z",
  },
  sensorial: {
    texto: "Reação a sons: cobre os ouvidos com barulhos altos — sensibilidade significativa.",
    atualizado_em: "2026-06-01T00:00:00.000Z",
  },
  categorias_extras: {
    preferencias: { temas: ["contos e princesas"], evitar: ["Massinha"] },
    sono: { texto: "Demora a pegar no sono.", atualizado_em: "2026-08-01T00:00:00.000Z" },
    nutricional: { texto: "Recusa texturas novas.", atualizado_em: "2026-07-01T00:00:00.000Z" },
    escola: { texto: "Chora na entrada.", atualizado_em: "2026-08-10T00:00:00.000Z" },
    motor: { texto: "Sobe escada com apoio.", atualizado_em: "2026-01-01T00:00:00.000Z" },
  },
};

const PV_MARIO = {
  como_e: { interesses: ["Carrinho", "Desenhar", "Agua"] },
  sensorial: { texto: "Presta mais atenção quando tem algo nas mãos durante tarefas." },
  categorias_extras: {},
};

/** A conta do Sérgio — o teste de robustez para dado imperfeito. */
const PV_ANDRE = {
  como_e: { interesses: ["Autismo e seus assuntos", "Quer ser influencer"] },
  corpo_rotina: { texto: "btbrtbtbtb" },
  categorias_extras: {},
};

describe("dado ruim não vira contexto", () => {
  it("MORDE: 'btbrtbtbtb' (caso real do André) não é informação", () => {
    expect(pareceInformacao("btbrtbtbtb")).toBe(false);
  });

  it("MORDE: e o filtro NÃO come informação legítima", () => {
    // Na dúvida, preservar. Descartar dado real de uma família é dano maior.
    for (const bom of [
      "Não monta frases ainda",
      "cobre os ouvidos com barulhos altos",
      "Adora uva passa.",
      "Chora na entrada da escola",
      "TEA",
      "Sobe escada com apoio",
    ]) {
      expect(pareceInformacao(bom), `descartou dado legítimo: "${bom}"`).toBe(true);
    }
  });

  it("descarta vazio, espaço e placeholder", () => {
    for (const ruim of ["", "   ", "a", "n/a", "teste", "xxx", "aaaaaa", "-"]) {
      expect(pareceInformacao(ruim), `passou lixo: "${ruim}"`).toBe(false);
    }
  });

  it("MORDE: o lixo do André não entra no retrato", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Sérgio",
      membro: { nome: "André", data_nascimento: "1986-11-26", diagnosticos_formais: [] },
      perfilVivo: PV_ANDRE,
    });
    expect(bloco, "mandou o lixo pro modelo").not.toContain("btbrtbtbtb");
    expect(bloco).toContain("André");
  });
});

describe("diagnóstico: o bug do array vazio", () => {
  it("MORDE: `[]` NÃO gera linha de diagnóstico", () => {
    // `[]` é truthy em JS — era isso que produzia
    // "Diagnóstico informado pela família: " sem conteúdo nenhum.
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Juliana",
      membro: { nome: "Manu", data_nascimento: "2020-03-01", diagnosticos_formais: [] },
      perfilVivo: PV_MANU,
    });
    expect(bloco).not.toContain("Diagnóstico informado");
  });

  it("diagnóstico de verdade aparece", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Juliana",
      membro: { nome: "Manu", data_nascimento: "2020-03-01", diagnosticos_formais: ["TEA nível 1"] },
      perfilVivo: PV_MANU,
    });
    expect(bloco).toContain("Diagnóstico informado pela família: TEA nível 1");
  });

  it("MORDE: `perfil` (o token de perfilPrimario) NÃO vira 'o que já sabemos'", () => {
    // `membros_atipicos.perfil` vale "TEA"|"TDAH"|…: um rótulo, não um resumo.
    // Apresentá-lo como conhecimento da criança foi o defeito da versão 1.
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Juliana",
      membro: { nome: "Manu", data_nascimento: "2020-03-01", diagnosticos_formais: [] },
      perfilVivo: PV_MANU,
    });
    expect(bloco).not.toMatch(/O que já sabemos: (TEA|TDAH|Outro|Dislexia)$/m);
  });
});

describe("o retrato traz o que importa", () => {
  const { bloco, lacunas } = montarContextoBase({
    nomeResponsavel: "Juliana",
    membro: { nome: "Manu", data_nascimento: "2020-03-01", diagnosticos_formais: [] },
    perfilVivo: PV_MANU,
  });

  it("MORDE: a comunicação atual chega", () => {
    expect(bloco).toContain("Não monta frases ainda");
  });

  it("MORDE: a sensibilidade chega", () => {
    expect(bloco).toContain("cobre os ouvidos");
  });

  it("MORDE: os interesses chegam", () => {
    expect(bloco).toContain("Interesses atuais:");
    expect(bloco).toContain("Dinossauro");
  });

  it("MORDE: os desafios chegam, os mais recentes primeiro", () => {
    expect(bloco).toContain("escola: Chora na entrada");
  });

  it("MORDE: o domínio ANTIGO também chega — se cabe, não se descarta", () => {
    // ⚠️ ESTE TESTE FOI INVERTIDO EM 18/08/2026, DELIBERADAMENTE.
    //
    // Ele afirmava `not.toContain("Sobe escada")` — `motor` é de janeiro e
    // ficava fora dos "3 mais recentes". Isso não era proteção: era o defeito.
    //
    // Caso Rosangela (17/08, produção): ela perguntou quais alimentos o filho
    // gosta; o perfil tinha "banana; maçã; melancia; mamão" salvo desde 07/08;
    // alimentação era o domínio mais ANTIGO entre cinco e foi cortada aqui. A
    // Ayla respondeu "não tenho registrado quais alimentos ele gosta".
    //
    // A ordem continua sendo por recência — o mais recente vem primeiro. O que
    // acabou é o descarte do que CABE no teto.
    expect(bloco, "o domínio mais antigo foi descartado mesmo cabendo").toContain(
      "Sobe escada",
    );
    // E a ordem não se perdeu: o mais recente continua na frente do mais velho.
    expect(bloco.indexOf("Chora na entrada")).toBeLessThan(bloco.indexOf("Sobe escada"));
  });

  it("respeita o teto de tamanho", () => {
    expect(bloco.length).toBeLessThanOrEqual(TETO_CONTEXTO_BASE);
  });

  it("não inventa lacuna do que já sabe", () => {
    expect(lacunas).not.toContain("interesses da criança");
    expect(lacunas).not.toContain("como a criança se comunica");
  });

  it("MORDE: aponta a lacuna real (Matheo não tem sensorial nem comunicação)", () => {
    const r = montarContextoBase({
      nomeResponsavel: "Rosangela",
      membro: { nome: "Matheo", data_nascimento: "2022-02-26", diagnosticos_formais: [] },
      perfilVivo: { como_e: { interesses: ["bichinhos", "música"] }, categorias_extras: {} },
    });
    expect(r.lacunas).toContain("como a criança se comunica");
    expect(r.bloco).toContain("bichinhos");
  });
});

describe("interesses: união das duas fontes, menos o que evitam", () => {
  it("MORDE: une `como_e.interesses` e `preferencias.temas`", () => {
    const i = interessesAtuais(PV_MANU);
    expect(i).toContain("Dinossauro"); // como_e
    expect(i).toContain("contos e princesas"); // preferencias.temas
  });

  it("MORDE: `evitar` tira da lista ATUAL", () => {
    // "Massinha" está em como_e.interesses E em evitar → sai dos atuais.
    expect(interessesAtuais(PV_MANU)).not.toContain("Massinha");
  });

  it("deduplica sem diferenciar maiúscula", () => {
    const i = interessesAtuais({
      como_e: { interesses: ["Dinossauro"] },
      categorias_extras: { preferencias: { temas: ["dinossauro", "Água"] } },
    });
    expect(i.filter((x) => /dinossauro/i.test(x))).toHaveLength(1);
  });

  it("perfil sem interesses devolve lista vazia, não quebra", () => {
    expect(interessesAtuais(null)).toEqual([]);
    expect(interessesAtuais({})).toEqual([]);
  });

  it("desafiosAtuais respeita o limite e ignora domínio desconhecido", () => {
    const d = desafiosAtuais(PV_MANU, 3);
    expect(d).toHaveLength(3);
    expect(d.join(" ")).not.toContain("preferencias");
  });
});

describe("FOCO: individual, compartilhado, ambíguo", () => {
  const db = () => {
    const b = new BancoMemoria();
    b.semear("ayla_messages", []);
    return b.cliente();
  };

  it("MORDE: filho único nunca é ambíguo", async () => {
    const f = await resolverFoco(db(), "fam", "hoje foi difícil", [MARIO]);
    expect(f.tipo).toBe("unica");
  });

  it("MORDE: nome citado define o foco", async () => {
    const f = await resolverFoco(db(), "fam", "a Manu não quis entrar na escola", [MARIO, MANU]);
    expect(f.tipo).toBe("individual");
    expect(f.membros.map((m) => m.nome)).toEqual(["Manu"]);
  });

  it("MORDE: 'agora quero falar do Mario' TROCA o foco", async () => {
    const f = await resolverFoco(db(), "fam", "agora quero falar do Mario", [MARIO, MANU]);
    expect(f.membros.map((m) => m.nome)).toEqual(["Mario"]);
  });

  it("MORDE: dois nomes → compartilhado", async () => {
    const f = await resolverFoco(db(), "fam", "Mario e Manu brigaram no carro", [MARIO, MANU]);
    expect(f.tipo).toBe("compartilhado");
    expect(f.membros).toHaveLength(2);
  });

  it("MORDE: 'os dois' → compartilhado, com as duas crianças", async () => {
    const f = await resolverFoco(db(), "fam", "os dois estão brigando muito", [MARIO, MANU]);
    expect(f.tipo).toBe("compartilhado");
    expect(f.membros).toHaveLength(2);
  });

  it("MORDE: 'uma brincadeira para os dois juntos' → compartilhado", async () => {
    const f = await resolverFoco(db(), "fam", "quero uma brincadeira pros dois fazerem juntos", [
      MARIO,
      MANU,
    ]);
    expect(f.tipo).toBe("compartilhado");
  });

  it("MORDE: sem sinal nenhum e dois filhos → AMBÍGUO, não escolhe", async () => {
    const f = await resolverFoco(db(), "fam", "hoje foi muito difícil", [MARIO, MANU]);
    expect(f.tipo, "escolheu uma criança no chute").toBe("ambiguo");
    expect(blocoDeFoco(f)).toMatch(/NÃO escolha por conta própria/);
    expect(blocoDeFoco(f)).toMatch(/pergunte de qual delas/);
  });

  it("nome dentro de outra palavra não conta", async () => {
    const f = await resolverFoco(db(), "fam", "fomos à Marioneteria ontem", [MARIO, MANU]);
    expect(f.tipo).toBe("ambiguo");
  });

  it("o bloco compartilhado avisa para não trocar as características", async () => {
    const f = await resolverFoco(db(), "fam", "os dois brigaram", [MARIO, MANU]);
    expect(blocoDeFoco(f)).toMatch(/o que vale para uma pode não valer para a outra/);
  });
});

describe("MEMÓRIA LONGITUDINAL: relevância por natureza e assunto", () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const antigo = "2026-01-05";
  const EVENTOS = [
    { data: "2026-07-24", tipo: "marco", descricao: "Progrediu no aprendizado de letras, até a letra G" },
    { data: "2026-08-12", tipo: "separacao", descricao: "Separação do casal em processo de divórcio" },
    { data: antigo, tipo: "ferias", descricao: "Viagem de férias para a praia" },
    { data: hoje, tipo: "mudanca_escola", descricao: "Mudou de escola neste mês" },
  ];

  it("MORDE: marco entra SEMPRE — é estado, não notícia", () => {
    const r = eventosRelevantes(EVENTOS, "quero uma brincadeira qualquer");
    expect(r.map((e) => e.tipo)).toContain("marco");
  });

  it("MORDE: evento SENSÍVEL não entra numa pergunta neutra", () => {
    const r = eventosRelevantes(EVENTOS, "quero uma brincadeira para trabalhar a letra G");
    expect(r.map((e) => e.tipo), "a separação vazou para um assunto neutro").not.toContain(
      "separacao",
    );
  });

  it("MORDE: evento sensível ENTRA quando o assunto o torna pertinente", () => {
    const r = eventosRelevantes(
      EVENTOS,
      "ela está muito grudada em mim e chorando quando eu saio",
    );
    expect(r.map((e) => e.tipo), "a separação ficou escondida quando ajudaria").toContain(
      "separacao",
    );
  });

  it("MORDE: evento temporário ANTIGO não polui a conversa", () => {
    const r = eventosRelevantes(EVENTOS, "ele não quer dormir");
    expect(r.map((e) => e.tipo)).not.toContain("ferias");
  });

  it("situação em andamento entra quando recente", () => {
    const r = eventosRelevantes(EVENTOS, "ele não quer dormir");
    expect(r.map((e) => e.tipo)).toContain("mudanca_escola");
  });

  it("MORDE: não existe corte cego por data — marco antigo continua entrando", () => {
    const r = eventosRelevantes(
      [{ data: "2025-01-01", tipo: "marco", descricao: "Começou a formar frases de duas palavras" }],
      "qualquer coisa",
    );
    expect(r).toHaveLength(1);
  });

  it("o bloco proíbe inventar causalidade", () => {
    const b = blocoDeEventos([EVENTOS[1]]);
    expect(b).toMatch(/NÃO afirme que um comportamento é causado/);
  });

  it("sem eventos relevantes, nenhum bloco é montado", () => {
    expect(blocoDeEventos([])).toBe("");
  });
});
