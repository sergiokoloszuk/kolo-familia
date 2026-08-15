import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BancoMemoria } from "./__harness/banco-memoria";

/**
 * O EVENTO É DA CRIANÇA CERTA — 15/08/2026.
 *
 * ⚠️ O CASO. "O irmão dela, João, começou a andar sozinho essa semana" gravava
 * `marco: Irmão João começou a andar sozinho` na linha do tempo da ANA.
 * PROVEI POR EXECUÇÃO com o modelo real, 3/3. O SYSTEM do extrator falava em
 * "uma criança/pessoa" e nunca recebia o nome de quem está em foco: o
 * `membroId` só aparecia na hora do INSERT.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROVA, E O QUE NÃO PROVA. Ele prova a FIAÇÃO: que o
 * nome chega ao SYSTEM, que os dois canais passam esse nome, que o pré-filtro
 * segue igual e que a escrita continua no membro resolvido. Isso é
 * determinístico e vale como regressão permanente.
 *
 * Ele NÃO prova que o modelo obedece — isso depende do modelo, e um teste
 * unitário que "decide" a saída do LLM estaria testando o próprio mock. O
 * comportamento está provado na bancada com modelo real
 * (`scripts/bancada/eventos-atribuicao/`), reproduzível a qualquer momento.
 */

const chamadas: Array<{ system: string }> = [];

vi.mock("./anthropic", () => ({
  AYLA_MODEL: "claude-haiku-4-5",
  getAylaAnthropicClient: () => ({
    messages: {
      create: async (p: { system: string }) => {
        chamadas.push({ system: p.system });
        // Devolve UM marco genérico: o que se mede aqui é o prompt e a
        // persistência, não a decisão do modelo.
        return {
          content: [
            { type: "text", text: '[{"tipo":"marco","descricao":"um marco","data":null}]' },
          ],
        };
      },
    },
  }),
}));

const { extrairESalvarEventos } = await import("./eventos");

const FAM = "fam-1";
const MEM = "membro-ana";

function banco() {
  const db = new BancoMemoria();
  db.semear("membros_atipicos", [{ id: MEM, family_account_id: FAM, nome: "Ana", ativo: true }]);
  return db;
}

beforeEach(() => {
  chamadas.length = 0;
});

describe("o extrator sabe de quem é a linha do tempo", () => {
  it("MORDE: o nome da criança em foco vai no SYSTEM", async () => {
    const db = banco();
    await extrairESalvarEventos(db.cliente(), FAM, MEM, "a Ana começou a amarrar o tênis", [], "Ana");
    expect(chamadas.length, "não chamou o modelo").toBe(1);
    expect(chamadas[0].system, "o SYSTEM não diz de quem é o registro").toContain("Ana");
    expect(chamadas[0].system).toMatch(/linha do tempo é de \*\*Ana\*\*/);
  });

  it("MORDE: a regra de SUJEITO está no SYSTEM — não é regra de nome", async () => {
    const db = banco();
    await extrairESalvarEventos(db.cliente(), FAM, MEM, "a Ana começou a andar", [], "Ana");
    const s = chamadas[0].system;
    // As quatro cláusulas que os casos provados exigem.
    expect(s, "sumiu a regra de sujeito (caso B/G)").toMatch(/SUJEITO é Ana/);
    expect(s, "sumiu a regra de quem contou (caso F)").toMatch(/Quem CONTOU o fato não importa/);
    expect(s, "sumiu a regra de reação (caso E)").toMatch(/REAÇÃO de Ana/);
    expect(s, "sumiu o fallback conservador (caso G)").toMatch(/ambíguo[\s\S]{0,80}devolva \[\]/);
  });

  it("MORDE: sem nome, o SYSTEM volta ao antigo — é a porta da contaminação", async () => {
    // Existe por compatibilidade, e é exatamente o estado que causou o defeito.
    // O teste dos chamadores (abaixo) é o que impede alguém de cair aqui.
    const db = banco();
    await extrairESalvarEventos(db.cliente(), FAM, MEM, "começou a andar", [], null);
    expect(chamadas[0].system).not.toMatch(/DE QUEM É ESTE REGISTRO/);
  });
});

