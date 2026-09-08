import { describe, expect, it } from "vitest";
import { perfilConsultavelDaLinha } from "@/lib/kolo-vivo/consultar";
import {
  escolherLacunaDecisiva,
  blocoDaLacuna,
  jaRespondidas,
  deveGravarLacuna,
} from "./lacuna-decisiva";

/**
 * BANCADA DO GATE B — 7 situações × 3 perfis.
 *
 * ⚠️ O QUE ESTA BANCADA MEDE. Não "a Ayla perguntou bonito", e sim a decisão que
 * antecede a pergunta: **existe alguma informação ausente cuja resposta mudaria
 * materialmente o que devo orientar agora?** Se não existe, NO ASK — e campo
 * vazio continua vazio.
 *
 * ⚠️ O CORAÇÃO É A COMPARAÇÃO. A mesma frase, com Perfil diferente, tem de
 * produzir decisão diferente. É isso que separa personalização de formulário.
 */

const PERFIL_VAZIO = {};

/** Só o que o onboarding costuma deixar: um domínio marcado, sem detalhe. */
const perfilParcial = (dominio: string) => ({
  categorias_extras: { [dominio]: { texto: "Precisa de atenção" } },
});

/**
 * Perfil RICO — o formato real do banco: cada domínio é `{ texto }` com os
 * subcampos separados por `\n`, como `subcampos.ts` grava.
 */
const L = (partes: string[]) => partes.join("\n");
const PERFIL_RICO = {
  sensorial: {
    texto: L([
        "Perfil sensorial: Hipersensível",
        "Reação a sons: incomoda muito com barulho alto",
        "Reação a toques: aceita abraço apertado",
        "Movimento: busca balanço",
        "Luz: pouca sensibilidade",
      ]),
  },
  categorias_extras: {
    emocional: {
      texto: L([
        "Como costuma ser: Desregula com facilidade",
        "Gatilhos: insistência; mudanças abruptas de planos",
        "Sinais de que vem vindo: fica em silêncio",
        "O que ajuda a passar: sair do ambiente e esperar",
      ]),
    },
    comunicacao: {
      texto: L([
        "Como se comunica: Fala frases curtas",
        "Como mostra o que quer: aponta e puxa pela mão",
        "Como demonstra que entende: segue pedidos simples",
        "Contato visual e gestos: olha quando chamado",
        "Mostra o que quer ou espera?: inicia trocas com adultos",
        "Vocabulário e fala: cerca de 50 palavras",
      ]),
    },
    sono: {
      texto: L([
        "Como costuma ser o sono: Sono irregular",
        "Como adormece: precisa de companhia",
        "Despertares: acorda duas vezes",
        "O que atrapalha: barulho da rua",
      ]),
    },
    socializacao: {
      texto: L([
        "Como é socializar pra ele(a): Custa / cansa",
        "Interage com outras pessoas (pares): Às vezes",
        "Com quem flui melhor: Adultos",
      ]),
    },
    rotina: {
      texto: L([
        "Como lida com a rotina: Precisa de previsibilidade",
        "O que ajuda nas transições: avisar antes",
        "Como você avisa mudanças: aviso de 10 minutos",
      ]),
    },
    foco: {
      texto: L([
        "Como é o foco: Foca no que gosta",
        "O que dispersa: barulho",
        "Por quanto tempo sustenta: poucos minutos",
      ]),
    },
    escola: {
      texto: L(["Como é a escola hoje: difícil de manhã", "Queixas / dificuldades: não quer entrar", "O que funciona: professora de apoio"]),
    },
    nutricional: {
      texto: L([
        "Seletividade alimentar: Alta",
        "Texturas que rejeita: moles",
        "Dificuldades na alimentação: engasga com pedaços",
      ]),
    },
  },
};

const decidir = (linha: object, temas: string[], relato = "") =>
  escolherLacunaDecisiva({
    perfil: perfilConsultavelDaLinha(linha as Record<string, unknown>, "m1"),
    temas,
    relato,
  });

