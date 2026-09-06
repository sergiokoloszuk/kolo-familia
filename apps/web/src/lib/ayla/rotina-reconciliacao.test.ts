import { describe, expect, it } from "vitest";
import { comecoDaConversaDeOrigem, decidirReconciliacao, TETO_RECONCILIACAO_MS } from "./rotina-reconciliacao";

/**
 * A BANCADA DO RECONCILIADOR — os casos são nominais de propósito. Cada um tem
 * nome de família real ou de defeito real, porque a regra que eles prendem
 * nasceu de uma conversa que aconteceu, não de uma hipótese.
 */

const t = (base: string, minutos: number) =>
  new Date(new Date(base).getTime() + minutos * 60_000).toISOString();

describe("MARIA JULIA — rotina de 03/09, tema dito dois minutos depois", () => {
  const nasceu = "2026-09-03T02:19:00.000Z";
  const r = decidirReconciliacao({
    rotinaCriadaEm: nasceu,
    mensagens: [
      { texto: "Perfeito princesa frozen então.", created_at: t(nasceu, 4) },
      { texto: "Desenho de princesa", created_at: t(nasceu, 2) },
    ],
  });
  it("recupera o tema", () => {
    expect(r.decisao).toBe("recuperar");
    if (r.decisao === "recuperar") expect(r.tema).toBe("princesa frozen");
  });
  it("87 horas depois ainda está dentro do teto de 7 dias", () => {
    expect(87 * 3600_000).toBeLessThan(TETO_RECONCILIACAO_MS);
  });
});

describe("MANU — rotina de hoje, 'Tema princesa'", () => {
  const nasceu = "2026-09-06T14:00:00.000Z";
  it("recupera princesa", () => {
    const r = decidirReconciliacao({
      rotinaCriadaEm: nasceu,
      mensagens: [{ texto: "Tema princesa", created_at: t(nasceu, 3) }],
    });
    expect(r.decisao).toBe("recuperar");
    if (r.decisao === "recuperar") expect(r.tema).toBe("princesa");
  });
});

describe("GERE — a autorização nunca vira tema", () => {
  it("pergunta, não infere", () => {
    const nasceu = "2026-09-06T14:00:00.000Z";
    const r = decidirReconciliacao({
      rotinaCriadaEm: nasceu,
      mensagens: [
        { texto: "Gere", created_at: t(nasceu, 5) },
        { texto: "Sim", created_at: t(nasceu, 2) },
      ],
    });
    expect(r.decisao).toBe("perguntar");
  });
});

describe("TEMA ANTIGO, ANTERIOR À CRIAÇÃO — não se usa", () => {
  /**
   * ⚠️ ESTE É O CASO QUE A ÂNCORA EXISTE PARA IMPEDIR. "Tema dinossauro" foi
   * dito ANTES desta rotina nascer — pertence a outra conversa, possivelmente a
   * outra rotina já entregue. Uma busca "por família nos últimos 7 dias" pegaria
   * este tema e colaria dinossauro num quadro que a mãe pediu de outra coisa.
   */
  const nasceu = "2026-09-06T14:00:00.000Z";
  const r = decidirReconciliacao({
    rotinaCriadaEm: nasceu,
    mensagens: [{ texto: "Tema dinossauro", created_at: t(nasceu, -120) }],
  });
  it("ignora o que veio antes e pergunta", () => {
    expect(r.decisao).toBe("perguntar");
    if (r.decisao === "perguntar") expect(r.motivo).toMatch(/nenhuma manifestação/i);
  });
});

describe("DUAS ROTINAS PRÓXIMAS — não cruzar temas", () => {
  const primeira = "2026-09-06T14:00:00.000Z";
  const segunda = t(primeira, 30);
  it("tema dito depois da segunda nascer é ambíguo para a primeira", () => {
    const r = decidirReconciliacao({
      rotinaCriadaEm: primeira,
      mensagens: [{ texto: "Tema capivara", created_at: t(primeira, 45) }],
      outrasRotinasCriadasEm: [segunda],
    });
    expect(r.decisao).toBe("perguntar");
    if (r.decisao === "perguntar") expect(r.motivo).toMatch(/ambígua/i);
  });
  it("mas tema dito ANTES da segunda nascer é da primeira, sem dúvida", () => {
    const r = decidirReconciliacao({
      rotinaCriadaEm: primeira,
      mensagens: [{ texto: "Tema capivara", created_at: t(primeira, 10) }],
      outrasRotinasCriadasEm: [segunda],
    });
    expect(r.decisao).toBe("recuperar");
    if (r.decisao === "recuperar") expect(r.tema).toBe("capivara");
  });
});

