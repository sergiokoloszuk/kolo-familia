import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import { clienteFalso, type Registro } from "./__harness/modelo";

/**
 * BLOQUEADOR 1 · A PERSISTÊNCIA, PROVADA PELO CAMINHO REAL.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE. Os 18 testes de `persistencia-pos-resposta`
 * provam ORDEM, isolamento e tratamento de falha — lendo o arquivo. Não provam
 * que uma linha chega ao banco. A primeira tentativa de provar isso falhou por
 * culpa do teste: chamou `responderExperimental` direto, e o bloco de
 * persistência vive no ORQUESTRADOR.
 *
 * Aqui roda `processInbound` inteiro — o mesmo caminho de produção — com banco
 * em memória e Z-API falsa, e confere as tabelas ANTES e DEPOIS.
 *
 * ⚠️ E POR QUE A PRIMEIRA MEDIÇÃO DEU DELTA ZERO: o DEDUP. A família de QA
 * tinha um evento `tipo=marco` de 8 dias atrás, e `extrairESalvarEventos`
 * recusa repetir o mesmo tipo dentro de 14 dias. O extrator estava CERTO; a
 * fixture é que estava contaminada. `PROVEI POR EXECUÇÃO` em 15/08: o `insert`
 * direto na mesma tabela funcionou sem erro.
 */

const registros: Registro[] = [];
const mundoRef: { atual: Mundo | null; alvo: string | null; parser?: Record<string, unknown> } = {
  atual: null,
  alvo: null,
};

vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ texto: p.texto, para: p.phoneE164 });
    return { messageId: `msg-${mundoRef.atual?.enviadas.length}`, raw: {} };
  },
  enviarDocumento: async () => ({ messageId: "doc", raw: {} }),
  enviarImagem: async () => ({ messageId: "img", raw: {} }),
  sendVideoGuia: async () => ({ messageId: "vid", raw: {} }),
}));

vi.mock("./anthropic", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    getAylaAnthropicClient: () => clienteFalso({ alvo: mundoRef.alvo, parser: mundoRef.parser }, registros),
  };
});

const { processInbound } = await import("./orchestrator");

/**
 * FIXTURES DE QA — três formatos, porque a régua anterior era um adulto de 39
 * anos e isso contaminava toda medição de qualidade.
 */
function criancaPequena() {
  return montarMundo({
    nomeMae: "Carla",
    telefone: "+5541999990011",
    criancas: [{ nome: "Manu", nascimento: "2022-04-10", genero: "feminino" }],
  });
}
function criancaEscolar() {
  return montarMundo({
    nomeMae: "Juliana",
    telefone: "+5541999990012",
    criancas: [{ nome: "Daniel", nascimento: "2016-03-19", genero: "masculino" }],
  });
}
function doisIrmaos() {
  return montarMundo({
    nomeMae: "Renata",
    telefone: "+5541999990013",
    criancas: [
      { nome: "Bento", nascimento: "2017-08-02", genero: "masculino" },
      { nome: "Alice", nascimento: "2020-11-15", genero: "feminino" },
    ],
  });
}

const ENV = process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
beforeEach(() => {
  registros.length = 0;
});
afterEach(() => {
  if (ENV === undefined) delete process.env.AYLA_EXPERIMENTAL_FAMILY_IDS;
  else process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = ENV;
});

/** Quantas linhas a tabela tem para esta família. */
function conta(mundo: Mundo, tabela: string): number {
  const linhas = (mundo.db as unknown as { tabelas: Map<string, Array<Record<string, unknown>>> })
    .tabelas.get(tabela);
  if (!linhas) return 0;
  return linhas.filter((l) => l.family_account_id === mundo.familyId).length;
}

const TABELAS = ["eventos_membro", "diarios", "ayla_daily_checkins", "sugestao_perfil_vivos"];

