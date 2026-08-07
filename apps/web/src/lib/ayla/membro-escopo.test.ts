import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ehDeOutroMembro, semOutrosMembros } from "./membro-escopo";

/**
 * ISOLAMENTO ENTRE IRMÃOS — os quatro vetores.
 *
 * `membro-vazamento.test.ts` trava o vetor da CONVERSA (o histórico que vai pro
 * prompt, etiquetado). Este aqui trava os outros três, que são os que deixam
 * rastro: o Plano (artefato entregue), o Kolo Vivo (perfil permanente) e as
 * Estratégias recentes.
 *
 * A regra que todos compartilham é a da NEGATIVA: some só o que se SABE ser de
 * outro filho. Turno sem dono continua entrando, porque o inbound nunca gravou
 * `membro_atipico_id` antes desta correção — filtrar por igualdade apagaria o
 * acervo inteiro das famílias e trocaria um bug por outro.
 */

const PONTE = readFileSync(resolve(__dirname, "ponte.ts"), "utf8");
const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

const MARIO = "11111111-1111-1111-1111-111111111111";
const MANU = "22222222-2222-2222-2222-222222222222";
const TERCEIRO = "33333333-3333-3333-3333-333333333333";

const doMario = { texto: "Ele presta atenção com algo nas mãos.", membro_atipico_id: MARIO };
const daManu = { texto: "Ela levanta 5 min depois.", membro_atipico_id: MANU };
const semDono = { texto: "Hoje foi um dia difícil.", membro_atipico_id: null };

describe("a regra: some o que se SABE ser de outro", () => {
  it("linha do próprio membro fica", () => {
    expect(ehDeOutroMembro(doMario, MARIO)).toBe(false);
  });

  it("linha do irmão é reconhecida como de outro", () => {
    expect(ehDeOutroMembro(doMario, MANU)).toBe(true);
  });

  it("linha SEM dono nunca é tratada como de outro — nem atribuída ao foco", () => {
    // As duas metades da mesma decisão: ela não some (senão perderíamos todo o
    // histórico anterior à correção) e não vira fato de ninguém (quem atribui é
    // `membroContextoId`, não esta função).
    expect(ehDeOutroMembro(semDono, MANU)).toBe(false);
    expect(semOutrosMembros([semDono], MANU)).toEqual([semDono]);
  });

  it("sem foco definido, nada é descartado", () => {
    // Mensagem ambígua numa família com vários filhos: o certo é não escolher.
    expect(semOutrosMembros([doMario, daManu, semDono], null)).toHaveLength(3);
    expect(semOutrosMembros([doMario, daManu], undefined)).toHaveLength(2);
    expect(ehDeOutroMembro(doMario, "")).toBe(false);
  });
});

describe("a matriz de troca de membro", () => {
  it("A→B: fica só o que é de B e o que não tem dono", () => {
    expect(semOutrosMembros([doMario, daManu, semDono], MANU)).toEqual([daManu, semDono]);
  });

  it("B→A: o inverso, sem depender de qual nome é qual", () => {
    expect(semOutrosMembros([doMario, daManu, semDono], MARIO)).toEqual([doMario, semDono]);
  });

  it("A→B→A: voltar ao primeiro devolve exatamente a visão dele", () => {
    const conversa = [doMario, daManu, doMario, semDono];
    expect(semOutrosMembros(conversa, MARIO).map((l) => l.membro_atipico_id)).toEqual([
      MARIO,
      MARIO,
      null,
    ]);
    expect(semOutrosMembros(conversa, MANU).map((l) => l.membro_atipico_id)).toEqual([MANU, null]);
  });

  it("família de TRÊS filhos: some o de todos os outros, não só o do último", () => {
    const linhas = [doMario, daManu, { texto: "x", membro_atipico_id: TERCEIRO }];
    expect(semOutrosMembros(linhas, TERCEIRO)).toHaveLength(1);
  });

  it("filho único não sofre recorte nenhum", () => {
    // Todas as linhas são dele (ou sem dono). Nada pode sumir — é o caso da
    // maioria das famílias e onde uma regressão passaria despercebida.
    const soDele = [doMario, { texto: "y", membro_atipico_id: MARIO }, semDono];
    expect(semOutrosMembros(soDele, MARIO)).toEqual(soDele);
    expect(semOutrosMembros(soDele, null)).toEqual(soDele);
  });

  it("histórico só de linhas antigas sem dono chega inteiro", () => {
    const antigo = [semDono, semDono, semDono];
    expect(semOutrosMembros(antigo, MANU)).toHaveLength(3);
  });

  it("não muta a lista recebida", () => {
    const orig = [doMario, daManu];
    semOutrosMembros(orig, MANU);
    expect(orig).toHaveLength(2);
  });
});

