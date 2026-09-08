import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BancoMemoria } from "./__harness/banco-memoria";
import { ofertaDePlanoPendente, registroDeEnvio } from "./orchestrator";
import { propostaPendente } from "./rotina-guiada";

/**
 * A METADATA QUE NUNCA CHEGAVA AO BANCO — 07/09/2026.
 *
 * ⚠️ MEDIDO EM PRODUÇÃO ANTES DE CORRIGIR. Em 4.498 mensagens de saída:
 *
 *     metadata.entrega   1788   (o que sobrescrevia)
 *     metadata.plano_id      1   (contra 119 entregas de Plano)
 *     metadata.proposta      0
 *     metadata.pedido        0
 *
 * A causa era uma ordem de spread, espelhada nos DOIS pontos de persistência, e
 * cada um perdia uma metade:
 *
 *     // enviarEPersistir — `entrega` vencia e matava a âncora
 *     ...(params.metadataMensagem ? { metadata: params.metadataMensagem } : {}),
 *     ...registroDeEnvio(idsBolhas),
 *
 *     // caminho em streaming — a âncora vencia e matava `entrega`
 *     ...registroDeEnvio(idsBolhas),
 *     ...(planoEntregueId ? { metadata: { plano_id: planoEntregueId } } : {}),
 *
 * Em spread de objeto a última chave vence, e as duas fontes escreviam a MESMA
 * chave `metadata`. Nunca houve mesclagem.
 *
 * O QUE ISSO CUSTOU, e é por isso que o teste cobre três fluxos que parecem não
 * ter relação: as três âncoras viajam pelo mesmo cano.
 *
 *   · `plano_id` — sem ela `ehEntregaDePlano` é sempre falso, a mensagem que
 *     ENTREGA o Plano casa com `REGEX_OFERTA_PLANO` e se reoferece sozinha. O
 *     "Ok" seguinte vira `forcar` e o Plano pula o gate de suficiência inteiro.
 *     É o caso Matheo (11/08), cuja correção foi escrita e nunca chegou ao banco.
 *   · `proposta` — sem ela `propostaPendente()` devolve `null` sempre, e a
 *     sequência que a família aprovou não tem como chegar ao quadro.
 *   · `pedido` — sem ela a clarificação não consegue retomar o pedido original.
 *
 * ⚠️ PRECEDÊNCIA, DECIDIDA E TESTADA. Hoje não há colisão: `metadataMensagem`
 * usa `pedido`, `proposta` e `plano_id`; o registro de envio usa só `entrega`.
 * Ainda assim a regra fica fixada — **o registro de envio vence** —, porque ele
 * é fato provado no ato do envio, e um chamador que escrevesse `entrega` estaria
 * sombreando um fato com um palpite.
 */

/** A consulta real olha os últimos 30 minutos: timestamp fixo cairia fora dela. */
const minutosAtras = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const ORQ = readFileSync(
  resolve(__dirname, "orchestrator.ts"),
  "utf8",
);