/** As 7 situações do bench, com o tema que o decisor do turno atribuiria. */
const SITUACOES: Array<{ nome: string; frase: string; temas: string[] }> = [
  { nome: "1 · grita (vago)", frase: "Ele grita.", temas: ["emocional"] },
  {
    nome: "2 · grita ao desligar o tablet",
    frase: "Ele grita quando desligo o tablet.",
    temas: ["emocional", "transicoes"],
  },
  {
    nome: "3 · não brinca com outras crianças",
    frase: "Ela não brinca com outras crianças.",
    temas: ["socializacao"],
  },
  { nome: "4 · não quer ir à escola", frase: "Ele não quer ir para a escola.", temas: ["escola"] },
  { nome: "5 · banho é uma luta", frase: "Banho é uma luta.", temas: ["rotina", "sensorial"] },
  { nome: "6 · não consegue esperar", frase: "Ele não consegue esperar.", temas: ["emocional"] },
  { nome: "7 · não dorme bem", frase: "Ela não dorme bem.", temas: ["sono"] },
];

describe("BANCADA 7 × 3 — a mesma frase, três perfis, decisões diferentes", () => {
  for (const s of SITUACOES) {
    it(`${s.nome}`, () => {
      const vazio = decidir(PERFIL_VAZIO, s.temas, s.frase);
      const rico = decidir(PERFIL_RICO, s.temas, s.frase);

      // PERFIL VAZIO → há o que perguntar, e é UMA coisa só.
      expect(vazio.escolhida, `${s.nome}: perfil vazio deveria ter lacuna`).not.toBeNull();
      expect(vazio.motivo).toBeTruthy();

      // PERFIL RICO → o que importa já se sabe. NO ASK é resultado CORRETO.
      expect(
        rico.escolhida,
        `${s.nome}: perfil rico ainda pediu "${rico.escolhida?.campo}"`,
      ).toBeNull();

      // A DECISÃO MUDOU COM O PERFIL — é a prova da personalização.
      expect(vazio.escolhida?.campo).not.toBe(rico.escolhida?.campo);
    });
  }

  it("nunca mais de uma lacuna vai ao prompt", () => {
    for (const s of SITUACOES) {
      const d = decidir(PERFIL_VAZIO, s.temas, s.frase);
      const bloco = blocoDaLacuna(d);
      expect((bloco.match(/<lacuna_decisiva>/g) ?? []).length).toBeLessThanOrEqual(1);
      // Uma linha, não uma lista.
      expect(bloco.split("\n").length).toBeLessThanOrEqual(1);
    }
  });

  it("NO ASK não produz texto nenhum — nem cabeçalho vazio", () => {
    for (const s of SITUACOES) {
      expect(blocoDaLacuna(decidir(PERFIL_RICO, s.temas, s.frase))).toBe("");
    }
  });

  it("perfil PARCIAL fica no meio: o domínio marcado não vira pergunta sobre ele", () => {
    // O onboarding marca o domínio sem detalhe. Isso não é "sabemos", mas
    // também não pode virar cinco perguntas.
    const d = decidir(perfilParcial("emocional"), ["emocional"], "Ele grita.");
    expect(d.candidatas).toBeGreaterThan(0);
    expect(d.escolhida).not.toBeNull();
  });
});

describe("sem tema, sem pergunta", () => {
  it("tema desconhecido → NO ASK, nunca um campo qualquer", () => {
    const d = decidir(PERFIL_VAZIO, [], "sei lá, tá difícil");
    expect(d.escolhida).toBeNull();
    expect(d.dominios).toEqual([]);
  });

  it("perfil ausente → NO ASK, e a Ayla orienta assim mesmo", () => {
    const d = escolherLacunaDecisiva({ perfil: null, temas: ["emocional"] });
    expect(d.escolhida).toBeNull();
    expect(d.candidatas).toBe(0);
  });
});

