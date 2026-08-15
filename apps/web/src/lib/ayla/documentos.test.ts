import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BancoMemoria } from "./__harness/banco-memoria";
import {
  resolverDocumento,
  lerRascunho,
  esquecerCacheDeDocumentos,
} from "./documentos";
import { AYLA_EXPERIMENTAL_PROMPT } from "./experimental-prompt";

/**
 * O CORE NUNCA PODE SUMIR — Passo 1 do Admin, 15/08/2026.
 *
 * ⚠️ POR QUE ESTE ARQUIVO É O MAIS IMPORTANTE DA FRENTE. Tirar o Core do código
 * e pôr no banco troca uma constante por uma dependência de rede. Se essa troca
 * for feita sem rede de segurança, um banco fora do ar deixa de ser "a Ayla
 * está lenta" e passa a ser "a Ayla não sabe quem é".
 *
 * Cada teste aqui é um jeito de a leitura falhar. Em todos, a resposta certa é
 * a mesma: o Core do código.
 */

const CORE_ADMIN = "SOU O CORE VINDO DO ADMIN, versao 7.";

function bancoCom(linhas: Array<Record<string, unknown>>) {
  const db = new BancoMemoria();
  db.semear("ayla_documentos", linhas);
  return db.cliente();
}

beforeEach(() => esquecerCacheDeDocumentos());

describe("fonte principal: o documento ativo", () => {
  it("MORDE: com um ativo no banco, é ELE que a Ayla usa", async () => {
    const d = await resolverDocumento(
      bancoCom([{ chave: "core", versao: 7, status: "ativo", conteudo: CORE_ADMIN }]),
      "core",
    );
    expect(d.conteudo).toBe(CORE_ADMIN);
    expect(d.origem).toBe("admin");
    expect(d.versao).toBe(7);
  });

  it("o rascunho NÃO é usado na conversa real", async () => {
    // O rascunho existe no banco, mas quem não pede rascunho não recebe.
    const d = await resolverDocumento(
      bancoCom([
        { chave: "core", versao: 7, status: "ativo", conteudo: CORE_ADMIN },
        { chave: "core", versao: 8, status: "rascunho", conteudo: "RASCUNHO NAO PUBLICADO" },
      ]),
      "core",
    );
    expect(d.conteudo, "rascunho vazou para a conversa real").toBe(CORE_ADMIN);
  });

  it("o simulador PEDE o rascunho e recebe", async () => {
    const d = await resolverDocumento(
      bancoCom([{ chave: "core", versao: 7, status: "ativo", conteudo: CORE_ADMIN }]),
      "core",
      { conteudo: "RASCUNHO NAO PUBLICADO", versao: 8 },
    );
    expect(d.conteudo).toBe("RASCUNHO NAO PUBLICADO");
    expect(d.versao).toBe(8);
  });
});

describe("FALLBACK — os quatro jeitos de falhar", () => {
  it("MORDE: tabela não existe (migração não aplicada) → Core do código", async () => {
    const db = new BancoMemoria(); // sem semear nada: `.from` devolve vazio
    const quebrado = {
      from: () => {
        throw new Error('relation "public.ayla_documentos" does not exist');
      },
    } as never;
    void db;
    const d = await resolverDocumento(quebrado, "core");
    expect(d.origem).toBe("fallback");
    expect(d.conteudo).toBe(AYLA_EXPERIMENTAL_PROMPT);
  });

  it("MORDE: banco devolve ERRO (não lança) → Core do código", async () => {
    // ⚠️ No cliente Supabase o erro VOLTA em `{ error }`. Um `await` sem
    // checar seguiria com `data` nulo e chamaria isso de sucesso — foi assim
    // que o acesso da Rochelle sumiu.
    const comErro = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: "connection refused" } }),
        }),
      }),
    } as never;
    const d = await resolverDocumento(comErro, "core");
    expect(d.origem).toBe("fallback");
    expect(d.conteudo).toBe(AYLA_EXPERIMENTAL_PROMPT);
  });

  it("MORDE: nenhuma linha ativa → Core do código", async () => {
    const d = await resolverDocumento(
      bancoCom([{ chave: "core", versao: 1, status: "arquivado", conteudo: "VELHO" }]),
      "core",
    );
    expect(d.origem).toBe("fallback");
    expect(d.conteudo).toBe(AYLA_EXPERIMENTAL_PROMPT);
  });

  it("MORDE: linha ativa com conteúdo VAZIO → Core do código", async () => {
    // Publicação incompleta é indistinguível de linha ausente, e a resposta
    // tem de ser a mesma. `ai_prompts` tem hoje 3 linhas exatamente assim.
    for (const vazio of ["", "   ", "\n\n"]) {
      esquecerCacheDeDocumentos();
      const d = await resolverDocumento(
        bancoCom([{ chave: "core", versao: 9, status: "ativo", conteudo: vazio }]),
        "core",
      );
      expect(d.origem, `conteúdo "${vazio}" passou como válido`).toBe("fallback");
      expect(d.conteudo).toBe(AYLA_EXPERIMENTAL_PROMPT);
    }
  });

  it("MORDE: rascunho vazio no simulador também cai pro ativo", async () => {
    const d = await resolverDocumento(
      bancoCom([{ chave: "core", versao: 7, status: "ativo", conteudo: CORE_ADMIN }]),
      "core",
      { conteudo: "   ", versao: 8 },
    );
    expect(d.conteudo).toBe(CORE_ADMIN);
  });

  it("o fallback é o Core aprovado, não um texto genérico", () => {
    expect(AYLA_EXPERIMENTAL_PROMPT).toContain("Você é **AYLA**");
    expect(AYLA_EXPERIMENTAL_PROMPT.length).toBeGreaterThan(10_000);
  });
});