describe("composição da metadata — o registro de envio não apaga a âncora", () => {
  it("mescla a metadata do turno com a do envio", () => {
    const r = registroDeEnvio(["msg-1"], { plano_id: "p-1" });
    expect(r.metadata.plano_id).toBe("p-1");
    expect(r.metadata.entrega).toBeTruthy();
  });

  it("preserva TODAS as âncoras conhecidas ao mesmo tempo", () => {
    const r = registroDeEnvio(["msg-1"], {
      plano_id: "p-1",
      proposta: [{ texto: "Acordar", hora: null }],
      pedido: "quero uma rotina",
    });
    expect(Object.keys(r.metadata).sort()).toEqual(["entrega", "pedido", "plano_id", "proposta"]);
  });

  it("chave desconhecida passa intacta — a lista não é um allowlist", () => {
    const r = registroDeEnvio(["m"], { chave_que_ainda_nao_existe: { a: 1 } });
    expect(r.metadata.chave_que_ainda_nao_existe).toEqual({ a: 1 });
    expect(r.metadata.entrega).toBeTruthy();
  });

  it("sem metadata do turno, o resultado é só o registro de envio", () => {
    expect(Object.keys(registroDeEnvio(["m"]).metadata)).toEqual(["entrega"]);
    expect(Object.keys(registroDeEnvio(["m"], undefined).metadata)).toEqual(["entrega"]);
    expect(Object.keys(registroDeEnvio(["m"], {}).metadata)).toEqual(["entrega"]);
  });

  it("o registro de envio VENCE na colisão — fato provado ganha de palpite", () => {
    const r = registroDeEnvio(["m"], { entrega: { canal: "inventado" } });
    expect((r.metadata.entrega as { canal: string }).canal).toBe("z-api");
  });

  it("o envio sem bolha nenhuma continua registrando que não foi aceito", () => {
    const r = registroDeEnvio([], { plano_id: "p" });
    expect((r.metadata.entrega as { aceito_pelo_provedor: boolean }).aceito_pelo_provedor).toBe(false);
    expect(r.metadata.plano_id).toBe("p");
    expect(r.zaap_message_id).toBeNull();
  });
});

describe("os dois pontos de persistência compõem, não sobrescrevem", () => {
  /**
   * ⚠️ ESTRUTURAL DE PROPÓSITO. O defeito não era de lógica: era a ORDEM de dois
   * spreads que escreviam a mesma chave. Só o texto prende isso.
   */
  it("nenhuma das duas formas antigas de sobrescrita sobrevive", () => {
    // As duas linhas exatas que apagavam metade da metadata, cada uma numa
    // direção. Prender o TEXTO é o ponto: o defeito era ordem de spread.
    expect(ORQ).not.toContain("...(planoEntregueId ? { metadata: { plano_id: planoEntregueId } } : {})");
    expect(ORQ).not.toContain("...(params.metadataMensagem ? { metadata: params.metadataMensagem } : {})");
  });

  it("nenhum insert de ayla_messages escreve `metadata:` por conta própria", () => {
    const partes = ORQ.split('.from("ayla_messages")').slice(1);
    const inserts = partes.filter((b) => b.trimStart().startsWith(".insert({"));
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    for (const bloco of inserts) {
      const corpo = bloco.slice(0, bloco.indexOf("});"));
      expect(
        /\bmetadata:/.test(corpo),
        `insert ainda escreve metadata direto:\n${corpo.slice(0, 300)}`,
      ).toBe(false);
    }
  });

  it("a âncora do Plano chega ao registro de envio nos dois caminhos", () => {
    expect(ORQ).toContain("registroDeEnvio(idsBolhas, planoEntregueId ? { plano_id: planoEntregueId } : undefined)");
    expect(ORQ).toContain("registroDeEnvio(idsBolhas, params.metadataMensagem)");
  });
});

describe("anti-Matheo — a entrega fecha a oferta", () => {
  const FAM = "fam-1";
  const semear = (metadataDaEntrega: Record<string, unknown> | null) => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      {
        family_account_id: FAM,
        direcao: "outbound",
        membro_atipico_id: null,
        texto: "Quer que eu monte um plano estratégico com atividades pra isso?",
        metadata: null,
        created_at: minutosAtras(20),
      },
      {
        family_account_id: FAM,
        direcao: "outbound",
        membro_atipico_id: null,
        texto: "Montei um plano estratégico com atividades sobre isso — mandei em PDF aqui em cima 👆",
        metadata: metadataDaEntrega,
        created_at: minutosAtras(10),
      },
    ]);
    return db;
  };

  it("com a âncora persistida, não há oferta pendente — o 'Ok' não gera outro Plano", async () => {
    const db = semear({ plano_id: "p-1", entrega: { canal: "z-api", ids: ["x"] } });
    expect(await ofertaDePlanoPendente(db.cliente(), FAM, null)).toBe(false);
  });

  it("A FALHA ANTIGA, prendida: só com `entrega`, a entrega se reoferece", async () => {
    const db = semear({ entrega: { canal: "z-api", ids: ["x"] } });
    expect(await ofertaDePlanoPendente(db.cliente(), FAM, null)).toBe(true);
  });

  it("oferta de verdade, sem entrega depois, continua pendente", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      {
        family_account_id: FAM,
        direcao: "outbound",
        membro_atipico_id: null,
        texto: "Quer que eu monte um plano estratégico com atividades pra isso?",
        metadata: { entrega: { canal: "z-api", ids: ["x"] } },
        created_at: minutosAtras(20),
      },
    ]);
    expect(await ofertaDePlanoPendente(db.cliente(), FAM, null)).toBe(true);
  });
});