describe("A ORDEM DA PÓS — mecanismo antes do rótulo", () => {
  it("A · dispersão em ambiente PÚBLICO investiga o sensorial antes do foco", () => {
    const publico = decidir(PERFIL_VAZIO, ["foco"], "Ele não para quieto no shopping, se dispersa.");
    const casa = decidir(PERFIL_VAZIO, ["foco"], "Ele se dispersa na lição em casa.");
    expect(publico.escolhida?.dominio, "público deveria puxar sensorial").toBe("sensorial");
    expect(casa.escolhida?.dominio, "em casa segue a ordem declarada").toBe("foco");
    expect(publico.motivo).toContain("pos §7");
  });

  it("B · fala atrasada + 'entende tudo' investiga os marcos pré-verbais", () => {
    const d = decidir(
      PERFIL_VAZIO,
      ["comunicacao"],
      "Ele quase não fala, mas entende tudo o que eu mando.",
    );
    expect(["contato", "mostra", "entende"]).toContain(d.escolhida?.campo);
    expect(d.escolhida?.campo).not.toBe("vocabulario");
    expect(d.motivo).toContain("pos §7");
  });

  it("C · a escada: o degrau MAIS BAIXO desconhecido vem primeiro", () => {
    const d = decidir(PERFIL_VAZIO, ["comunicacao"], "Ela não fala ainda.");
    expect(d.escolhida?.campo, "deveria começar pela atenção social").toBe("contato");
    expect(d.motivo).toContain("pos §3");
  });

  it("C · degrau de baixo já conhecido não é reperguntado — sobe a escada", () => {
    const comContato = {
      categorias_extras: {
        comunicacao: { texto: L(["Contato visual e gestos: olha quando chamado", "Como mostra o que quer: aponta"]) },
      },
    };
    const d = decidir(comContato, ["comunicacao"], "Ela não fala ainda.");
    expect(d.escolhida?.campo).not.toBe("contato");
    expect(d.escolhida?.campo).not.toBe("mostra");
  });

  it("a escada NÃO é checklist: com tudo sabido, é NO ASK", () => {
    const d = decidir(PERFIL_RICO, ["comunicacao"], "Ela não fala ainda.");
    expect(d.escolhida).toBeNull();
  });
});

describe("jaRespondidas — o fato já disponível, não a pergunta já feita", () => {
  const fala = (direcao: string, lacuna?: string, membro = "m1", texto = "ele fica bravo quando eu insisto") => ({
    direcao,
    texto,
    metadata: lacuna ? { lacuna } : null,
    membro_atipico_id: membro,
  });

  it("perguntou e a família respondeu → o campo fecha", () => {
    const r = jaRespondidas(
      [fala("inbound"), fala("outbound", "emocional.gatilhos"), fala("inbound")],
      "m1",
    );
    expect(r.fechadas.has("emocional.gatilhos")).toBe(true);
  });

  it("perguntou e a família NÃO respondeu → continua em aberto", () => {
    const r = jaRespondidas([fala("inbound"), fala("outbound", "emocional.gatilhos")], "m1");
    expect(r.fechadas.size).toBe(0);
  });

  it("ISOLAMENTO: o que a Manu respondeu não fecha a lacuna do Mario", () => {
    const falas = [fala("outbound", "emocional.gatilhos", "manu"), fala("inbound", undefined, "manu")];
    expect(jaRespondidas(falas, "manu").fechadas.has("emocional.gatilhos")).toBe(true);
    expect(jaRespondidas(falas, "mario").fechadas.size).toBe(0);
  });

  it("a lacuna já respondida deixa de ser CANDIDATA — garantia estrutural", () => {
    const semJa = escolherLacunaDecisiva({
      perfil: perfilConsultavelDaLinha(PERFIL_VAZIO as Record<string, unknown>, "m1"),
      temas: ["emocional"],
      relato: "Ele grita.",
    });
    const comJa = escolherLacunaDecisiva({
      perfil: perfilConsultavelDaLinha(PERFIL_VAZIO as Record<string, unknown>, "m1"),
      temas: ["emocional"],
      relato: "Ele grita.",
      jaRespondido: new Set([`${semJa.escolhida?.dominio}.${semJa.escolhida?.campo}`]),
    });
    // Não é "o modelo se comportou bem": o campo não chega sequer a ser candidato.
    expect(comJa.escolhida?.campo).not.toBe(semJa.escolhida?.campo);
    expect(comJa.candidatas).toBe(semJa.candidatas - 1);
  });
});

