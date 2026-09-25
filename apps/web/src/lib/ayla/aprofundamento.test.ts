import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APROFUNDAMENTOS,
  ESCOLHA_AMBOS,
  decidirAprofundamento,
  escolhasDaOferta,
  idDoBotao,
  labelDaEscolha,
  lerIdDoBotao,
  ramoDoFallback,
  ramosDaEscolha,
  respostaPedeRetornoDaFamilia,
  textoDaOferta,
  textoDoFallback,
} from "./aprofundamento";
import { esquemaDaResposta, instrucaoDoEnvelope, lerEnvelope } from "./lacuna-decisiva";
import { enviarListaBotoes, parseZapiWebhook } from "./whatsappSender";

const BASE = {
  ligado: true,
  candidatos: ["aprofundar_lidar", "aprofundar_brincar"],
  segurancaAberta: false,
  naturezaEmocional: "neutra" as const,
  naturezaDoTurno: "orientacao",
  fezPergunta: false,
  miniInvestigacao: false,
  conviteConcorrente: false,
  ofertaRecente: false,
};

describe("PEND-213 · portão editorial", () => {
  it("oferece somente quando há pelo menos dois caminhos bons", () => {
    expect(decidirAprofundamento(BASE)).toEqual({
      acao: "OFERECER",
      opcoes: ["aprofundar_lidar", "aprofundar_brincar"],
      motivo: "dois ou mais caminhos úteis",
    });
    expect(
      decidirAprofundamento({ ...BASE, candidatos: ["aprofundar_lidar"] }).acao,
    ).toBe("NAO_OFERECER");
  });

  it("prioriza dois caminhos para sempre deixar o terceiro botão aos dois", () => {
    expect(decidirAprofundamento({
      ...BASE,
      candidatos: ["aprofundar_lidar", "aprofundar_brincar", "aprofundar_crencas"],
    })).toEqual({
      acao: "OFERECER",
      opcoes: ["aprofundar_lidar", "aprofundar_brincar"],
      motivo: "dois ou mais caminhos úteis",
    });
  });

  it.each([
    ["flag", { ligado: false }],
    ["segurança", { segurancaAberta: true }],
    ["desabafo", { naturezaEmocional: "desabafo" as const }],
    ["incerteza", { naturezaEmocional: null }],
    ["conversa simples", { naturezaDoTurno: "simples" }],
    ["pergunta", { fezPergunta: true }],
    ["mini-investigação", { miniInvestigacao: true }],
    ["convite concorrente", { conviteConcorrente: true }],
    ["repetição", { ofertaRecente: true }],
  ])("bloqueia %s", (_nome, mudanca) => {
    expect(decidirAprofundamento({ ...BASE, ...mudanca }).acao).toBe("NAO_OFERECER");
  });

  it("o conteúdo rico fica no ramo, não na primeira resposta", () => {
    expect(APROFUNDAMENTOS.aprofundar_brincar.receita).toMatch(/materiais simples/i);
    expect(APROFUNDAMENTOS.aprofundar_brincar.receita).toMatch(/como aumentar o desafio/i);
    expect(APROFUNDAMENTOS.aprofundar_brincar.receita).toMatch(/quando parar/i);
    expect(APROFUNDAMENTOS.aprofundar_crencas.receita).toMatch(/CRIANÇA/);
    expect(APROFUNDAMENTOS.aprofundar_crencas.receita).toMatch(/ADULTO/);
    expect(APROFUNDAMENTOS.aprofundar_lidar.receita).toMatch(/sinal observável/i);
  });

  it("torna a brincadeira descobrível quando a família quer desenvolver uma habilidade", () => {
    const instrucao = instrucaoDoEnvelope();
    expect(instrucao).toMatch(/desenvolver uma habilidade/i);
    expect(instrucao).toMatch(/considere\s+proativamente aprofundar_brincar/i);
    expect(instrucao).toMatch(/Não espere que a família saiba pedir/i);
    expect(instrucao).toMatch(/não cria menu automático/i);
    expect(instrucao).toMatch(/Ordene os caminhos do que mais acrescenta valor/i);
  });

  it("mantém contratos semanticamente distintos para os três ramos", () => {
    const lidar = APROFUNDAMENTOS.aprofundar_lidar.receita;
    const brincar = APROFUNDAMENTOS.aprofundar_brincar.receita;
    const crencas = APROFUNDAMENTOS.aprofundar_crencas.receita;

    expect(lidar).toMatch(/MANEJO daquela situação concreta/);
    expect(brincar).toMatch(/EXPERIÊNCIA COMPARTILHADA/);
    expect(brincar).toMatch(/turno do adulto; turno da criança/);
    expect(brincar).toMatch(/mãe cansada/);
    expect(crencas).toMatch(/POSSÍVEIS INTERPRETAÇÕES/);
    expect(crencas).toMatch(/2–3 frases concretas/);
    expect(crencas).toMatch(/falar E agir/);
  });

  it("os três aprofundamentos respiram no WhatsApp sem virar relatório", () => {
    for (const { receita } of Object.values(APROFUNDAMENTOS)) {
      expect(receita).toMatch(/parágrafos curtos e espaço entre ideias/i);
      expect(receita).toMatch(/2–4 ações, passos, materiais, falas ou opções paralelas/i);
      expect(receita).toMatch(/1️⃣ 2️⃣… só quando houver sequência/i);
      expect(receita).toMatch(/• ou um emoji funcional para itens paralelos/i);
      expect(receita).toMatch(/blocos curtos com\s+espaço/i);
      expect(receita).toMatch(/Frase pronta fica em linha\s+própria/i);
      expect(receita).toMatch(/não os\s+esconda num parágrafo/i);
      expect(receita).toMatch(/Não transforme a resposta em relatório/i);
    }
  });

  it("não confunde frase pronta interrogativa com pergunta à família", () => {
    expect(respostaPedeRetornoDaFamilia('Diga: “Posso brincar?” Depois observe por dois minutos.')).toBe(false);
    expect(respostaPedeRetornoDaFamilia("Isso também acontece em lugares tranquilos?")).toBe(true);
  });

  it("não repete menu mecanicamente numa conversa de dez turnos", () => {
    const acoes = Array.from({ length: 10 }, (_, indice) =>
      decidirAprofundamento({
        ...BASE,
        ofertaRecente: indice > 0,
      }).acao,
    );
    expect(acoes).toEqual([
      "OFERECER",
      "NAO_OFERECER",
      "NAO_OFERECER",
      "NAO_OFERECER",
      "NAO_OFERECER",
      "NAO_OFERECER",
      "NAO_OFERECER",
      "NAO_OFERECER",
      "NAO_OFERECER",
      "NAO_OFERECER",
    ]);
  });

  it("usa a receita contextual como formato, sem concatenar o template genérico", () => {
    const fonte = readFileSync(resolve(process.cwd(), "src/lib/ayla/aprofundamento.ts"), "utf8");
    expect(fonte).toContain("prompt_template: config.receita");
    expect(fonte).not.toContain("`${tipo.prompt_template as string}");
  });

  it("leva a prova de skills e BPs até a telemetria da resposta", () => {
    const gerador = readFileSync(resolve(process.cwd(), "src/lib/ayla/aprofundamento.ts"), "utf8");
    const orquestrador = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
    expect(gerador).toContain("boasPraticasIds: contextoPronto.ctx.boasPraticas.map((bp) => bp.id)");
    expect(gerador).toContain("skills: contextoPronto.roteadas.map((r) => r.skill.name)");
    expect(orquestrador).toContain("boas_praticas_ids: boasPraticasIds");
    expect(orquestrador).toContain("n_boas_praticas: boasPraticasIds.length");
  });
});

