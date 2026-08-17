import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ofertaDePlanoPendente } from "./orchestrator";

/**
 * A ENTREGA DO PLANO NÃO PODE SE REOFERECER SOZINHA.
 *
 * ═══ O CASO MATHEO (11/08/2026, produção) ═══
 *
 * A mãe recebeu o Plano, respondeu "Ok" e ganhou outro. Seis vezes em dois
 * dias, quatro delas em nove minutos.
 *
 * A causa: o gatilho perguntava "alguma das últimas 6 mensagens PARECE uma
 * oferta de plano?" — e o texto FIXO da entrega, montado em `ponte.ts`
 * ("Montei um plano estratégico com atividades sobre isso"), casa com o
 * `REGEX_OFERTA_PLANO`. A entrega se reoferecia, e cada "Ok" educado aceitava
 * uma oferta que ninguém tinha feito.
 *
 * Pior: `querPlano` vira `forcar: true` na ponte, e `forcar` PULA o freio de
 * 20h. Sobrava só o cooldown de 3 minutos — que é exatamente o intervalo dos
 * quatro Planos em nove minutos.
 *
 * ═══ A CORREÇÃO ═══
 *
 * Dois estados marcados por naturezas diferentes: a OFERTA por texto, a
 * ENTREGA por ÂNCORA (`metadata.plano_id`, gravado só quando `montarPonteWhatsApp`
 * avisa que um Plano existe de verdade). Varrendo do mais novo para o mais
 * velho, a primeira mensagem relevante decide.
 *
 * ⚠️ Estes testes falham sem a correção: com o detector antigo, os casos 2 e 3
 * devolveriam `true` (a entrega parecia oferta) e a mãe ganharia outro Plano.
 */

const OFERTA = "Quer que eu monte um plano com atividades pra isso?";
const ENTREGA =
  "Montei um plano estratégico com atividades sobre isso — mandei em PDF aqui em cima 👆 (dá pra salvar e imprimir).";

type Linha = {
  texto: string | null;
  metadata?: Record<string, unknown> | null;
  membro_atipico_id?: string | null;
};

/**
 * Banco falso. Recebe a timeline em ordem CRONOLÓGICA (a mais antiga primeiro)
 * e devolve como a consulta real devolve: da mais nova para a mais velha.
 */
function bancoCom(linhas: Linha[]) {
  const api: Record<string, unknown> = {
    select: () => api,
    eq: () => api,
    gte: () => api,
    order: () => api,
    limit: async () => ({
      data: [...linhas].reverse().map((l) => ({
        texto: l.texto,
        metadata: l.metadata ?? null,
        membro_atipico_id: l.membro_atipico_id ?? null,
      })),
      error: null,
    }),
  };
  return { from: () => api } as unknown as SupabaseClient;
}

const pendente = (linhas: Linha[], membro: string | null = null) =>
  ofertaDePlanoPendente(bancoCom(linhas), "fam-1", membro);

describe("o gatilho do 'Ok'", () => {
  it("1. oferta sem entrega → PENDENTE (o 'sim' da mãe gera um Plano)", async () => {
    expect(await pendente([{ texto: OFERTA }])).toBe(true);
  });

  it("2. MORDE: oferta CUMPRIDA pela entrega → não está mais pendente", async () => {
    // Sem a correção isto devolvia `true`: o texto da entrega casa a regex.
    expect(
      await pendente([{ texto: OFERTA }, { texto: ENTREGA, metadata: { plano_id: "p1" } }]),
    ).toBe(false);
  });

  it("3. MORDE: o caso Matheo — só a entrega na janela, nenhuma oferta antes", async () => {
    // Foi assim que os Planos se multiplicaram: a entrega sozinha era lida
    // como oferta aberta, e cada "Ok" gerava mais um.
    expect(await pendente([{ texto: ENTREGA, metadata: { plano_id: "p1" } }])).toBe(false);
  });

  it("4. oferta NOVA depois de uma entrega volta a valer por si", async () => {
    expect(
      await pendente([
        { texto: OFERTA },
        { texto: ENTREGA, metadata: { plano_id: "p1" } },
        { texto: OFERTA },
      ]),
    ).toBe(true);
  });

  it("5. conversa comum, sem oferta nenhuma → não pendente", async () => {
    expect(await pendente([{ texto: "Que bom que ele dormiu melhor 💛" }])).toBe(false);
  });

  it("6. a âncora vence mesmo quando a entrega não casa a regex", async () => {
    // A copy pode mudar; a âncora é fato registrado e continua fechando.
    expect(
      await pendente([{ texto: OFERTA }, { texto: "Prontinho 🌿", metadata: { plano_id: "p1" } }]),
    ).toBe(false);
  });

  it("7. âncora vazia ou inválida NÃO conta como entrega", async () => {
    for (const meta of [{}, { plano_id: "" }, { plano_id: 123 }, null]) {
      expect(
        await pendente([{ texto: OFERTA }, { texto: ENTREGA, metadata: meta as never }]),
        `metadata ${JSON.stringify(meta)} fechou a oferta sem ser entrega`,
      ).toBe(true);
    }
  });
});

describe("escopo por criança — a oferta de um irmão não é a do outro", () => {
  it("8. entrega do IRMÃO não fecha a oferta desta criança", async () => {
    expect(
      await pendente(
        [
          { texto: OFERTA, membro_atipico_id: "m1" },
          { texto: ENTREGA, metadata: { plano_id: "p1" }, membro_atipico_id: "m2" },
        ],
        "m1",
      ),
    ).toBe(true);
  });

  it("9. mensagem SEM dono entra na conta — é o recorte que a conversa já usa", async () => {
    // Existem ofertas e entregas com `membro_atipico_id` nulo em produção;
    // excluí-las faria o "sim" da mãe não gerar nada.
    expect(
      await pendente(
        [{ texto: OFERTA, membro_atipico_id: null }, { texto: "oi", membro_atipico_id: "m1" }],
        "m1",
      ),
    ).toBe(true);
  });

  it("10. sem criança no turno, a conta é da família inteira", async () => {
    expect(
      await pendente([
        { texto: OFERTA, membro_atipico_id: "m1" },
        { texto: ENTREGA, metadata: { plano_id: "p1" }, membro_atipico_id: "m1" },
      ]),
    ).toBe(false);
  });
});