describe("o bloco que vai ao prompt", () => {
  it("é UMA linha, cita o rótulo humano e manda ajudar no mesmo turno", () => {
    const d = decidir(PERFIL_VAZIO, ["emocional"], "Ele grita.");
    const b = blocoDaLacuna(d);
    expect(b).toContain("<lacuna_decisiva>");
    expect(b).toContain(d.escolhida!.label);
    expect(b).toMatch(/MESMO turno/);
    expect(b).toMatch(/Nunca pergunte mais de uma coisa/);
  });

  it("não vaza o motivo interno nem o nome do campo técnico", () => {
    const d = decidir(PERFIL_VAZIO, ["emocional"], "Ele grita.");
    const b = blocoDaLacuna(d);
    expect(b).not.toContain(d.motivo!);
    expect(b).not.toContain("emocional.");
  });
});

/**
 * MULTITURNO — a prova de que a conversa AFUNILA.
 *
 * ⚠️ O bench 7×3 prova o mecanismo num turno. Este prova a continuidade: o que
 * a família respondeu no turno 2 não pode voltar como pergunta no turno 4, nem
 * com outra redação — porque a chave é o CAMPO, não o texto.
 */
describe("MULTITURNO — Ele grita → … → como ensino a falar em vez de gritar", () => {
  const M = "manu";
  type F = {
    direcao: string;
    texto?: string | null;
    metadata?: Record<string, unknown> | null;
    membro_atipico_id?: string | null;
  };

  const rodar = (falas: F[], temas: string[], relato: string) => {
    const resolvidas = jaRespondidas(falas, M);
    const d = escolherLacunaDecisiva({
      perfil: perfilConsultavelDaLinha(PERFIL_VAZIO as Record<string, unknown>, M),
      temas,
      relato,
      resolvidas,
    });
    return { d, resolvidas };
  };

  it("os cinco turnos afunilam: nenhuma pergunta se repete", () => {
    const falas: F[] = [];
    const perguntados: string[] = [];
    const chave = (d: ReturnType<typeof escolherLacunaDecisiva>) =>
      d.escolhida ? `${d.escolhida.dominio}.${d.escolhida.campo}` : null;

    // T1 · "Ele grita."
    falas.push({ direcao: "inbound", texto: "Ele grita.", membro_atipico_id: M });
    let r = rodar(falas, ["emocional"], "Ele grita.");
    expect(r.d.decisao).toBe("ASK");
    perguntados.push(chave(r.d)!);
    falas.push({ direcao: "outbound", texto: "...", metadata: { lacuna: perguntados[0] }, membro_atipico_id: M });

    // T2 · a família responde de verdade
    falas.push({
      direcao: "inbound",
      texto: "Acontece quando eu insisto para ele parar de brincar",
      membro_atipico_id: M,
    });
    r = rodar(falas, ["emocional"], "Acontece quando eu insisto para ele parar de brincar");
    expect(r.resolvidas.fechadas.has(perguntados[0]), "T2 deveria ter fechado a lacuna do T1").toBe(true);
    expect(chave(r.d)).not.toBe(perguntados[0]);
    if (chave(r.d)) {
      perguntados.push(chave(r.d)!);
      falas.push({ direcao: "outbound", texto: "...", metadata: { lacuna: perguntados[1] }, membro_atipico_id: M });
    }

    // T3 · informação nova
    falas.push({
      direcao: "inbound",
      texto: "Ele fica em silencio e depois comeca a bater o pe antes de gritar",
      membro_atipico_id: M,
    });
    r = rodar(falas, ["emocional"], "Ele fica em silencio e depois comeca a bater o pe");
    const t3 = chave(r.d);
    expect(perguntados, "T3 repetiu uma pergunta anterior").not.toContain(t3);
    if (t3) {
      perguntados.push(t3);
      falas.push({ direcao: "outbound", texto: "...", metadata: { lacuna: t3 }, membro_atipico_id: M });
    }

    // T4 · "O que eu faco nessa hora?"
    falas.push({ direcao: "inbound", texto: "O que eu faco nessa hora?", membro_atipico_id: M });
    r = rodar(falas, ["emocional"], "O que eu faco nessa hora?");
    expect(perguntados, "T4 repetiu uma pergunta anterior").not.toContain(chave(r.d));

    // T5 · "E como ensino ele a falar em vez de gritar?"
    falas.push({
      direcao: "inbound",
      texto: "E como ensino ele a falar em vez de gritar?",
      membro_atipico_id: M,
    });
    r = rodar(falas, ["emocional", "comunicacao"], "E como ensino ele a falar em vez de gritar?");
    expect(perguntados, "T5 repetiu uma pergunta anterior").not.toContain(chave(r.d));

    // A PROVA DO AFUNILAMENTO: cada turno perguntou coisa diferente.
    expect(new Set(perguntados).size).toBe(perguntados.length);
    expect(r.resolvidas.fechadas.size).toBeGreaterThanOrEqual(perguntados.length - 1);
  });
});

