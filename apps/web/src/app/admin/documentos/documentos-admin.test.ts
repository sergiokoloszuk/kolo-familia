import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { BancoMemoria } from "@/lib/ayla/__harness/banco-memoria";

/**
 * DOCUMENTOS DA AYLA — o texto tem de voltar exatamente como entrou.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROTEGE. Estes documentos são COLADOS À MÃO, são
 * longos, e podem não ter cópia em lugar nenhum. Uma perda silenciosa aqui —
 * truncar, normalizar quebra de linha, comer um emoji — destrói trabalho que
 * ninguém consegue refazer igual. Por isso a prova é SHA-256 antes × depois, e
 * não inspeção visual.
 *
 * ⚠️ CADASTRAR ≠ INJETAR. Um teste desta suíte falha se alguém ligar Trial,
 * Plano, Cartões ou Fontes no prompt só porque foram cadastrados.
 */

const usuario = { id: "00000000-0000-0000-0000-0000000000ad" };
let db: BancoMemoria;

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: async () => ({ user: usuario, supabase: db.cliente(), role: "admin" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { salvarNovaVersao, ativarVersao, listarVersoes, lerVersao } = await import("./actions");
const { sha256 } = await import("./sha");

const docs = () => db.linhas("ayla_documentos") as Array<Record<string, unknown>>;
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Um documento com tudo que costuma quebrar numa ida e volta. */
function textoDe(tamanho: number): string {
  const bloco = [
    "# 1. TÍTULO COM ACENTUAÇÃO — ÇÃO, ÊNFASE, ÜBER",
    "",
    "Parágrafo com **negrito**, _itálico_ e `código`.",
    "",
    "> Oi! 💛 Citação com emoji e aspas \"retas\" e 'simples'.",
    "",
    "* item de lista;",
    "* outro item — com travessão;",
    "* terceiro, com símbolos: ± × ÷ → ⚠️ ✅",
    "",
    "1. numerado;",
    "2. numerado de novo.",
    "",
    "---",
    "",
  ].join("\n");
  let t = "";
  while (t.length < tamanho) t += bloco;
  return t.slice(0, tamanho);
}

beforeEach(() => {
  db = new BancoMemoria();
});

describe("salvar cria versão nova — nunca sobrescreve", () => {
  it("MORDE: a primeira versão nasce como CANDIDATA, fora do ar", async () => {
    const r = await salvarNovaVersao("trial", textoDe(2000));
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(docs()).toHaveLength(1);
    expect(docs()[0].status, "nasceu no ar sem alguém mandar").not.toBe("ativo");
    expect(docs()[0].publicado_em, "candidata não pode ter data de publicação").toBeNull();
  });

  it("MORDE: salvar de novo cria v2 e a v1 continua intacta", async () => {
    const a = textoDe(1200);
    const b = textoDe(1200) + "\n\nlinha nova";
    await salvarNovaVersao("plano", a);
    await salvarNovaVersao("plano", b);
    const linhas = docs().sort((x, y) => (x.versao as number) - (y.versao as number));
    expect(linhas).toHaveLength(2);
    expect(linhas[0].conteudo, "a v1 foi alterada").toBe(a);
    expect(linhas[1].conteudo).toBe(b);
  });

  it("MORDE: duplo clique não cria versão duplicada", async () => {
    const t = textoDe(900);
    await salvarNovaVersao("core", t);
    const r = await salvarNovaVersao("core", t);
    expect(r.ok).toBe(true);
    expect(docs(), "o segundo clique duplicou a versão").toHaveLength(1);
  });

  it("texto vazio é recusado", async () => {
    const r = await salvarNovaVersao("core", "   ");
    expect(r.ok).toBe(false);
    expect(docs()).toHaveLength(0);
  });

  it("chave desconhecida é recusada", async () => {
    const r = await salvarNovaVersao("inventada", textoDe(600));
    expect(r.ok).toBe(false);
    expect(docs()).toHaveLength(0);
  });
});

describe("FIDELIDADE — o texto volta exatamente como entrou", () => {
  for (const tamanho of [16_570, 50_000, 100_000]) {
    it(`MORDE: ${tamanho.toLocaleString("pt-BR")} caracteres — SHA antes = SHA depois`, async () => {
      const original = textoDe(tamanho);
      const shaAntes = sha(original);

      const r = await salvarNovaVersao("fontes_confiaveis", original);
      expect(r.ok, r.ok ? "" : r.error).toBe(true);

      const id = docs()[0].id as string;
      const lido = await lerVersao(id);
      expect(lido, "não consegui ler de volta").not.toBeNull();

      expect(lido!.conteudo.length, "o texto foi truncado").toBe(original.length);
      expect(Buffer.byteLength(lido!.conteudo, "utf8")).toBe(Buffer.byteLength(original, "utf8"));
      expect(lido!.sha, "SHA divergiu na ida e volta").toBe(shaAntes);
      expect(lido!.conteudo).toBe(original);
    });
  }

  it("MORDE: emoji, Markdown e quebras de linha sobrevivem", async () => {
    const t = textoDe(30_000);
    await salvarNovaVersao("cartoes_visuais", t);
    const guardado = String(docs()[0].conteudo);
    expect(guardado).toContain("💛");
    expect(guardado).toContain("**negrito**");
    expect(guardado).toContain("# 1. TÍTULO COM ACENTUAÇÃO");
    expect(guardado.split("\n").length, "quebras de linha se perderam").toBe(t.split("\n").length);
    expect(guardado).toContain("⚠️");
    expect(guardado).toContain("ção");
  });

  it("o SHA do servidor é o mesmo do cálculo independente", () => {
    const t = textoDe(5_000);
    expect(sha256(t)).toBe(sha(t));
  });
});

describe("ativar é ação separada de salvar", () => {
  it("MORDE: salvar não ativa; ativar ativa", async () => {
    await salvarNovaVersao("core", textoDe(1000));
    expect(docs().filter((d) => d.status === "ativo")).toHaveLength(0);

    const r = await ativarVersao(docs()[0].id as string);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(docs().filter((d) => d.status === "ativo")).toHaveLength(1);
    expect(docs()[0].publicado_em).toBeTruthy();
  });

  it("MORDE: quem ativou e quando ficam registrados", () => {
    // Garantia herdada de `publicacao.test.ts`, que foi removido junto com as
    // ações de escrita do simulador. Publicar um Core alcança todas as famílias
    // do experimento de uma vez — a operação precisa de dono.
    return (async () => {
      await salvarNovaVersao("core", textoDe(700));
      await ativarVersao(docs()[0].id as string);
      const ativa = docs().find((d) => d.status === "ativo")!;
      expect(ativa.publicado_por, "ativação sem dono").toBe(usuario.id);
      expect(ativa.publicado_em).toBeTruthy();
    })();
  });

  it("MORDE: no máximo UMA versão ativa por chave", async () => {
    await salvarNovaVersao("core", textoDe(800));
    await salvarNovaVersao("core", textoDe(800) + "x");
    const [v1, v2] = docs().sort((a, b) => (a.versao as number) - (b.versao as number));
    await ativarVersao(v1.id as string);
    await ativarVersao(v2.id as string);
    expect(docs().filter((d) => d.status === "ativo"), "ficaram duas no ar").toHaveLength(1);
    expect(docs().find((d) => d.status === "ativo")!.versao).toBe(2);
  });

  it("MORDE: ROLLBACK — reativar a anterior devolve o texto antigo", async () => {
    const antigo = textoDe(700);
    const novo = textoDe(700) + "\n\nmudança que deu errado";
    await salvarNovaVersao("core", antigo);
    await salvarNovaVersao("core", novo);
    const [v1, v2] = docs().sort((a, b) => (a.versao as number) - (b.versao as number));
    await ativarVersao(v1.id as string);
    await ativarVersao(v2.id as string);
    expect(docs().find((d) => d.status === "ativo")!.conteudo).toBe(novo);

    await ativarVersao(v1.id as string);
    const ativa = docs().find((d) => d.status === "ativo")!;
    expect(ativa.conteudo, "o rollback não devolveu o texto antigo").toBe(antigo);
    expect(docs(), "o rollback destruiu alguma versão").toHaveLength(2);
  });

  it("MORDE: versão vazia não pode ir ao ar", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 9, status: "arquivado", conteudo: "   ", publicado_em: null },
    ]);
    const r = await ativarVersao(docs()[0].id as string);
    expect(r.ok).toBe(false);
    expect(docs()[0].status).not.toBe("ativo");
  });

  it("MORDE: se ARQUIVAR falhar, não pode ficar com duas versões no ar", async () => {
    // ⚠️ NASCEU DE UMA SABOTAGEM QUE NÃO MORDEU. Barrar a tabela inteira faz o
    // fluxo parar no arquivamento; e no duplo o arquivamento sempre passa. O
    // ramo que faltava é o do meio: arquivar falha, ninguém confere, e a
    // promoção segue — duas versões ativas, e o carregador escolhe no chute.
    await salvarNovaVersao("core", textoDe(600));
    await salvarNovaVersao("core", textoDe(600) + "x");
    const [v1, v2] = docs().sort((a, b) => (a.versao as number) - (b.versao as number));
    await ativarVersao(v1.id as string);

    const real = db.cliente() as unknown as { from: (t: string) => Record<string, unknown> };
    const original = real.from.bind(real);
    let updates = 0;
    db.cliente = () =>
      ({
        from: (t: string) => {
          const chain = original(t) as Record<string, unknown>;
          const update = (chain.update as (l: unknown) => unknown).bind(chain);
          chain.update = (linha: unknown) => {
            updates++;
            if (updates === 1) {
              const falha: Record<string, unknown> = {};
              for (const m of ["eq", "select", "maybeSingle"]) falha[m] = () => falha;
              falha.then = (ok: (v: unknown) => unknown) =>
                Promise.resolve(ok({ data: null, error: { message: "conexão caiu" } }));
              return falha;
            }
            return update(linha);
          };
          return chain;
        },
      }) as never;

    const r = await ativarVersao(v2.id as string);
    expect(r.ok, "a tela deu como ativado").toBe(false);
    expect(docs().filter((d) => d.status === "ativo"), "ficaram duas versões no ar").toHaveLength(1);
  });

  it("MORDE: falha de escrita não vira sucesso na tela", async () => {
    await salvarNovaVersao("core", textoDe(600));
    db.falhamAoEscrever.add("ayla_documentos");
    const r = await ativarVersao(docs()[0].id as string);
    expect(r.ok, "a tela disse que ativou e não ativou").toBe(false);
  });
});

describe("histórico", () => {
  it("lista todas as versões, mais nova primeiro", async () => {
    await salvarNovaVersao("trial", textoDe(600));
    await salvarNovaVersao("trial", textoDe(600) + "b");
    await salvarNovaVersao("trial", textoDe(600) + "c");
    const v = await listarVersoes("trial");
    expect(v.map((x) => x.versao)).toEqual([3, 2, 1]);
  });

  it("chave inválida devolve lista vazia em vez de estourar", async () => {
    expect(await listarVersoes("nao_existe")).toEqual([]);
  });
});