describe("PEND-213 · correlação e fallback", () => {
  const oferta = "2d37fd9b-8971-4b4d-8cd1-96b62f455fc1";

  it("o ID carrega oferta opaca + ramo lógico, sem depender do label", () => {
    const id = idDoBotao(oferta, "aprofundar_brincar");
    expect(lerIdDoBotao(id)).toEqual({ ofertaId: oferta, ramo: "aprofundar_brincar" });
    expect(lerIdDoBotao(`${id}:lixo`)).toBeNull();
    expect(lerIdDoBotao("aprofundar_brincar")).toBeNull();
    expect(lerIdDoBotao(idDoBotao(oferta, ESCOLHA_AMBOS))).toEqual({
      ofertaId: oferta,
      ramo: ESCOLHA_AMBOS,
    });
  });

  it("fallback textual só aceita escolhas explícitas oferecidas", () => {
    const opcoes = ["aprofundar_lidar", "aprofundar_brincar"];
    expect(ramoDoFallback("Como lidar agora", opcoes)).toBe("aprofundar_lidar");
    expect(ramoDoFallback("brincar / passear", opcoes)).toBe("aprofundar_brincar");
    expect(ramoDoFallback("crenças + falas", opcoes)).toBeNull();
    expect(ramoDoFallback("quero os dois", opcoes)).toBe(ESCOLHA_AMBOS);
    expect(ramoDoFallback("quero ajuda", opcoes)).toBeNull();
  });

  it("oferece os dois como terceira escolha e expande na ordem original", () => {
    const opcoes = ["aprofundar_lidar", "aprofundar_brincar"] as const;
    expect(escolhasDaOferta(opcoes)).toEqual([
      "aprofundar_lidar",
      "aprofundar_brincar",
      ESCOLHA_AMBOS,
    ]);
    expect(labelDaEscolha(ESCOLHA_AMBOS)).toBe("Quero os dois");
    expect(ramosDaEscolha(ESCOLHA_AMBOS, opcoes)).toEqual(opcoes);
    expect(ramosDaEscolha("aprofundar_brincar", opcoes)).toEqual(["aprofundar_brincar"]);
  });

  it("a oferta é conversa, e o fallback ensina como responder", () => {
    const opcoes = ["aprofundar_lidar", "aprofundar_brincar"] as const;
    expect(textoDaOferta(opcoes)).toMatch(/o que fazer na hora/i);
    expect(textoDaOferta(opcoes)).toMatch(/os dois, em mensagens separadas/i);
    expect(textoDoFallback(opcoes)).toMatch(/Se os botões não aparecerem/i);
    expect(textoDoFallback(opcoes)).toContain("Como lidar agora");
    expect(textoDoFallback(opcoes)).toContain("Quero os dois");
  });
});