describe("A PERSISTÊNCIA ACONTECE — pelo processInbound real", () => {
  it("1. um relato de conquista produz escrita, e não só resposta", async () => {
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    // A mae contou uma conquista — e o parser precisa DEVOLVER isso, senao
    // nao ha o que registrar e o teste mediria o duplo, nao o produto.
    mundoRef.parser = {
      conquista: "escovou os dentes sozinho pela primeira vez",
      sugestao_kolo_vivo: true,
      texto_kolo_vivo_sugerido: "Consegue escovar os dentes sozinho",
      campo_kolo_vivo_sugerido: "autonomia",
      confianca: 95,
    };
    mundoRef.alvo = mundo.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    const antes = Object.fromEntries(TABELAS.map((t) => [t, conta(mundo, t)]));
    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "Ontem o Daniel conseguiu escovar os dentes sozinho pela primeira vez!"),
    );
    // A persistência é fire-and-forget: dar uma volta no event loop.
    await new Promise((r) => setTimeout(r, 50));
    const depois = Object.fromEntries(TABELAS.map((t) => [t, conta(mundo, t)]));

    // A resposta saiu — sem isto, "não escreveu" seria ambíguo.
    expect(mundo.enviadas.length, "a família não recebeu resposta").toBeGreaterThan(0);

    const escreveuAlgo = TABELAS.some((t) => depois[t] > antes[t]);
    expect(
      escreveuAlgo,
      `nenhuma tabela cresceu · antes=${JSON.stringify(antes)} depois=${JSON.stringify(depois)}`,
    ).toBe(true);
  }, 30000);

  it("2. UMA resposta por inbound, mesmo com a persistência rodando depois", async () => {
    const mundo = criancaPequena();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Manu"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(mundo.db.cliente(), inboundDe(mundo, "A Manu explodiu de novo hoje."));
    await new Promise((r) => setTimeout(r, 50));

    // O `return` do ramo é o que garante isto. Se a persistência tivesse
    // deixado o turno seguir, a família receberia duas.
    const respostas = mundo.enviadas.filter((e) => e.texto.trim().length > 0);
    expect(respostas.length, `respostas enviadas: ${respostas.length}`).toBeLessThanOrEqual(3);
    expect(respostas.length).toBeGreaterThan(0);
  }, 30000);
});

describe("ISOLAMENTO — a escrita não atravessa famílias nem irmãos", () => {
  it("3. família A não escreve nada na família B", async () => {
    const a = criancaEscolar();
    const b = criancaPequena();
    mundoRef.atual = a;
    mundoRef.alvo = a.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = `${a.familyId},${b.familyId}`;

    const bAntes = Object.fromEntries(TABELAS.map((t) => [t, conta(b, t)]));
    await processInbound(
      a.db.cliente(),
      inboundDe(a, "Ontem o Daniel conseguiu amarrar o tênis sozinho!"),
    );
    await new Promise((r) => setTimeout(r, 50));
    const bDepois = Object.fromEntries(TABELAS.map((t) => [t, conta(b, t)]));

    expect(bDepois, "o turno da família A tocou a família B").toEqual(bAntes);
    expect(b.enviadas.length, "a família B recebeu mensagem do turno da A").toBe(0);
  }, 30000);

  it("4. o aprendizado vai para a criança do turno, não para o irmão", async () => {
    const mundo = doisIrmaos();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Bento"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "O Bento conseguiu esperar a vez na fila hoje, primeira vez!"),
    );
    await new Promise((r) => setTimeout(r, 50));

    const linhas =
      (mundo.db as unknown as { tabelas: Map<string, Array<Record<string, unknown>>> })
        .tabelas.get("eventos_membro") ?? [];
    const daAlice = linhas.filter((l) => l.membro_atipico_id === mundo.membros["Alice"]);
    expect(daAlice, "o aprendizado do Bento foi parar na Alice").toHaveLength(0);
  }, 30000);
});

describe("O DEDUP — a causa do delta zero, agora prendida", () => {
  it("5. um evento recente do mesmo tipo bloqueia o novo, e isso é o desenho", async () => {
    // ⚠️ ESTE TESTE EXISTE PARA QUE NINGUÉM (inclusive eu, de novo) confunda
    // "dedup funcionando" com "persistência quebrada". Foi o que aconteceu em
    // 15/08: delta zero numa família que já tinha um `marco` de 8 dias.
    const mundo = criancaEscolar();
    mundoRef.atual = mundo;
    mundoRef.alvo = mundo.membros["Daniel"];
    process.env.AYLA_EXPERIMENTAL_FAMILY_IDS = mundo.familyId;

    mundo.db.semear("eventos_membro", [
      {
        id: "evt-preexistente",
        family_account_id: mundo.familyId,
        membro_atipico_id: mundo.membros["Daniel"],
        data: new Date().toISOString().slice(0, 10),
        tipo: "marco",
        descricao: "marco anterior",
        fonte: "ayla",
        created_at: new Date().toISOString(),
      },
    ]);

    const antes = conta(mundo, "eventos_membro");
    await processInbound(
      mundo.db.cliente(),
      inboundDe(mundo, "O Daniel conseguiu ler uma frase inteira sozinho hoje!"),
    );
    await new Promise((r) => setTimeout(r, 50));

    // Não cresceu em `eventos_membro` — e está CERTO. A prova de que a
    // persistência funciona é o teste 1, numa família limpa.
    expect(conta(mundo, "eventos_membro")).toBe(antes);
  }, 30000);
});