describe("o que NÃO mudou", () => {
  it("MORDE: o pré-filtro continua barrando o que não é evento (casos D, E, H)", async () => {
    // Estes três nem chegam ao modelo — e é correto: não são eventos.
    // Se o pré-filtro mudar, eles passam a custar uma chamada de IA cada.
    for (const texto of [
      "Minha irmã veio visitar e a Ana ficou super feliz.",
      "O João caiu e a Ana ficou muito assustada.",
      "Os dois ficaram doentes e não dormiram bem.",
    ]) {
      chamadas.length = 0;
      const db = banco();
      await extrairESalvarEventos(db.cliente(), FAM, MEM, texto, [], "Ana");
      expect(chamadas.length, `"${texto}" passou a chamar o modelo`).toBe(0);
      expect(db.linhas("eventos_membro").length).toBe(0);
    }
  });

  it("MORDE: o pré-filtro continua DEIXANDO PASSAR o que é evento (casos A, B, C, F, G)", async () => {
    for (const texto of [
      "A Ana começou a amarrar o próprio tênis essa semana.",
      "O irmão dela, João, começou a andar sozinho essa semana.",
      "Ele começou a fazer isso sozinho.",
      "Meu marido disse que a Ana começou a dormir melhor.",
      "O João começou a falar frases e a Ana ainda usa palavras soltas.",
    ]) {
      chamadas.length = 0;
      await extrairESalvarEventos(banco().cliente(), FAM, MEM, texto, [], "Ana");
      expect(chamadas.length, `"${texto}" deixou de chegar ao modelo`).toBe(1);
    }
  });

  it("MORDE: o evento continua sendo escrito no membro resolvido", async () => {
    const db = banco();
    await extrairESalvarEventos(db.cliente(), FAM, MEM, "a Ana começou a andar", [], "Ana");
    const evs = db.linhas("eventos_membro") as Array<Record<string, unknown>>;
    expect(evs.length).toBe(1);
    expect(evs[0].membro_atipico_id).toBe(MEM);
    expect(evs[0].family_account_id).toBe(FAM);
  });

  it("sem membro resolvido, não escreve nada e não chama o modelo", async () => {
    const db = banco();
    await extrairESalvarEventos(db.cliente(), FAM, null, "começou a andar", [], "Ana");
    expect(chamadas.length).toBe(0);
    expect(db.linhas("eventos_membro").length).toBe(0);
  });
});

describe("os dois canais passam o nome — senão a correção não alcança ninguém", () => {
  const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

  function chamada(depoisDe: string): string {
    const i = ORCH.indexOf(depoisDe);
    const j = ORCH.indexOf("extrairESalvarEventos", i);
    return ORCH.slice(j, ORCH.indexOf(");", j) + 2);
  }

  it("MORDE: o canal EXPERIMENTAL passa o nome", () => {
    const t = chamada("ayla_path: \"experimental\"");
    expect(t, "o experimental voltou a chamar sem o nome").toMatch(/ctxExp\.membros\.find/);
  });

  it("MORDE: o canal LEGACY passa o nome", () => {
    const t = chamada("const historicoDoMembro = semOutrosMembros");
    expect(t, "o legacy voltou a chamar sem o nome").toMatch(/nomePorMembro\.get/);
  });

  it("MORDE: nenhum dos dois abriu consulta nova para achar o nome", () => {
    // O nome tem de sair de estrutura JÁ carregada no turno. Uma consulta aqui
    // custaria ~390ms em produção (PEND-065) por uma string que já existe.
    for (const t of [chamada("ayla_path: \"experimental\""), chamada("const historicoDoMembro = semOutrosMembros")]) {
      expect(t, "apareceu consulta ao banco para achar o nome").not.toMatch(/\.from\(|await supabase/);
    }
  });
});

describe("custo e posição", () => {
  const SRC = readFileSync(resolve(__dirname, "eventos.ts"), "utf8");

  it("MORDE: continua UMA chamada de modelo, e só depois do pré-filtro", () => {
    expect((SRC.match(/messages\.create\(/g) ?? []).length).toBe(1);
    expect(SRC.indexOf("GATILHOS.test(texto)")).toBeLessThan(SRC.indexOf("messages.create("));
  });

  it("o extrator continua depois do envio da resposta", () => {
    // ⚠️ ESTA ASSERÇÃO É ESTRUTURAL, e a primeira versão dela estava ERRADA:
    // comparei com `dividirEmBolhas`, que aparece DEPOIS no arquivo e roda
    // ANTES — posição no texto não é ordem de execução. Aqui a comparação é
    // dentro do MESMO corpo de função, entre a persistência da resposta e a
    // extração, que é o único par em que texto e execução coincidem.
    //
    // A prova de que nada foi somado ao tempo percebido pela família é outra, e
    // é medida: 1 chamada de modelo, atrás do mesmo pré-filtro, e o system só
    // troca de conteúdo — não há consulta nem chamada nova.
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    const iExtrai = ORCH.indexOf("const historicoDoMembro = semOutrosMembros");
    const trechoAntes = ORCH.slice(0, iExtrai);
    const iPersistiu = trechoAntes.lastIndexOf("await persistirRegistro(");
    expect(iPersistiu, "a extração subiu para antes do fim do turno").toBeGreaterThan(0);
    expect(iExtrai).toBeGreaterThan(iPersistiu);
  });
});