describe("PEND-213 · contrato oficial da Z-API", () => {
  const antigo = { ...process.env };

  beforeEach(() => {
    process.env.ZAPI_INSTANCE_ID = "inst";
    process.env.ZAPI_TOKEN = "tok";
    process.env.ZAPI_CLIENT_TOKEN = "client";
  });

  afterEach(() => {
    process.env = { ...antigo };
    vi.unstubAllGlobals();
  });

  it("lê buttonId, label e a mensagem referenciada sem regex no label", () => {
    const r = parseZapiWebhook({
      phone: "5511999999999",
      fromMe: false,
      momment: 1_700_000_000_000,
      messageId: "CLICK-1",
      referenceMessageId: "OFFER-1",
      buttonsResponseMessage: { buttonId: "ak1:id:ramo", message: "Brincar / passear" },
    });
    expect(r?.texto).toBe("Brincar / passear");
    expect(r?.interacao).toEqual({
      tipo: "botao",
      id: "ak1:id:ramo",
      label: "Brincar / passear",
      referenceMessageId: "OFFER-1",
    });
  });

  it("também preserva o ID estruturado de lista", () => {
    const r = parseZapiWebhook({
      phone: "5511999999999",
      fromMe: false,
      messageId: "CLICK-2",
      referenceMessageId: "OFFER-2",
      listResponseMessage: { selectedRowId: "row-2", title: "Como lidar agora" },
    });
    expect(r?.interacao?.tipo).toBe("lista");
    expect(r?.interacao?.id).toBe("row-2");
  });

  it("envia exatamente o endpoint e body documentados", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messageId: "MSG-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await enviarListaBotoes({
      phoneE164: "+5511999999999",
      mensagem: "Posso seguir por dois caminhos.",
      botoes: [
        { id: "a", label: "Como lidar agora" },
        { id: "b", label: "Brincar / passear" },
      ],
    });
    expect(r.messageId).toBe("MSG-1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/send-button-list");
    expect(JSON.parse(String(init.body))).toEqual({
      phone: "5511999999999",
      message: "Posso seguir por dois caminhos.",
      buttonList: {
        buttons: [
          { id: "a", label: "Como lidar agora" },
          { id: "b", label: "Brincar / passear" },
        ],
      },
    });
  });

  it("não envia menos de dois ou mais de três botões", async () => {
    await expect(
      enviarListaBotoes({ phoneE164: "+5511", mensagem: "x", botoes: [{ id: "a", label: "a" }] }),
    ).rejects.toThrow(/2 a 3/);
  });
});