describe("RESPOSTAS DIFICEIS — o que fecha e o que nao fecha", () => {
  const casos: Array<[string, string, boolean]> = [
    ["resposta de conteudo", "Acontece quando eu insisto para ele parar", true],
    ["parcial", "as vezes", true],
    ["correcao", "Nao, isso nao acontece mais", true],
    ["nao sei", "nao sei", false],
    ["so confirma", "sim", false],
    ["curto", "ok", false],
    ["vazio", "", false],
  ];
  for (const [nome, texto, fecha] of casos) {
    it(`${nome} -> ${fecha ? "FECHA" : "nao fecha"}`, () => {
      const r = jaRespondidas(
        [
          { direcao: "outbound", metadata: { lacuna: "emocional.gatilhos" }, membro_atipico_id: "m1" },
          { direcao: "inbound", texto, membro_atipico_id: "m1" },
        ],
        "m1",
      );
      expect(r.fechadas.has("emocional.gatilhos")).toBe(fecha);
    });
  }

  it("nao sei NUNCA vira fato", () => {
    const r = jaRespondidas(
      [
        { direcao: "outbound", metadata: { lacuna: "emocional.gatilhos" }, membro_atipico_id: "m1" },
        { direcao: "inbound", texto: "nao sei", membro_atipico_id: "m1" },
      ],
      "m1",
    );
    expect(r.detalhe[0].resposta).toBe("nao_sabe");
    expect(r.fechadas.size).toBe(0);
  });
});

describe("CORRECAO VENCE HISTORICO", () => {
  it("nao acontece mais fecha a lacuna E fica marcada como correcao", () => {
    const r = jaRespondidas(
      [
        { direcao: "outbound", metadata: { lacuna: "emocional.gatilhos" }, membro_atipico_id: "m1" },
        { direcao: "inbound", texto: "Nao, isso nao acontece mais", membro_atipico_id: "m1" },
      ],
      "m1",
    );
    expect(r.fechadas.has("emocional.gatilhos")).toBe(true);
    expect(r.corrigidas.has("emocional.gatilhos")).toBe(true);
  });

  it("a correcao chega ao rastro do turno seguinte", () => {
    const resolvidas = jaRespondidas(
      [
        { direcao: "outbound", metadata: { lacuna: "emocional.gatilhos" }, membro_atipico_id: "m1" },
        { direcao: "inbound", texto: "Nao, isso nao acontece mais", membro_atipico_id: "m1" },
      ],
      "m1",
    );
    const d = escolherLacunaDecisiva({
      perfil: perfilConsultavelDaLinha(PERFIL_VAZIO as Record<string, unknown>, "m1"),
      temas: ["emocional"],
      relato: "e agora?",
      resolvidas,
    });
    expect(d.corrigidas).toContain("emocional.gatilhos");
    expect(d.jaRespondidas).toContain("emocional.gatilhos");
    expect(d.descartadas.some((x) => x.chave === "emocional.gatilhos")).toBe(true);
  });
});