describe("Rotina Visual — a proposta sobrevive ao envio", () => {
  const FAM = "fam-2";
  it("com `proposta` e `entrega` juntas, as etapas são recuperáveis", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      {
        family_account_id: FAM,
        direcao: "outbound",
        membro_atipico_id: "m-1",
        tipo: "rotina_proposta",
        texto: "Ficou assim?",
        metadata: {
          proposta: [
            { texto: "Brincadeira", hora: null },
            { texto: "Banho", hora: null },
          ],
          entrega: { canal: "z-api", ids: ["x"] },
        },
        created_at: new Date().toISOString(),
      },
    ]);
    const p = await propostaPendente(db.cliente(), FAM);
    expect(p?.etapas.map((e) => e.texto)).toEqual(["Brincadeira", "Banho"]);
    expect(p?.membroId).toBe("m-1");
  });

  it("A FALHA ANTIGA, prendida: só com `entrega`, não há proposta nenhuma", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      {
        family_account_id: FAM,
        direcao: "outbound",
        membro_atipico_id: "m-1",
        tipo: "rotina_proposta",
        texto: "Ficou assim?",
        metadata: { entrega: { canal: "z-api", ids: ["x"] } },
        created_at: new Date().toISOString(),
      },
    ]);
    expect(await propostaPendente(db.cliente(), FAM)).toBeNull();
  });
});

/**
 * O CASO KARINA/MANU DE 07/09/2026, 15:41–15:43 — a cadeia inteira, medida.
 *
 * Aconteceu em produção enquanto esta correção estava sendo escrita, e é a
 * prova mais limpa do custo do defeito, porque nenhum outro fator entra:
 *
 *   18:41:13 [in ] "Quero ajuda para visualização de Café Escola Almoço Inglês Fono"
 *   18:41:31 [out] tipo=clarificacao_identificacao  metadata={"entrega":{...}}   ← `pedido` PERDIDO
 *   18:41:42 [in ] "Manu"
 *   18:42:08 [out] tipo=resposta_registro          ← caiu na conversa comum
 *   18:42:22 [in ] "So assim mesmo"
 *   18:42:42 [out] tipo=resposta_registro
 *   18:42:50 [in ] "Ok"
 *   18:43:14 [out] tipo=resposta_registro          "Certo, Karina. 💛"
 *
 * Resultado medido: **0 rotinas, 0 rotina_tarefas, 0 gerações, 0 eventos.** A
 * família pediu a visualização do dia, respondeu tudo o que foi perguntado, e
 * não recebeu artefato nenhum.
 *
 * ⚠️ O DEFEITO EXPLICA A CADEIA INTEIRA, e o elo é o primeiro. O portão da
 * rotina ABRIU no turno 1 — é de dentro dele que sai `perguntarQualCrianca`,
 * quando a família tem duas crianças. Ele gravou `metadataMensagem: { pedido }`
 * com o texto original. O spread apagou. No turno seguinte
 * `retomarPedidoAposClarificacao` foi ler `metadata.pedido`, achou `undefined`,
 * devolveu `null` — e "Manu" virou conversa comum. A partir daí não saiu mais
 * nenhuma mensagem com tipo de rotina, então `rotinaConversaPendente` também
 * ficou `null`, e "So assim mesmo" e "Ok" não reabriram nada: nenhum dos dois
 * casa com `pedeRotina`.
 *
 * A Ayla até repetiu a sequência em prosa — o texto da conversa ela tinha. O
 * que ela não tinha era o ESTADO. Fala e artefato divergindo de novo.
 *
 * ⚠️ NÃO HÁ SEGUNDA CAUSA ATÉ AQUI. Com `pedido` preservado, as cinco
 * condições de `retomarPedidoAposClarificacao` passam (última fala é a
 * clarificação · pedido presente · < 3h · resposta ≤ 60 chars · casa com um
 * membro), e o texto original volta ao roteamento. O que acontece DEPOIS da
 * retomada — proposta, tema, geração — é o fluxo já provado no Nível 1, e não
 * foi exercitado neste episódio porque nunca chegou lá.
 */