describe("PEND-213 · envelope e fiação", () => {
  it("o modelo só sugere ramos dentro do enum fechado", () => {
    const schema = esquemaDaResposta() as {
      json_schema: { schema: { properties: { aprofundamentos: { items: { enum: string[] } } } } };
    };
    expect(schema.json_schema.schema.properties.aprofundamentos.items.enum).toEqual([
      "aprofundar_lidar",
      "aprofundar_brincar",
      "aprofundar_crencas",
    ]);
    const env = lerEnvelope(
      JSON.stringify({
        fala: "Primeiro, tente reduzir a pressão.",
        campo_investigado: null,
        campos_investigados: [],
        aprofundamentos: ["aprofundar_lidar", "inventado", "aprofundar_brincar"],
      }),
    );
    expect(env.aprofundamentos).toEqual(["aprofundar_lidar", "aprofundar_brincar"]);
  });

  it("a migração faz claim atômico e não duplica a conversa", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "../../supabase/migrations/0090_aprofundamento_contextual_whatsapp.sql"),
      "utf8",
    );
    expect(sql).toMatch(/update public\.ayla_aprofundamento_ofertas o[\s\S]*status in \('preparada', 'oferecida'\)/i);
    expect(sql).toMatch(/p_ramo = any\(o\.opcoes\)/i);
    expect(sql).toMatch(/source_inbound_message_id uuid[^\n]+ayla_messages/i);
    expect(sql).not.toMatch(/pedido_original|texto_original|fala_original/i);
    expect(sql).toMatch(/grant select, insert, update, delete[\s\S]*to service_role/i);
  });

  it("o claim novo consome o clique e aceita os dois somente para duas opções", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "../../supabase/migrations/0092_aprofundamento_ambos_e_turno.sql"),
      "utf8",
    );
    expect(sql).toMatch(/update public\.ayla_messages m[\s\S]*processada_em = coalesce/i);
    expect(sql).toMatch(/m\.id = p_inbound_escolha_id[\s\S]*m\.family_account_id = p_family_account_id/i);
    expect(sql).toMatch(/p_ramo = 'aprofundar_ambos' and cardinality\(o\.opcoes\) = 2/i);
    expect(sql).toMatch(/from interacao_consumida/i);
  });

  it("o clique é interceptado antes do comando e da classificação", () => {
    const src = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
    const persistiu = src.indexOf("let inboundMessageRowId");
    const clique = src.indexOf("processarEscolhaAprofundamento(supabase");
    const comando = src.indexOf("const cmd = detectarComando");
    const decisor = src.indexOf("await decidirTurno(");
    expect(persistiu).toBeGreaterThan(-1);
    expect(clique).toBeGreaterThan(persistiu);
    expect(clique).toBeLessThan(comando);
    expect(clique).toBeLessThan(decisor);
  });

  it("a resposta do clique encerra o turno antes do fluxo que poderia oferecer outro menu", () => {
    const src = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
    const clique = src.indexOf("const aprofundada = await processarEscolhaAprofundamento(");
    const retorno = src.indexOf("if (aprofundada) return aprofundada;", clique);
    const fluxoComum = src.indexOf("const cmd = detectarComando", retorno);
    expect(clique).toBeGreaterThan(-1);
    expect(retorno).toBeGreaterThan(clique);
    expect(fluxoComum).toBeGreaterThan(retorno);
  });

  it("quero os dois prepara duas respostas completas e envia dois balões", () => {
    const src = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
    expect(src).toContain("const aprofundadas = await Promise.all(ramos.map");
    expect(src).toContain("for (const [indice, aprofundada] of aprofundadas.entries())");
    expect(src).toContain("total: aprofundadas.length");
    expect(src).toContain("emConjunto: ramos.length > 1");
  });

  it("só aciona o fallback quando o provedor de botões falha", () => {
    const src = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
    const inicio = src.indexOf("async function publicarOfertaAprofundamento(");
    const fim = src.indexOf("async function idiomaDaFamilia(", inicio);
    const funcao = src.slice(inicio, fim);
    const envioBotao = funcao.indexOf("provider = await enviarListaBotoes(");
    const capturaFalhaBotao = funcao.indexOf("} catch (erroBotao)", envioBotao);
    const envioFallback = funcao.indexOf("const fallback = await enviarEPersistir", capturaFalhaBotao);
    const persistenciaOferta = funcao.indexOf('from("ayla_messages")', envioFallback);

    expect(envioBotao).toBeGreaterThan(-1);
    expect(capturaFalhaBotao).toBeGreaterThan(envioBotao);
    expect(envioFallback).toBeGreaterThan(capturaFalhaBotao);
    expect(persistenciaOferta).toBeGreaterThan(envioFallback);
    expect(funcao.slice(persistenciaOferta)).not.toContain("enviarEPersistir(supabase");
  });

  it("não há rollout por família: só flag global e rollback", () => {
    const src = readFileSync(new URL("./aprofundamento-tipos.ts", import.meta.url), "utf8");
    expect(src).toContain('process.env.AYLA_APROFUNDAMENTO_WHATSAPP === "on"');
    expect(src).not.toMatch(/FAMILY_IDS|allowlist|piloto/i);
    const health = readFileSync(
      resolve(process.cwd(), "src/app/api/health/route.ts"),
      "utf8",
    );
    expect(health).toContain("ayla_aprofundamento_whatsapp: aprofundamentoGlobalLigado()");
  });
});