describe("ISOLAMENTO ENTRE IRMAOS no multiturno", () => {
  it("a resposta da Manu nao fecha a lacuna do Mario", () => {
    const falas = [
      { direcao: "outbound", metadata: { lacuna: "emocional.gatilhos" }, membro_atipico_id: "manu" },
      { direcao: "inbound", texto: "Ela desregula quando muda a rotina", membro_atipico_id: "manu" },
    ];
    const daManu = escolherLacunaDecisiva({
      perfil: perfilConsultavelDaLinha(PERFIL_VAZIO as Record<string, unknown>, "manu"),
      temas: ["emocional"],
      resolvidas: jaRespondidas(falas, "manu"),
    });
    const doMario = escolherLacunaDecisiva({
      perfil: perfilConsultavelDaLinha(PERFIL_VAZIO as Record<string, unknown>, "mario"),
      temas: ["emocional"],
      resolvidas: jaRespondidas(falas, "mario"),
    });
    expect(daManu.escolhida?.campo).not.toBe("gatilhos");
    expect(doMario.escolhida?.campo, "o Mario perdeu a pergunta por causa da Manu").toBe("gatilhos");
  });
});

describe("O RASTRO DO DECISOR", () => {
  it("carrega candidatas, descartadas com motivo, escolhida e ASK/NO_ASK", () => {
    const d = decidir(PERFIL_VAZIO, ["emocional"], "Ele grita.");
    expect(d.decisao).toBe("ASK");
    expect(d.candidatasChaves.length).toBeGreaterThan(0);
    expect(d.descartadas.some((x) => x.motivo === "uma pergunta por turno")).toBe(true);
    expect(d.motivo).toBeTruthy();
  });

  it("NO_ASK tambem explica por que", () => {
    const semTema = decidir(PERFIL_VAZIO, [], "sei la");
    expect(semTema.decisao).toBe("NO_ASK");
    expect(semTema.descartadas[0].motivo).toBe("tema não identificado");

    const rico = decidir(PERFIL_RICO, ["sono"], "Ela nao dorme bem.");
    expect(rico.decisao).toBe("NO_ASK");
  });

  it("nao guarda uma palavra do que a familia escreveu", () => {
    const d = decidir(PERFIL_VAZIO, ["emocional"], "Ele grita muito quando eu desligo o tablet");
    const blob = JSON.stringify(d);
    expect(blob).not.toContain("tablet");
    expect(blob).not.toContain("grita");
  });
});

/**
 * BLOQUEADOR 2 — o texto acrescentado depois NAO pode virar ASK.
 *
 * ⚠️ MEDIDO no caminho vivo em 08/09/2026: a ponte do Plano sai como MENSAGEM
 * SEPARADA (`enviarEPersistir` com `texto: nudge`), nao concatenada em
 * `exp.texto`. Entao a fala examinada ja e pura. No Legacy e diferente
 * (`textoCompleto = ...\n\n${nudge}`) — e e por isso que `deveGravarLacuna`
 * recebe o texto por parametro: quem chama responde por passar a FALA, nunca o
 * pacote com CTA, ponte ou convite colados.
 */