// ============================================================
// OS TRÊS VETORES QUE DEIXAM RASTRO
// ============================================================

describe("vetor: o Plano (artefato entregue)", () => {
  it("o desafio que vira Plano recebe o membro", () => {
    expect(PONTE).toMatch(/async function desafioDaConversa\([\s\S]{0,220}membroAtipicoId: string \| null,/);
  });

  it("a conversa recente é recortada por membro antes de virar desafio", () => {
    expect(PONTE).toMatch(/semOutrosMembros\(/);
    expect(PONTE).toMatch(/\.select\("direcao, texto, created_at, membro_atipico_id"\)/);
  });

  it("os chamadores passam o membro — a janela de tempo não substitui identidade", () => {
    // A janela de 45 min continua existindo (ela resolve OUTRO bug, o do
    // assunto de 9h antes). Mas tempo não diz de quem é a informação.
    expect(PONTE).toMatch(/desafioDaConversa\(supabase, familyId, mensagem, membroAtipicoId\)/);
    expect(PONTE).not.toMatch(/desafioDaConversa\(supabase, familyId, mensagem\)/);
  });
});

describe("vetor: o Kolo Vivo (perfil permanente)", () => {
  it("o histórico volta com o dono de cada turno", () => {
    expect(ORCH).toMatch(/membro_atipico_id: id,/);
  });

  it("a escrita de evento recorta por membro ANTES de salvar", () => {
    expect(ORCH).toMatch(/const historicoDoMembro = semOutrosMembros\(historicoParser, membroContextoId\)/);
    expect(ORCH).toMatch(/extrairESalvarEventos\(supabase, family\.id, membroContextoId, inbound\.texto, historicoDoMembro\)/);
  });

  it("o histórico do PARSER continua inteiro — é ele que descobre o membro", () => {
    // Recortar a entrada do parser seria circular: precisaríamos do membro pra
    // achar o membro. O recorte fica na escrita, onde o dano é permanente.
    expect(ORCH).toMatch(
      /const historicoParser = await carregarHistorico\(supabase, family\.id, inbound\.texto\);/,
    );
  });
});

describe("vetor: as Estratégias recentes", () => {
  it("a consulta é recortada por membro, aceitando registro antigo sem dono", () => {
    expect(ORCH).toMatch(/membro_atipico_id\.eq\.\$\{membroAtipicoId\},membro_atipico_id\.is\.null/);
  });

  it("o recorte vai na CONSULTA, não depois do limit(3)", () => {
    // Com `.limit(3)` antes do filtro, três planos do irmão apagariam as
    // Estratégias da criança da vez — o filtro pareceria funcionar e não
    // sobraria nada.
    const trecho = ORCH.slice(ORCH.indexOf("async function carregarEstrategiasRecentes"));
    expect(trecho.indexOf(".or(")).toBeLessThan(trecho.indexOf(".limit(3)"));
  });

  it("o orquestrador passa o membro em foco", () => {
    expect(ORCH).toMatch(/carregarEstrategiasRecentes\(supabase, family\.id, membroContextoId\)/);
  });
});
