import { describe, it, expect, vi, beforeEach } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";
import { esquecerCacheDeDocumentos } from "./documentos";
import { AYLA_EXPERIMENTAL_PROMPT } from "./experimental-prompt";

/**
 * O CICLO INTEIRO: EDITAR → TESTAR → PUBLICAR → VOLTAR ATRÁS — 15/08/2026.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE SEPARADO. `documentos.test.ts` prova o
 * carregador; `publicacao.test.ts` prova as ações do Admin. Nenhum dos dois
 * responde a pergunta que de fato importa: **qual texto chegou ao modelo?**
 * Os dois lados podem estar certos e a fiação entre eles, errada — e o sintoma
 * seria a Ayla continuar sendo a de ontem depois de alguém publicar, sem
 * nenhum erro em lugar nenhum.
 *
 * Aqui o provider é um espião: ele guarda o `system` que recebeu. É a única
 * evidência que responde à pergunta.
 *
 * ⚠️ O QUE ISTO **NÃO** PROVA. Que funciona em produção. A tabela ainda não
 * existe lá (PEND-069) e este código ainda não foi publicado. Isto prova a
 * fiação; a prova real depende da migração e do deploy.
 */

const systemsVistos: string[] = [];
let db: BancoMemoria;

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  gerarConversacional: async (p: { system?: string }) => {
    systemsVistos.push(String(p.system ?? ""));
    return {
      texto: "resposta qualquer",
      provider: "openai",
      model: "gpt-5.6-luna",
      tokensIn: 10,
      tokensOut: 5,
      cacheRead: 0,
      cacheWrite: 0,
      ms: 1,
    };
  },
}));
vi.mock("@/lib/billing/logar", () => ({ logarUsoApi: async () => {} }));
vi.mock("@/lib/conducao/fronteiras", () => ({ fronteiraAtravessada: () => null }));

const { responderExperimental } = await import("./experimental");

const FAMILIA = "11111111-1111-1111-1111-111111111111";

/** O último system que o modelo recebeu. */
function ultimoSystem() {
  return systemsVistos[systemsVistos.length - 1] ?? "";
}

async function falar() {
  const r = await responderExperimental(db.cliente(), {
    familyId: FAMILIA,
    mensagem: "meu filho não dorme",
  });
  expect(r, "a Ayla não respondeu — o cenário está incompleto").not.toBeNull();
  return r!;
}

beforeEach(() => {
  systemsVistos.length = 0;
  esquecerCacheDeDocumentos();
  db = new BancoMemoria();
  db.semear("family_accounts", [{ id: FAMILIA, whatsapp_e164: "+5511999999999" }]);
  db.semear("membros_atipicos", [
    { id: "c1", family_account_id: FAMILIA, nome: "Ana", data_nascimento: "2018-03-01", ativo: true },
  ]);
});

describe("de onde vem o Core que chega ao modelo", () => {
  it("MORDE: sem tabela/sem versão ativa, o modelo recebe o Core do CÓDIGO", async () => {
    const r = await falar();
    expect(ultimoSystem()).toContain(AYLA_EXPERIMENTAL_PROMPT.slice(0, 200));
    expect(r.metrica.coreOrigem).toBe("fallback");
    expect(r.metrica.coreVersao).toBeNull();
  });

  it("MORDE: com versão ativa, o modelo recebe o Core do BANCO", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 3, status: "ativo", conteudo: "CORE-DO-BANCO-V3" },
    ]);
    const r = await falar();
    expect(ultimoSystem(), "o banco publicou e o modelo não viu").toContain("CORE-DO-BANCO-V3");
    expect(
      ultimoSystem(),
      "o Core do código continuou indo junto — dois Cores no mesmo turno",
    ).not.toContain(AYLA_EXPERIMENTAL_PROMPT.slice(0, 200));
    expect(r.metrica.coreOrigem).toBe("admin");
    expect(r.metrica.coreVersao).toBe(3);
  });

  it("MORDE: o RASCUNHO não chega em família nenhuma", async () => {
    // Este é o teste que impede o pior acidente da tela: alguém salvar um
    // rascunho pela metade às 23h e a Ayla virar aquilo para todo mundo.
    db.semear("ayla_documentos", [
      { chave: "core", versao: 3, status: "ativo", conteudo: "CORE-DO-BANCO-V3" },
      { chave: "core", versao: 4, status: "rascunho", conteudo: "RASCUNHO-PELA-METADE" },
    ]);
    await falar();
    expect(ultimoSystem(), "RASCUNHO VAZOU PARA A CONVERSA REAL").not.toContain("RASCUNHO");
    expect(ultimoSystem()).toContain("CORE-DO-BANCO-V3");
  });

  it("MORDE: o simulador recebe o rascunho, e SÓ ele", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 3, status: "ativo", conteudo: "CORE-DO-BANCO-V3" },
      { chave: "core", versao: 4, status: "rascunho", conteudo: "RASCUNHO-PELA-METADE" },
    ]);
    const r = await responderExperimental(db.cliente(), {
      familyId: FAMILIA,
      mensagem: "teste",
      rascunhoCore: { conteudo: "RASCUNHO-PELA-METADE", versao: 4 },
      origem: "simulador",
    });
    expect(ultimoSystem()).toContain("RASCUNHO-PELA-METADE");
    expect(ultimoSystem()).not.toContain("CORE-DO-BANCO-V3");
    expect(r!.metrica.coreVersao).toBe(4);
  });
});