describe("BLOQUEADOR 2 — gravar lacuna so quando a Ayla perguntou de fato", () => {
  const comLacuna = () => decidir(PERFIL_VAZIO, ["emocional"], "Ele grita.");
  const semLacuna = () => decidir(PERFIL_RICO, ["sono"], "Ela nao dorme bem.");

  const NUDGE_COM_PERGUNTA = "Quer que eu prepare um plano pra essa semana?";
  const NUDGE_SEM_PERGUNTA = "Preparei um plano pra essa semana. O link esta aqui.";
  const FALA_COM_PERGUNTA = "Vale reparar no que acontece antes. O que costuma disparar?";
  const FALA_SEM_PERGUNTA = "Antes de corrigir o grito, vale reparar no que acontece logo antes.";

  it("NO ASK + ponte COM pergunta -> nao grava", () => {
    // A ponte vai separada; mesmo que fosse colada, a decisao e NO ASK.
    expect(deveGravarLacuna(semLacuna(), FALA_SEM_PERGUNTA)).toBeNull();
    expect(deveGravarLacuna(semLacuna(), NUDGE_COM_PERGUNTA)).toBeNull();
  });

  it("ASK real + ponte SEM pergunta -> grava", () => {
    const d = comLacuna();
    const chave = deveGravarLacuna(d, FALA_COM_PERGUNTA);
    expect(chave).toBe(`${d.escolhida!.dominio}.${d.escolhida!.campo}`);
  });

  it("ASK real + ponte COM pergunta -> UMA lacuna, e a correta", () => {
    const d = comLacuna();
    const chave = deveGravarLacuna(d, FALA_COM_PERGUNTA);
    expect(chave).toBe(`${d.escolhida!.dominio}.${d.escolhida!.campo}`);
    expect(chave!.split(".").length).toBe(2);
  });

  it("NO ASK + ponte SEM pergunta -> nao grava", () => {
    expect(deveGravarLacuna(semLacuna(), FALA_SEM_PERGUNTA)).toBeNull();
  });

  it("ASK escolhido mas a Ayla NAO perguntou -> nao grava", () => {
    // O caso que mais importa: o Core §8 mandou ajudar sem perguntar, e o
    // modelo obedeceu. Marcar aqui faria o turno seguinte fechar um campo que
    // ninguem investigou.
    expect(deveGravarLacuna(comLacuna(), FALA_SEM_PERGUNTA)).toBeNull();
  });

  it("decisao ausente nunca grava", () => {
    expect(deveGravarLacuna(null, FALA_COM_PERGUNTA)).toBeNull();
  });
});

/**
 * BLOQUEADOR 3 — AFUNILAMENTO MEDIDO, sem impor curva.
 *
 * ⚠️ A METRICA NAO E "perguntou menos a cada turno". Isso produziria
 * comportamento artificial: um ASK legitimo, nascido de informacao nova, e
 * melhor que um NO ASK forcado. O que se mede e a INCERTEZA RELEVANTE caindo —
 * lacunas pertinentes que se fecham — e a ausencia de repeticao.
 */