describe("CACHE — ajuda sem esconder falha", () => {
  it("MORDE: duas leituras seguidas custam UMA consulta", async () => {
    let idas = 0;
    const db = new BancoMemoria();
    db.semear("ayla_documentos", [
      { chave: "core", versao: 7, status: "ativo", conteudo: CORE_ADMIN },
    ]);
    const cli = db.cliente() as unknown as { from: (t: string) => unknown };
    const orig = cli.from.bind(cli);
    (cli as { from: unknown }).from = (t: string) => {
      idas++;
      return orig(t);
    };
    await resolverDocumento(cli as never, "core");
    await resolverDocumento(cli as never, "core");
    await resolverDocumento(cli as never, "core");
    expect(idas, `foi ao banco ${idas} vezes`).toBe(1);
  });

  it("MORDE: a FALHA não é cacheada — o próximo turno tenta de novo", async () => {
    // Cachear o vazio manteria a Ayla no fallback por um minuto DEPOIS de o
    // banco voltar. O erro tem de ser reexaminado sempre.
    let idas = 0;
    const quebrado = {
      from: () => {
        idas++;
        throw new Error("indisponível");
      },
    } as never;
    await resolverDocumento(quebrado, "core");
    await resolverDocumento(quebrado, "core");
    expect(idas, "a falha ficou cacheada").toBe(2);
  });

  it("MORDE: erro DEVOLVIDO (não lançado) também não pode ser cacheado", async () => {
    // ⚠️ ESTE TESTE NASCEU DE UMA SABOTAGEM QUE NÃO MORDEU. Sem
    // `if (error) throw`, o desfecho continuava sendo o fallback — então o
    // teste anterior passava —, mas o mapa VAZIO era cacheado por 60 s. Ou
    // seja: um soluço do banco deixava a Ayla no Core do código por um minuto
    // inteiro depois de ele voltar. O desfecho certo pelo motivo errado é o
    // tipo de verde que este repositório já pagou caro.
    let idas = 0;
    const comErro = {
      from: () => {
        idas++;
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: "connection refused" } }),
          }),
        };
      },
    } as never;
    const a = await resolverDocumento(comErro, "core");
    const b = await resolverDocumento(comErro, "core");
    expect(a.origem).toBe("fallback");
    expect(b.origem).toBe("fallback");
    expect(idas, "o erro devolvido foi cacheado — o banco voltaria e a Ayla não veria").toBe(2);
  });

  it("o TTL é curto e está escrito", () => {
    const SRC = readFileSync(resolve(__dirname, "documentos.ts"), "utf8");
    expect(SRC).toMatch(/const TTL_MS = 60_000;/);
    expect(SRC, "sumiu o motivo do TTL ser a escolha").toMatch(/serverless/);
  });
});

describe("rascunho", () => {
  it("devolve o rascunho quando existe", async () => {
    const r = await lerRascunho(
      bancoCom([{ chave: "core", versao: 8, status: "rascunho", conteudo: "RASCUNHO" }]),
      "core",
    );
    expect(r).toEqual({ conteudo: "RASCUNHO", versao: 8 });
  });

  it("devolve null quando não há, e quando está vazio", async () => {
    expect(await lerRascunho(bancoCom([]), "core")).toBeNull();
    expect(
      await lerRascunho(
        bancoCom([{ chave: "core", versao: 8, status: "rascunho", conteudo: "  " }]),
        "core",
      ),
    ).toBeNull();
  });
});

describe("a migração garante o que o código não garante sozinho", () => {
  const SQL = readFileSync(
    resolve(__dirname, "../../../../../supabase/migrations/0077_ayla_documentos.sql"),
    "utf8",
  );

  it("MORDE: no máximo UM ativo por chave, garantido pelo banco", () => {
    // Sem este índice, uma publicação que falhe no meio deixa duas versões
    // ativas e o carregador escolhe no chute.
    expect(SQL).toMatch(
      /create unique index[\s\S]{0,80}ayla_documentos_um_ativo_idx[\s\S]{0,120}where status = 'ativo'/,
    );
  });

  it("MORDE: no máximo UM rascunho por chave", () => {
    expect(SQL).toMatch(/ayla_documentos_um_rascunho_idx[\s\S]{0,120}where status = 'rascunho'/);
  });

  it("MORDE: (chave, versao) é único — é o que dá histórico", () => {
    expect(SQL).toMatch(/unique index[\s\S]{0,80}\(chave, versao\)/);
  });

  it("não toca em ai_prompts", () => {
    expect(SQL, "a migração mexeu na tabela do parser").not.toMatch(/alter table[\s\S]{0,40}ai_prompts/i);
  });

  it("tem rollback escrito", () => {
    expect(SQL).toMatch(/ROLLBACK:[\s\S]{0,80}drop table public\.ayla_documentos/);
  });
});

void vi;
