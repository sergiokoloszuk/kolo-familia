import { describe, expect, it } from "vitest";
import { perfilConsultavelDaLinha } from "@/lib/kolo-vivo/consultar";
import {
  escolherLacunaDecisiva,
  blocoDaLacuna,
  jaRespondidas,
  lacunaSugeridaDoTurno,
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
/**
 * MULTITURNO — o afunilamento agora vem do PERFIL (PEND-187A, 10/09/2026).
 *
 * ⚠️ ESTE BLOCO MEDIA O HISTORICO, e o historico deixou de fechar lacuna. A
 * versao anterior marcava a lacuna sugerida e a dava por respondida quando
 * qualquer fala vinha depois — foi assim que `sensorial.perfil` foi dado como
 * sabido por uma resposta sobre duracao de grito.
 *
 * ⚠️ O QUE SE MEDE AGORA e o mecanismo verdadeiro: a resposta da familia vira
 * FATO no Kolo Vivo, e `lacunasDe` para de oferecer o campo. Cada turno abaixo
 * recebe o perfil como ele fica DEPOIS da incorporacao do turno anterior.
 *
 * ⚠️ E A GARANTIA FICOU MAIS FRACA DE PROPOSITO: se a incorporacao nao
 * acontecer, a pergunta pode reaparecer. Repeticao ocasional e visivel e
 * branda; memoria falsa e invisivel e contamina o perfil de uma crianca.
 */
describe("MULTITURNO — o perfil cresce, as candidatas caem", () => {
  const comEmocional = (linhas: string[]) => ({
    categorias_extras: { emocional: { texto: L(linhas) } },
  });

  it("cada fato incorporado tira o campo da disputa", () => {
    const passos = [
      { perfil: {}, esperado: true },
      { perfil: comEmocional(["Gatilhos: insistencia"]), esperado: false },
      {
        perfil: comEmocional(["Gatilhos: insistencia", "Sinais de que vem vindo: fica em silencio"]),
        esperado: false,
      },
    ];
    const candidatas: number[] = [];
    for (const passo of passos) {
      const d = decidir(passo.perfil, ["emocional"], "Ele grita.");
      candidatas.push(d.candidatasChaves.length);
      expect(
        d.candidatasChaves.includes("emocional.gatilhos"),
        "gatilhos deveria sair da disputa depois de incorporado",
      ).toBe(passo.esperado);
    }
    expect(candidatas[2]).toBeLessThan(candidatas[0]);
  });

  it("NENHUMA repeticao do que o perfil ja sabe — a chave e o campo", () => {
    const cheio = comEmocional([
      "Como costuma ser: Desregula com facilidade",
      "Gatilhos: insistencia",
      "Sinais de que vem vindo: fica em silencio",
      "Como se manifesta: grita",
      "O que ajuda a passar: aviso antes",
      "O que NAO ajuda / piora: insistir",
    ]);
    const d = decidir(cheio, ["emocional"], "Ele grita.");
    for (const c of d.candidatasChaves) expect(c.startsWith("emocional.")).toBe(false);
  });

  it("ASK -> NO ASK -> ASK e ACEITAVEL quando o assunto muda", () => {
    const cheio = comEmocional([
      "Como costuma ser: Desregula",
      "Gatilhos: insistencia",
      "Sinais de que vem vindo: silencio",
      "Como se manifesta: grita",
      "O que ajuda a passar: aviso",
      "O que NAO ajuda / piora: insistir",
    ]);
    // Mesmo perfil, tema novo: as candidatas do tema novo sao legitimas.
    const emocional = decidir(cheio, ["emocional"], "Ele grita.");
    const comunicacao = decidir(cheio, ["comunicacao"], "E como ensino ele a pedir?");
    // ⚠️ NAO E "zero candidatas": o tema `emocional` tambem abre `sensorial` e
    // `comunicacao` (a regra da pos). O que o perfil cheio garante e que nenhum
    // campo DO EMOCIONAL volta a ser perguntado.
    expect(emocional.candidatasChaves.filter((c) => c.startsWith("emocional."))).toEqual([]);
    expect(comunicacao.candidatasChaves.length).toBeGreaterThan(0);
  });

  it("NAO e aceitavel perguntar so porque sobraram campos vazios", () => {
    // Sem tema, nenhum campo vazio vira pergunta — a regra de pertinencia.
    expect(decidir(PERFIL_VAZIO, [], "sei la").decisao).toBe("NO_ASK");
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

  it("a correcao continua VISIVEL no rastro — mas nao exclui mais", () => {
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
    // ⚠️ PEND-187A: o rastro continua mostrando o que o historico diz — e o
    // historico deixou de tirar candidata. Quem tira e o Perfil.
    expect(d.corrigidas).toContain("emocional.gatilhos");
    expect(d.jaRespondidas).toContain("emocional.gatilhos");
    expect(
      d.descartadas.some(
        (x) => x.chave === "emocional.gatilhos" && x.motivo === "ja respondido nesta conversa",
      ),
    ).toBe(false);
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
    // ⚠️ PEND-187A: nenhum dos dois fecha por historico. O que o isolamento
    // garante e que a fala sobre a Manu nao aparece no escopo do Mario.
    expect(jaRespondidas(falas, "mario").fechadas.size).toBe(0);
    expect(jaRespondidas(falas, "manu").fechadas.has("emocional.gatilhos")).toBe(true);
    expect(doMario.candidatasChaves, "o Mario perdeu a pergunta por causa da Manu").toContain(
      "emocional.gatilhos",
    );
    expect(daManu.decisao).toBe("ASK");
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
 * O QUE SE GRAVA — reescrito pela PEND-187A (10/09/2026).
 *
 * ⚠️ ESTE BLOCO MEDIA OUTRA COISA, e o que ele media deixou de existir de
 * proposito. `deveGravarLacuna` so gravava quando a fala continha "?", e a
 * ideia era "so marcar se a Ayla perguntou de fato". A heuristica provava que
 * houve UMA pergunta, nunca que foi ESTA — e em producao (09/09/2026) o Core
 * recebeu `sensorial.perfil` e perguntou sobre duracao da desregulacao, recebeu
 * `sensorial.toques` e perguntou sobre autoagressao. Marcou nos dois.
 *
 * ⚠️ ENTAO A GARANTIA MUDOU DE LUGAR, e nao sumiu. Antes ela dependia de
 * acertar quando marcar; agora nada do que se marca exclui candidata — a
 * exclusao vem do Perfil. Os casos "ponte com pergunta" e "CTA colado" que este
 * bloco protegia perderam o sentido: nao existe mais leitura de texto nenhuma.
 * As protecoes vivas estao em `lacuna-sugerida.test.ts`.
 */
describe("PEND-187A — a sugestao e gravada pelo que ela e, nao pelo texto", () => {
  const comLacuna = () => decidir(PERFIL_VAZIO, ["emocional"], "Ele grita.");
  const semLacuna = () => decidir(PERFIL_RICO, ["sono"], "Ela nao dorme bem.");

  it("ha escolha -> grava a chave", () => {
    const d = comLacuna();
    expect(lacunaSugeridaDoTurno(d)).toBe(`${d.escolhida!.dominio}.${d.escolhida!.campo}`);
  });

  it("NO ASK -> nao grava", () => {
    expect(lacunaSugeridaDoTurno(semLacuna())).toBeNull();
  });

  it("decisao ausente nunca grava", () => {
    expect(lacunaSugeridaDoTurno(null)).toBeNull();
  });

  it("O TEXTO DA FALA NAO ENTRA MAIS NA CONTA — e esse e o ponto", () => {
    // A funcao nem recebe a fala. Nao ha "?" para ler, nem ponte, nem CTA:
    // some a classe inteira de engano.
    expect(lacunaSugeridaDoTurno.length).toBe(1);
  });

  it("uma chave, sempre no formato dominio.campo", () => {
    const chave = lacunaSugeridaDoTurno(comLacuna())!;
    expect(chave.split(".").length).toBe(2);
  });
});

/**
 * AFUNILAMENTO MEDIDO — reescrito pela PEND-187A (10/09/2026).
 *
 * ⚠️ A VERSAO ANTERIOR SIMULAVA A CONVERSA e media a queda das candidatas pelo
 * HISTORICO: marcava a lacuna sugerida e a dava por respondida quando qualquer
 * fala vinha depois. Media, portanto, o mecanismo que produziu a memoria falsa
 * — e nao o afunilamento real.
 *
 * ⚠️ A REGUA CONTINUA A MESMA, e ela nunca foi "perguntou menos a cada turno":
 * um ASK legitimo, nascido de informacao nova, e melhor que um NO ASK forcado.
 * O que se mede e a INCERTEZA RELEVANTE caindo conforme a familia CONTA as
 * coisas — e agora ela cai porque o fato entrou no Perfil, que e onde ele mora.
 */
describe("AFUNILAMENTO — a incerteza cai conforme o Perfil aprende", () => {
  const comEmocional = (linhas: string[]) => ({
    categorias_extras: { emocional: { texto: linhas.join(String.fromCharCode(10)) } },
  });

  it("a incerteza relevante CAI a cada fato incorporado", () => {
    const vazio = decidir(PERFIL_VAZIO, ["emocional"], "Ele grita.");
    const um = decidir(comEmocional(["Gatilhos: insistencia"]), ["emocional"], "Ele grita.");
    const dois = decidir(
      comEmocional(["Gatilhos: insistencia", "Sinais de que vem vindo: silencio"]),
      ["emocional"],
      "Ele grita.",
    );
    expect(um.candidatasChaves.length).toBeLessThan(vazio.candidatasChaves.length);
    expect(dois.candidatasChaves.length).toBeLessThan(um.candidatasChaves.length);
  });

  it("NENHUMA pergunta se repete depois de o fato existir — a chave e o campo", () => {
    const d = decidir(comEmocional(["Gatilhos: insistencia"]), ["emocional"], "Ele grita.");
    expect(d.candidatasChaves).not.toContain("emocional.gatilhos");
    expect(d.escolhida ? `${d.escolhida.dominio}.${d.escolhida.campo}` : null).not.toBe(
      "emocional.gatilhos",
    );
  });

  it("PERFIL SUFICIENTE: a Ayla orienta e acompanha sem NENHUMA pergunta", () => {
    expect(decidir(PERFIL_RICO, ["sono"], "Ela nao dorme bem.").decisao).toBe("NO_ASK");
  });

  it("⚠️ O RISCO ACEITO: sem incorporacao, a pergunta PODE reaparecer", () => {
    // Isto nao e um defeito escondido — e a troca que a PEND-187A fez por
    // escrito. Enquanto o fato nao entra no Perfil, o campo segue candidato.
    // Repeticao ocasional e visivel e branda; memoria falsa e invisivel.
    const a = decidir(PERFIL_VAZIO, ["emocional"], "Ele grita.");
    const b = decidir(PERFIL_VAZIO, ["emocional"], "Ele grita de novo.");
    expect(a.escolhida?.campo).toBe(b.escolhida?.campo);
  });
});