describe("BLOQUEADOR 3 — afunilamento medido", () => {
  type F = {
    direcao: string;
    texto?: string | null;
    metadata?: Record<string, unknown> | null;
    membro_atipico_id?: string | null;
  };
  const M = "m1";

  /** Roda uma conversa e devolve as metricas do afunilamento. */
  function conversa(passos: Array<{ texto: string; temas: string[] }>, linha: object) {
    const falas: F[] = [];
    const metricas: Array<{
      candidatas: number;
      decisao: string;
      escolhida: string | null;
      fechadas: number;
      corrigidas: number;
    }> = [];
    const perguntados: string[] = [];

    for (const passo of passos) {
      falas.push({ direcao: "inbound", texto: passo.texto, membro_atipico_id: M });
      const resolvidas = jaRespondidas(falas, M);
      const d = escolherLacunaDecisiva({
        perfil: perfilConsultavelDaLinha(linha as Record<string, unknown>, M),
        temas: passo.temas,
        relato: passo.texto,
        resolvidas,
      });
      const chave = d.escolhida ? `${d.escolhida.dominio}.${d.escolhida.campo}` : null;
      metricas.push({
        candidatas: d.candidatas,
        decisao: d.decisao,
        escolhida: chave,
        fechadas: resolvidas.fechadas.size,
        corrigidas: resolvidas.corrigidas.size,
      });
      if (chave) {
        perguntados.push(chave);
        // Simula a Ayla tendo perguntado de fato.
        falas.push({ direcao: "outbound", texto: "e o que costuma disparar?", metadata: { lacuna: chave }, membro_atipico_id: M });
      } else {
        falas.push({ direcao: "outbound", texto: "orientacao sem pergunta.", membro_atipico_id: M });
      }
    }
    return { metricas, perguntados };
  }

  it("a incerteza relevante CAI: as candidatas diminuem conforme a familia responde", () => {
    const r = conversa(
      [
        { texto: "Ele grita.", temas: ["emocional"] },
        { texto: "Acontece quando eu insisto para ele parar de brincar", temas: ["emocional"] },
        { texto: "Ele fica em silencio e bate o pe antes", temas: ["emocional"] },
        { texto: "O que eu faco nessa hora?", temas: ["emocional"] },
      ],
      PERFIL_VAZIO,
    );
    const primeira = r.metricas[0].candidatas;
    const ultima = r.metricas[r.metricas.length - 1].candidatas;
    expect(ultima, "as candidatas deveriam cair ao longo da conversa").toBeLessThan(primeira);
    expect(r.metricas[r.metricas.length - 1].fechadas).toBeGreaterThan(0);
  });

  it("NENHUMA pergunta se repete — nem com outra redacao, porque a chave e o campo", () => {
    const r = conversa(
      [
        { texto: "Ele grita.", temas: ["emocional"] },
        { texto: "Acontece quando eu insisto para ele parar de brincar", temas: ["emocional"] },
        { texto: "Ele fica em silencio e bate o pe antes", temas: ["emocional"] },
        { texto: "E como ensino ele a falar em vez de gritar?", temas: ["emocional"] },
      ],
      PERFIL_VAZIO,
    );
    expect(new Set(r.perguntados).size).toBe(r.perguntados.length);
  });

  it("ASK -> NO ASK -> ASK e ACEITAVEL quando a informacao nova reabre decisao", () => {
    // O tema muda no meio: comunicacao traz lacunas proprias, legitimas.
    const r = conversa(
      [
        { texto: "Ele grita.", temas: ["emocional"] },
        { texto: "Acontece quando eu insisto", temas: ["emocional"] },
        { texto: "E como ensino ele a falar em vez de gritar?", temas: ["comunicacao"] },
      ],
      PERFIL_VAZIO,
    );
    const decisoes = r.metricas.map((m) => m.decisao);
    // Nao exigimos monotonia: exigimos que nenhum ASK seja repeticao.
    expect(new Set(r.perguntados).size).toBe(r.perguntados.length);
    expect(decisoes.length).toBe(3);
  });

  it("PERFIL SUFICIENTE: a Ayla orienta e acompanha sem NENHUMA pergunta", () => {
    const r = conversa(
      [
        { texto: "Ela nao dorme bem.", temas: ["sono"] },
        { texto: "Ontem acordou duas vezes", temas: ["sono"] },
        { texto: "O que eu faco?", temas: ["sono"] },
      ],
      PERFIL_RICO,
    );
    expect(r.perguntados, "com perfil rico nao deveria perguntar nada").toEqual([]);
    expect(r.metricas.every((m) => m.decisao === "NO_ASK")).toBe(true);
  });

  it("NAO e aceitavel perguntar so porque sobraram campos vazios", () => {
    // Depois de fechar a lacuna decisiva do tema, as candidatas restantes
    // precisam ser MENOS — nao um estoque infinito de formulario.
    const r = conversa(
      [
        { texto: "Ela nao dorme bem.", temas: ["sono"] },
        { texto: "Ela demora muito pra pegar no sono, quase uma hora", temas: ["sono"] },
        { texto: "E o que mais eu posso fazer?", temas: ["sono"] },
      ],
      PERFIL_VAZIO,
    );
    expect(r.metricas[2].candidatas).toBeLessThan(r.metricas[0].candidatas);
  });
});
