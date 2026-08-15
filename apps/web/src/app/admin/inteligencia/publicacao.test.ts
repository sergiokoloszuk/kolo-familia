import { describe, it, expect, beforeEach, vi } from "vitest";
import { BancoMemoria } from "@/lib/ayla/__harness/banco-memoria";

/**
 * PUBLICAR SEM DEPLOY, SEM MENTIR — Passo 1 do Admin, 15/08/2026.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROTEGE. Publicar o Core é a operação de maior alcance
 * do Admin: ela muda quem a Ayla é para todas as famílias do experimento, de
 * uma vez, sem passar por deploy nem por revisão de código. As duas maneiras de
 * isso dar errado em silêncio são a tela dizer "publicado" com o Core velho no
 * ar, e a troca parar no meio deixando NENHUMA versão ativa sem ninguém saber.
 *
 * ⚠️ SOBRE O DUPLO. `BancoMemoria` ordena por string, então `v10` viria antes de
 * `v9`. Em Postgres a coluna é `int` e ordena certo. Por isso os cenários aqui
 * ficam abaixo de v10 — a numeração NÃO é o que está sendo provado.
 */

const usuario = { id: "00000000-0000-0000-0000-00000000ad11" };
let db: BancoMemoria;

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: async () => ({ user: usuario, supabase: db.cliente(), role: "admin" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => db.cliente() }));

const {
  salvarRascunho,
  publicarRascunho,
  restaurarVersao,
  descartarRascunho,
  listarVersoes,
} = await import("./actions");

const CORE_LONGO = "Você é AYLA. ".repeat(60); // passa o piso de 500 caracteres

function docs() {
  return db.linhas("ayla_documentos") as Array<Record<string, unknown>>;
}
function ativa() {
  return docs().filter((d) => d.status === "ativo");
}

beforeEach(() => {
  db = new BancoMemoria();
});

describe("rascunho", () => {
  it("MORDE: o primeiro rascunho nasce como v1 e NÃO vai ao ar", async () => {
    const r = await salvarRascunho(CORE_LONGO);
    expect(r.ok).toBe(true);
    expect(docs()).toHaveLength(1);
    expect(docs()[0].status).toBe("rascunho");
    expect(ativa(), "o rascunho foi publicado sozinho").toHaveLength(0);
  });

  it("MORDE: salvar de novo REESCREVE o rascunho — não cria versão por Ctrl+S", async () => {
    await salvarRascunho(CORE_LONGO);
    await salvarRascunho(CORE_LONGO + " agora com mais uma linha.");
    expect(docs(), "cada save virou uma versão").toHaveLength(1);
    expect(String(docs()[0].conteudo)).toContain("mais uma linha");
  });

  it("MORDE: texto curto demais é recusado", async () => {
    const r = await salvarRascunho("seja legal");
    expect(r.ok).toBe(false);
    expect(docs()).toHaveLength(0);
  });

  it("descartar apaga o rascunho e não toca no que está no ar", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "NO AR" },
    ]);
    await salvarRascunho(CORE_LONGO);
    await descartarRascunho();
    expect(docs()).toHaveLength(1);
    expect(docs()[0].status).toBe("ativo");
  });
});

