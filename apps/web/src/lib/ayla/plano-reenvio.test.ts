import { describe, expect, it } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";
import { acharPlanoParaReenviar, perguntaDeDesempate } from "./plano-reenvio";

/**
 * QUAL PLANO A MÃE QUER DE VOLTA — a busca, sem gerador nenhum.
 *
 * ⚠️ A regra que este arquivo protege é a ordem dos degraus: âncora → criança →
 * família-com-um-filho. E, sobretudo, que **não existe "último plano da
 * família"** como regra geral: numa família com dois filhos o mais recente
 * pertence a um deles, e devolvê-lo é entregar o artefato do irmão errado.
 */

const AGORA = new Date("2026-08-11T18:00:00Z");
const hMenos = (h: number) => new Date(AGORA.getTime() - h * 3600_000).toISOString();

const FAM = "fam-1";
const MARIO = "membro-mario";
const MANU = "membro-manu";

function mundo(opts: {
  planos: Array<{ id: string; membro: string | null; tema: string; h: number }>;
  ancoras?: Array<{ planoId: string; membro: string | null; h: number }>;
}) {
  const db = new BancoMemoria();
  for (const p of opts.planos) {
    db.semear("planos", [
      {
        id: p.id,
        family_account_id: FAM,
        membro_atipico_id: p.membro,
        titulo: `Plano ${p.tema}`,
        tema: p.tema,
        secoes: [{ tipo: "entender", titulo: "t", conteudo_markdown: "c" }],
        created_at: hMenos(p.h),
      },
    ]);
  }
  for (const a of opts.ancoras ?? []) {
    db.semear("ayla_messages", [
      {
        family_account_id: FAM,
        direcao: "outbound",
        membro_atipico_id: a.membro,
        texto: "Montei um plano…",
        metadata: { plano_id: a.planoId, entrega: { canal: "z-api" } },
        created_at: hMenos(a.h),
      },
    ]);
  }
  return db;
}

const achar = (db: BancoMemoria, membro: string | null, total: number) =>
  acharPlanoParaReenviar(db.cliente(), {
    familyId: FAM,
    membroAtipicoId: membro,
    totalDeCriancas: total,
    agora: AGORA,
  });

describe("A · um plano recente", () => {
  it("MORDE: acha e reenvia", async () => {
    const db = mundo({ planos: [{ id: "p1", membro: MARIO, tema: "comunicação", h: 2 }] });
    const r = await achar(db, MARIO, 1);
    expect(r.tipo).toBe("achou");
    expect(r.tipo === "achou" && r.plano.id).toBe("p1");
  });
});

describe("B · dois planos do MESMO membro", () => {
  it("MORDE: a âncora da conversa escolhe — não o mais recente", async () => {
    // O mais NOVO é p2. A conversa acabou de entregar p1. Quem manda é a âncora.
    const db = mundo({
      planos: [
        { id: "p1", membro: MARIO, tema: "escola", h: 5 },
        { id: "p2", membro: MARIO, tema: "sono", h: 1 },
      ],
      ancoras: [{ planoId: "p1", membro: MARIO, h: 4 }],
    });
    const r = await achar(db, MARIO, 1);
    expect(r.tipo === "achou" && r.via).toBe("ancora");
    expect(r.tipo === "achou" && r.plano.id, "devolveu o mais recente em vez do ancorado").toBe("p1");
  });

  it("MORDE: sem âncora, dois planos do mesmo membro é AMBÍGUO — pergunta", async () => {
    const db = mundo({
      planos: [
        { id: "p1", membro: MARIO, tema: "escola", h: 5 },
        { id: "p2", membro: MARIO, tema: "sono", h: 1 },
      ],
    });
    const r = await achar(db, MARIO, 1);
    expect(r.tipo, "escolheu sozinho entre dois planos").toBe("ambiguo");
  });
});

describe("C/D · dois filhos", () => {
  it("MORDE: a criança do turno vence a âncora do irmão", async () => {
    const db = mundo({
      planos: [
        { id: "p-mario", membro: MARIO, tema: "comunicação", h: 10 },
        { id: "p-manu", membro: MANU, tema: "sono", h: 1 },
      ],
      // A entrega mais recente foi a da Manu — mas a mãe está falando do Mário.
      ancoras: [{ planoId: "p-manu", membro: MANU, h: 1 }],
    });
    const r = await achar(db, MARIO, 2);
    expect(r.tipo === "achou" && r.plano.id, "entregou o plano do IRMÃO").toBe("p-mario");
    expect(r.tipo === "achou" && r.plano.membro_atipico_id).toBe(MARIO);
  });

  it("MORDE: sem criança resolvida e com dois filhos, NÃO chuta", async () => {
    const db = mundo({
      planos: [
        { id: "p-mario", membro: MARIO, tema: "comunicação", h: 10 },
        { id: "p-manu", membro: MANU, tema: "sono", h: 1 },
      ],
    });
    const r = await achar(db, null, 2);
    expect(r.tipo, "escolheu o mais recente numa família com dois filhos").toBe("nenhum");
  });
});

describe("E · nada para reenviar", () => {
  it("família sem plano nenhum devolve 'nenhum' — e o turno segue na conversa", async () => {
    const db = mundo({ planos: [] });
    expect((await achar(db, MARIO, 1)).tipo).toBe("nenhum");
  });
});

describe("âncora apagada", () => {
  it("MORDE: âncora apontando para plano inexistente desce um degrau", async () => {
    // O plano foi apagado; a mensagem ainda cita o id. Sem este degrau, a mãe
    // ouviria "não achei" tendo um plano perfeitamente válido na conta.
    const db = mundo({
      planos: [{ id: "p-vivo", membro: MARIO, tema: "escola", h: 3 }],
      ancoras: [{ planoId: "p-apagado", membro: MARIO, h: 1 }],
    });
    const r = await achar(db, MARIO, 1);
    expect(r.tipo === "achou" && r.via).toBe("membro");
    expect(r.tipo === "achou" && r.plano.id).toBe("p-vivo");
  });
});

describe("a pergunta de desempate", () => {
  it("cita os dois temas, para a mãe responder com uma palavra", () => {
    const p = perguntaDeDesempate([
      { id: "a", titulo: "T", tema: "escola", membro_atipico_id: null, secoes: [], created_at: "" },
      { id: "b", titulo: "T", tema: "sono", membro_atipico_id: null, secoes: [], created_at: "" },
    ]);
    expect(p).toContain("escola");
    expect(p).toContain("sono");
  });
});