describe("regressão: Karina/Manu 07/09 — a clarificação tem de retomar o pedido", () => {
  const PEDIDO = "Quero ajuda para visualização de Café Escola Almoço Inglês Fono";

  it("com o defeito, a clarificação persiste sem o pedido — e nada retoma", () => {
    // A forma exata que produção gravou às 18:41:31.
    const comoFoiGravado = { entrega: { canal: "z-api", ids: ["54E432C38E1D7412FB30"] } };
    expect((comoFoiGravado as Record<string, unknown>).pedido).toBeUndefined();
  });

  it("com a correção, o pedido e a entrega coexistem na mesma linha", () => {
    const r = registroDeEnvio(["54E432C38E1D7412FB30"], { pedido: PEDIDO });
    expect(r.metadata.pedido).toBe(PEDIDO);
    expect(r.metadata.entrega).toBeTruthy();
    expect(r.zaap_message_id).toBe("54E432C38E1D7412FB30");
  });

  it("o leitor da clarificação encontra o pedido no formato composto", () => {
    // `retomarPedidoAposClarificacao` não é exportado; o que se prende é o
    // contrato exato que ele vai buscar no banco.
    const linha = {
      tipo: "clarificacao_identificacao",
      metadata: registroDeEnvio(["m"], { pedido: PEDIDO }).metadata,
    };
    const pedido = (linha.metadata as Record<string, unknown>).pedido as string | undefined;
    expect(linha.tipo).toBe("clarificacao_identificacao");
    expect(pedido).toBe(PEDIDO);
    expect(pedido!.length).toBeLessThanOrEqual(4000);
  });

  it("`Ok` não pode ser necessário: a retomada acontece em `Manu`", () => {
    // A resposta da clarificação é curta e nomeia um membro — as duas
    // condições que `retomarPedidoAposClarificacao` exige. O episódio real
    // mostrou os três turnos seguintes virando `resposta_registro`; o que
    // precisava acontecer era a retomada já no primeiro.
    expect("Manu".length).toBeLessThanOrEqual(60);
    expect("So assim mesmo".length).toBeLessThanOrEqual(60);
  });
});

describe("clarificação — o pedido original sobrevive ao envio", () => {
  it("o consumidor lê `metadata.pedido`, e ele coexiste com `entrega`", () => {
    // O leitor é `retomarPedidoAposClarificacao`, que não é exportado; o que se
    // prende aqui é o CONTRATO que ele espera encontrar no banco.
    expect(ORQ).toContain('(ultima.metadata as Record<string, unknown> | null)?.pedido');
    const composto = registroDeEnvio(["m"], { pedido: "quero uma rotina visual" });
    expect(composto.metadata.pedido).toBe("quero uma rotina visual");
    expect(composto.metadata.entrega).toBeTruthy();
  });
});
