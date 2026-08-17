import { describe, it, expect, vi, beforeEach } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";
import { esquecerCacheDeDocumentos, CHAVES_DOCUMENTO } from "./documentos";

/**
 * PROVA NEGATIVA — cadastrar e ATIVAR não coloca o documento na conversa.
 *
 * ⚠️ POR QUE ISTO É UM TESTE, e não uma promessa. A tela de Documentos da Ayla
 * deixa qualquer admin escrever e ativar Trial, Plano, Cartões Visuais e Fontes
 * Confiáveis. É fácil supor que ativar liga — e a suposição errada aqui muda a
 * conversa de todas as famílias do experimento de uma vez, sem deploy.
 *
 * Este arquivo prova o contrário pelo único caminho que vale: o `system` que
 * chega ao modelo. Só o Core entra. Quando a orquestração seletiva for
 * construída, este teste vai falhar de propósito — e aí será atualizado com a
 * regra nova, deliberadamente, não por acidente.
 */

const systems: string[] = [];
let db: BancoMemoria;

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "c", openai: "gpt-5.6-luna" },
  gerarConversacional: async (p: { system?: string }) => {
    systems.push(String(p.system ?? ""));
    return { texto: "ok", provider: "openai", model: "g", tokensIn: 1, tokensOut: 1, cacheRead: 0, cacheWrite: 0, ms: 1 };
  },
}));
vi.mock("@/lib/billing/logar", () => ({ logarUsoApi: async () => {} }));
vi.mock("@/lib/conducao/fronteiras", () => ({ fronteiraAtravessada: () => null }));

const { responderExperimental } = await import("./experimental");

const FAM = "f1";
const MARCA: Record<string, string> = {
  core: "CORE-NO-AR",
  trial: "TRIAL-NAO-DEVE-ENTRAR",
  plano: "PLANO-NAO-DEVE-ENTRAR",
  cartoes_visuais: "CARTOES-NAO-DEVEM-ENTRAR",
  fontes_confiaveis: "FONTES-NAO-DEVEM-ENTRAR",
};

beforeEach(() => {
  systems.length = 0;
  esquecerCacheDeDocumentos();
  db = new BancoMemoria();
  db.semear("family_accounts", [{ id: FAM, whatsapp_e164: "+5511900000000" }]);
  db.semear("family_profiles", [{ family_account_id: FAM, nome_mae: "Juliana" }]);
  db.semear("membros_atipicos", [
    { id: "m1", family_account_id: FAM, ativo: true, nome: "Daniel", data_nascimento: "2018-05-10" },
  ]);
  // TODOS os cinco documentos cadastrados E ATIVOS.
  db.semear(
    "ayla_documentos",
    CHAVES_DOCUMENTO.map((chave, i) => ({
      chave,
      versao: 1,
      status: "ativo",
      conteudo: `${MARCA[chave]} — corpo do documento ${chave}`,
      publicado_em: `2026-08-1${i}T00:00:00Z`,
    })),
  );
});

describe("os cinco estão ativos no banco", () => {
  it("MORDE: com os cinco ATIVOS, só o Core chega ao modelo", async () => {
    const r = await responderExperimental(db.cliente(), {
      familyId: FAM,
      mensagem: "meu filho não dorme",
    });
    expect(r, "a Ayla não respondeu — o cenário está incompleto").not.toBeNull();

    const s = systems[0] ?? "";
    expect(s, "o Core ativo não chegou").toContain(MARCA.core);

    for (const chave of ["trial", "plano", "cartoes_visuais", "fontes_confiaveis"] as const) {
      expect(
        s,
        `o documento "${chave}" VAZOU para a conversa só por estar ativo`,
      ).not.toContain(MARCA[chave]);
    }
  });

  it("MORDE: nem mesmo o nome das chaves aparece no prompt", async () => {
    await responderExperimental(db.cliente(), { familyId: FAM, mensagem: "e a escola?" });
    const s = systems[0] ?? "";
    for (const chave of ["cartoes_visuais", "fontes_confiaveis"] as const) {
      expect(s).not.toContain(chave);
    }
  });

  it("MORDE: o resolvedor é chamado para `core` e `trial` — e mais nada", async () => {
    // ⚠️ ERA 1, PASSOU A SER 2 EM 17/08/2026. O documento do Trial foi
    // integrado: ele é o COMO da intenção que o `<jornada>` escolhe. As duas
    // leituras correm no MESMO `Promise.all`, então não há espera nova em
    // série — o que este teste protege é o NÚMERO de documentos que o turno
    // consulta, não a latência.
    //
    // `plano`, `cartoes_visuais` e `fontes_confiaveis` continuam fora. Se
    // alguém ligar mais um, este número sobe e o teste reprova — que é
    // exatamente o alarme que se quer.
    const cli = db.cliente() as unknown as { from: (t: string) => unknown };
    const orig = cli.from.bind(cli);
    let docsLidos = 0;
    (cli as { from: unknown }).from = (t: string) => {
      if (t === "ayla_documentos") docsLidos++;
      return orig(t);
    };
    await responderExperimental(cli as never, { familyId: FAM, mensagem: "oi" });
    expect(docsLidos, "número de documentos lidos no turno mudou").toBe(2);
  });
});