describe("publicar muda a Ayla sem passar por deploy", () => {
  it("MORDE: o MESMO processo, sem reiniciar nada, passa a usar o Core novo", async () => {
    // ⚠️ ESTA É A PERGUNTA DA MISSÃO. Nada aqui reimporta módulo, reinicia
    // processo nem simula deploy: a única coisa que muda entre a primeira e a
    // segunda fala é uma linha do banco.
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "AYLA DE ONTEM" },
    ]);
    await falar();
    expect(ultimoSystem()).toContain("AYLA DE ONTEM");

    // "Publicar", em uma linha: arquiva a antiga, ativa a nova.
    const linhas = db.linhas("ayla_documentos") as Array<Record<string, unknown>>;
    linhas[0].status = "arquivado";
    linhas.push({
      id: "nova",
      chave: "core",
      versao: 2,
      status: "ativo",
      conteudo: "AYLA DE HOJE",
    });
    esquecerCacheDeDocumentos(); // é o que a action faz depois de publicar

    await falar();
    expect(ultimoSystem(), "publicou e a Ayla continuou sendo a de ontem").toContain(
      "AYLA DE HOJE",
    );
    expect(ultimoSystem()).not.toContain("AYLA DE ONTEM");
  });

  it("MORDE: sem esquecer o cache, a troca demora — mas NÃO passa de 60s", async () => {
    // O preço combinado de publicar sem deploy. Documentado porque é o tipo de
    // atraso que faz alguém publicar duas vezes achando que não pegou.
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "AYLA DE ONTEM" },
    ]);
    await falar();

    // ⚠️ SUBSTITUI O OBJETO, não muta o campo. `BancoMemoria` devolve as
    // mesmas referências que o cache guardou, então mutar o campo mudaria o
    // cache junto e o teste passaria por engano. Em produção o cache guarda um
    // snapshot que veio por HTTP — trocar a linha inteira é o que imita isso.
    const linhas = db.linhas("ayla_documentos") as Array<Record<string, unknown>>;
    linhas[0] = { ...linhas[0], conteudo: "AYLA DE HOJE" };
    await falar(); // cache ainda quente: o texto velho segue

    expect(ultimoSystem()).toContain("AYLA DE ONTEM");
    const SRC = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./documentos.ts", import.meta.url), "utf8"),
    );
    expect(SRC, "o teto de 60s saiu do código sem este teste perceber").toMatch(
      /const TTL_MS = 60_000;/,
    );
  });

  it("MORDE: a volta atrás também é imediata", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 2, status: "ativo", conteudo: "AYLA QUE DEU RUIM" },
    ]);
    await falar();
    expect(ultimoSystem()).toContain("AYLA QUE DEU RUIM");

    const linhas = db.linhas("ayla_documentos") as Array<Record<string, unknown>>;
    linhas[0].status = "arquivado";
    linhas.push({ id: "r", chave: "core", versao: 3, status: "ativo", conteudo: "AYLA QUE FUNCIONAVA" });
    esquecerCacheDeDocumentos();

    await falar();
    expect(ultimoSystem(), "o rollback não chegou ao modelo").toContain("AYLA QUE FUNCIONAVA");
  });

  it("MORDE: banco fora do ar NO MEIO do dia não deixa a Ayla sem identidade", async () => {
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "CORE PUBLICADO" },
    ]);
    await falar();
    expect(ultimoSystem()).toContain("CORE PUBLICADO");

    esquecerCacheDeDocumentos();
    const cli = db.cliente() as unknown as { from: (t: string) => unknown };
    const orig = cli.from.bind(cli);
    (cli as { from: unknown }).from = (t: string) => {
      if (t === "ayla_documentos") throw new Error("banco caiu");
      return orig(t);
    };
    const r = await responderExperimental(cli as never, {
      familyId: FAMILIA,
      mensagem: "meu filho não dorme",
    });
    expect(r, "a Ayla emudeceu porque o banco caiu").not.toBeNull();
    expect(ultimoSystem()).toContain(AYLA_EXPERIMENTAL_PROMPT.slice(0, 200));
    expect(r!.metrica.coreOrigem).toBe("fallback");
  });
});

describe("o contexto da família continua chegando junto", () => {
  it("MORDE: trocar a origem do Core não derrubou o bloco de contexto", async () => {
    // O Core é o começo do system; o contexto vem depois dele. Uma troca
    // desatenta poderia substituir o system inteiro e apagar o contexto sem
    // erro nenhum — a Ayla ficaria genérica e ninguém veria.
    db.semear("ayla_documentos", [
      { chave: "core", versao: 1, status: "ativo", conteudo: "CORE PUBLICADO" },
    ]);
    await falar();
    const sys = ultimoSystem();
    expect(sys.startsWith("CORE PUBLICADO"), "o Core deixou de abrir o system").toBe(true);
    expect(sys, "o contexto da família sumiu do system").toContain("Ana");
  });
});