describe("publicar", () => {
  it("MORDE: o anterior é ARQUIVADO e o novo fica ativo — nunca dois ativos", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "CORE VELHO" },
    ]);
    await salvarRascunho(CORE_LONGO);
    const r = await publicarRascunho();
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    expect(ativa(), "ficou mais de um ativo").toHaveLength(1);
    expect(ativa()[0].versao).toBe(2);
    const velha = docs().find((d) => d.versao === 1)!;
    expect(velha.status, "a versão anterior sumiu do histórico").toBe("arquivado");
  });

  it("MORDE: quem publicou e quando ficam registrados", async () => {
    await salvarRascunho(CORE_LONGO);
    await publicarRascunho();
    const nova = ativa()[0];
    expect(nova.publicado_por, "publicação sem dono").toBe(usuario.id);
    expect(nova.publicado_em).toBeTruthy();
  });

  it("MORDE: sem rascunho, publicar falha e não mexe em nada", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "NO AR" },
    ]);
    const r = await publicarRascunho();
    expect(r.ok).toBe(false);
    expect(ativa()[0].versao).toBe(1);
  });

  it("MORDE: a escrita que FALHA não vira sucesso na tela", async () => {
    // ⚠️ O erro do Supabase VOLTA em `{ error }`. Se a action não conferir, a
    // tela diz "Core v2 no ar" com a v1 ainda respondendo às famílias.
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "NO AR" },
      { chave: "core", versao: 2, status: "rascunho", conteudo: CORE_LONGO },
    ]);
    db.falhamAoEscrever.add("ayla_documentos");
    const r = await publicarRascunho();
    expect(r.ok, "publicação falhou e a tela disse que deu certo").toBe(false);
    expect(ativa()[0].versao, "a v1 devia ter continuado no ar").toBe(1);
  });

  it("MORDE: se ARQUIVOU e falhou ao ATIVAR, a versão anterior volta ao ar", async () => {
    // ⚠️ ESTE TESTE NASCEU DE UMA SABOTAGEM QUE NÃO MORDEU. Barrar a tabela
    // inteira faz o fluxo parar já no arquivamento, então o ramo da
    // compensação nunca era exercitado — e ele é o ramo que importa: é o
    // estado em que o Core ficou sem NENHUMA versão ativa.
    //
    // Aqui só a SEGUNDA escrita falha: o arquivamento passa, a ativação não.
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "NO AR" },
      { chave: "core", versao: 2, status: "rascunho", conteudo: CORE_LONGO },
    ]);
    const real = db.cliente() as unknown as { from: (t: string) => Record<string, unknown> };
    const original = real.from.bind(real);
    let escritas = 0;
    const soASegundaFalha = {
      from: (t: string) => {
        const chain = original(t) as Record<string, unknown>;
        const update = (chain.update as (l: unknown) => unknown).bind(chain);
        chain.update = (linha: unknown) => {
          escritas++;
          if (escritas === 2) {
            // A cadeia é *thenable*: devolver o erro aqui imita o PostgREST.
            const falha = {
              eq: () => falha,
              select: () => falha,
              maybeSingle: () => falha,
              then: (ok: (v: unknown) => unknown) =>
                Promise.resolve(ok({ data: null, error: { message: "conexão caiu" } })),
            };
            return falha;
          }
          return update(linha);
        };
        return chain;
      },
    };
    db.cliente = () => soASegundaFalha as never;

    const r = await publicarRascunho();
    expect(r.ok, "a tela deu publicação como certa").toBe(false);
    expect(ativa(), "o Core ficou SEM versão ativa").toHaveLength(1);
    expect(ativa()[0].versao, "a v1 não voltou ao ar").toBe(1);
    expect(String(!r.ok && r.error)).toContain("devolvida ao ar");
  });
});

describe("rollback", () => {
  it("MORDE: restaurar cria uma versão NOVA — o histórico não é reescrito", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "arquivado", conteudo: "O CORE BOM" },
      { chave: "core", versao: 2, status: "ativo", conteudo: "O CORE QUE DEU RUIM" },
    ]);
    const alvo = docs().find((d) => d.versao === 1)!.id as string;
    const r = await restaurarVersao(alvo);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    expect(ativa(), "ficou mais de um ativo").toHaveLength(1);
    expect(ativa()[0].versao, "reativou a linha antiga em vez de criar nova").toBe(3);
    expect(ativa()[0].conteudo).toBe("O CORE BOM");
    // A v1 continua marcada como arquivada: a pergunta "o que estava no ar
    // ontem às 14h?" ainda tem resposta.
    expect(docs().find((d) => d.versao === 1)!.status).toBe("arquivado");
    expect(docs().find((d) => d.versao === 2)!.status).toBe("arquivado");
    expect(String(ativa()[0].nota)).toContain("Restauração da v1");
  });

  it("MORDE: restaurar versão vazia é recusado — apagaria o Core", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "arquivado", conteudo: "   " },
      { chave: "core", versao: 2, status: "ativo", conteudo: "NO AR" },
    ]);
    const alvo = docs().find((d) => d.versao === 1)!.id as string;
    const r = await restaurarVersao(alvo);
    expect(r.ok).toBe(false);
    expect(ativa()[0].versao).toBe(2);
  });
});

describe("leitura da tela", () => {
  it("tabela ausente devolve lista vazia em vez de estourar a página", async () => {
    // Enquanto a migração não roda, o Admin abre e explica — não dá erro 500.
    expect(await listarVersoes()).toEqual([]);
  });
});