describe("DUAS EVIDÊNCIAS EXPLÍCITAS POSTERIORES — vale a última", () => {
  const nasceu = "2026-09-06T14:00:00.000Z";
  it("a família mudou de ideia e a mudança manda", () => {
    const r = decidirReconciliacao({
      rotinaCriadaEm: nasceu,
      mensagens: [
        { texto: "Pode ser Frozen", created_at: t(nasceu, 20) },
        { texto: "Isso", created_at: t(nasceu, 10) },
        { texto: "Tema princesa", created_at: t(nasceu, 5) },
      ],
    });
    expect(r.decisao).toBe("recuperar");
    if (r.decisao === "recuperar") expect(r.tema).toBe("Frozen");
  });
});

describe("AMBIGUIDADE E VAZIO — perguntar, nunca inferir", () => {
  const nasceu = "2026-09-06T14:00:00.000Z";
  it("sem mensagem nenhuma depois", () => {
    expect(decidirReconciliacao({ rotinaCriadaEm: nasceu, mensagens: [] }).decisao).toBe("perguntar");
  });
  it("só cobrança de artefato não é tema", () => {
    const r = decidirReconciliacao({
      rotinaCriadaEm: nasceu,
      mensagens: [
        { texto: "Cadê?", created_at: t(nasceu, 60) },
        { texto: "Consegue trazer?", created_at: t(nasceu, 30) },
      ],
    });
    expect(r.decisao).toBe("perguntar");
  });
  it("fora do teto de 7 dias não é considerado", () => {
    const r = decidirReconciliacao({
      rotinaCriadaEm: nasceu,
      mensagens: [{ texto: "Tema princesa", created_at: t(nasceu, 8 * 24 * 60) }],
    });
    expect(r.decisao).toBe("perguntar");
  });
  it("data de criação ilegível não autoriza nada", () => {
    const r = decidirReconciliacao({ rotinaCriadaEm: "não é data", mensagens: [] });
    expect(r.decisao).toBe("perguntar");
  });
});

describe("KARINA/MANU — o tema veio ANTES da rotina nascer, na mesma conversa", () => {
  /**
   * ⚠️ O CASO QUE CORRIGIU A PRÓPRIA ÂNCORA. Produção, 06/09/2026:
   *
   *   14:42:37  "Quero uma rotina visual / Escola adventista / Tios / Peruano /
   *              Casa / Tema princesa"
   *   ...conversa contínua, gaps de minutos...
   *   15:01:07  rotina "Dia com os tios" gravada com tema=null
   *   15:01:09  "Pronto! A rotina da Manu está montada"  ← e não estava
   *
   * Uma âncora que só olhasse para DEPOIS da criação jogaria fora a evidência
   * mais forte que existe: a mãe dizendo o tema no ato de pedir o quadro.
   */
  const abertura = "2026-09-06T14:42:37.000Z";
  const nasceu = "2026-09-06T15:01:07.000Z";
  const conversa = [
    { texto: "Quero uma rotina visual\nEscola adventista\nTios\nPeruano\nCasa\n\nTema princesa", created_at: abertura },
    { texto: "Faça", created_at: "2026-09-06T14:45:12.000Z" },
    { texto: "A passagem que te dei", created_at: "2026-09-06T14:46:08.000Z" },
    { texto: "Escola adventista Tios Perua Casa", created_at: "2026-09-06T14:47:34.000Z" },
    { texto: "Assim", created_at: "2026-09-06T14:48:41.000Z" },
    { texto: "Isso", created_at: "2026-09-06T14:57:03.000Z" },
    { texto: "Gere", created_at: "2026-09-06T14:57:06.000Z" },
    { texto: "Quero q rotina com as imagens", created_at: "2026-09-06T14:57:51.000Z" },
    { texto: "Ok", created_at: "2026-09-06T14:58:26.000Z" },
  ];
  it("recupera princesa da mensagem que abriu o pedido", () => {
    const r = decidirReconciliacao({ rotinaCriadaEm: nasceu, mensagens: conversa });
    expect(r.decisao).toBe("recuperar");
    if (r.decisao === "recuperar") expect(r.tema).toBe("princesa");
  });
  it("e nenhuma das operacionais do meio vira tema", () => {
    for (const m of conversa.slice(1)) {
      const r = decidirReconciliacao({ rotinaCriadaEm: nasceu, mensagens: [m] });
      expect(r.decisao).toBe("perguntar");
    }
  });
  it("a fronteira de sessão para no silêncio de mais de uma hora", () => {
    const comOntem = [
      { texto: "Tema dinossauro", created_at: "2026-09-05T20:00:00.000Z" },
      ...conversa,
    ];
    const inicio = comecoDaConversaDeOrigem(comOntem, new Date(nasceu).getTime());
    expect(inicio).toBe(new Date(abertura).getTime());
    // E o dinossauro de ontem não contamina esta rotina.
    const r = decidirReconciliacao({ rotinaCriadaEm: nasceu, mensagens: comOntem });
    expect(r.decisao).toBe("recuperar");
    if (r.decisao === "recuperar") expect(r.tema).toBe("princesa");
  });
});
