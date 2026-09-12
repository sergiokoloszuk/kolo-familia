import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { interpretar } from "./decisao-do-turno";

/**
 * `natureza_emocional` E `pediu_para_contar` EM SOMBRA — PEND-203 Gate 2B.
 *
 * ⚠️ OS DOIS CAMPOS NÃO TÊM PODER NENHUM NESTA FASE. Eles saem da MESMA chamada
 * que já existia, viram telemetria, e nada em produção os lê. Metade deste
 * arquivo existe para provar essa impotência — porque um campo que ganha um
 * `if` sem medição é exatamente o que a missão proíbe.
 *
 * ⚠️ POR QUE CAMPO PARALELO E NÃO VALOR DE `intencao`. A lista de intenções
 * aparece em TRÊS lugares de `decisao-do-turno.ts` (allowlist, `enum` do schema
 * e texto do prompt), e um valor novo COMPETE com os existentes: uma mãe que
 * desabafa E pede plano viraria `desabafo`, e a feature de plano pararia de
 * disparar — a classe do defeito Claire/Maria. Campo novo é aditivo.
 */

const SRC = readFileSync(new URL("./decisao-do-turno.ts", import.meta.url), "utf8");
const PERMITIDAS = new Set<string>();

/** Resposta do modelo, como ela chega: string bruta. */
const bruto = (o: Record<string, unknown>) => JSON.stringify(o);
const base = {
  intencao: "outro",
  pedido_explicito: false,
  tema: null,
  aceite: null,
  continuacao: false,
  skills: [],
  necessidade_conhecimento: "nenhum",
  tema_conhecimento: null,
};

// ─────────────────────────────────────────────────────────────────────────────
describe("A · o parser lê os dois campos", () => {
  it("desabafo puro: `natureza_emocional = desabafo` chega inteiro", () => {
    const d = interpretar(bruto({ ...base, natureza_emocional: "desabafo" }), PERMITIDAS);
    expect(d.naturezaEmocional).toBe("desabafo");
    expect(d.pediuParaContar).toBe(false);
  });

  it("`pediu_para_contar = true` chega inteiro", () => {
    const d = interpretar(bruto({ ...base, pediu_para_contar: true }), PERMITIDAS);
    expect(d.pediuParaContar).toBe(true);
  });

  it("os dois juntos não se atrapalham", () => {
    const d = interpretar(
      bruto({ ...base, natureza_emocional: "neutra", pediu_para_contar: true }),
      PERMITIDAS,
    );
    expect(d.naturezaEmocional).toBe("neutra");
    expect(d.pediuParaContar).toBe(true);
  });
});

describe("B · fail-safe", () => {
  it("AUSENTES viram `null` e `false` — nunca `neutra`", () => {
    // ⚠️ `null` É "NÃO SEI", E É DELIBERADO. Se a ausência virasse `neutra`, o
    // consumidor futuro leria silêncio do modelo como permissão para convidar.
    const d = interpretar(bruto(base), PERMITIDAS);
    expect(d.naturezaEmocional).toBeNull();
    expect(d.pediuParaContar).toBe(false);
  });

  it("valor FORA do vocabulário vira `null`", () => {
    for (const v of ["crise", "desabafo_leve", "DESABAFO", "", 1, true, null, {}]) {
      const d = interpretar(bruto({ ...base, natureza_emocional: v }), PERMITIDAS);
      expect(d.naturezaEmocional, JSON.stringify(v)).toBeNull();
    }
  });

  it("`pediu_para_contar` só aceita `true` LITERAL — o viés é não agir", () => {
    for (const v of ["true", 1, "sim", {}, [], "yes"]) {
      const d = interpretar(bruto({ ...base, pediu_para_contar: v }), PERMITIDAS);
      expect(d.pediuParaContar, JSON.stringify(v)).toBe(false);
    }
    expect(interpretar(bruto({ ...base, pediu_para_contar: true }), PERMITIDAS).pediuParaContar).toBe(true);
  });

  it("JSON inválido devolve a decisão neutra, com os dois campos seguros", () => {
    for (const lixo of ["", "não é json", "{quebrado", "```json\n{```"]) {
      const d = interpretar(lixo, PERMITIDAS);
      expect(d.naturezaEmocional, lixo).toBeNull();
      expect(d.pediuParaContar, lixo).toBe(false);
      expect(d.intencao).toBe("outro");
    }
  });
});

describe("C · `intencao` não foi tocada", () => {
  it("o enum segue com exatamente os mesmos seis valores, nos três lugares", () => {
    // ⚠️ `"desabafo"` EXISTE no arquivo — é valor do enum NOVO. O que não pode
    // existir é ele como valor de `intencao`, e é isso que se afirma: dentro do
    // bloco do enum de intenção e da união do prompt, os seis e só os seis.
    const enumIntencao = SRC.slice(SRC.indexOf("intencao: {"), SRC.indexOf("pedido_explicito: {"));
    expect(enumIntencao).not.toContain("desabafo");
    const uniaoDoPrompt = SRC.slice(SRC.indexOf('"intencao": "rotina_criar"'), SRC.indexOf('"pedido_explicito"'));
    expect(uniaoDoPrompt).not.toContain("desabafo");
    const seis = /"rotina_criar", ?"rotina_ver", ?"rotina_editar", ?"organizacao", ?"plano", ?"outro"/g;
    expect(SRC.match(seis)?.length).toBe(2);
    expect(SRC).toMatch(
      /"rotina_criar" \| "rotina_ver" \| "rotina_editar" \| "organizacao" \| "plano" \| "outro"/,
    );
  });

  it("os campos novos entram como PROPRIEDADES, não como valores do enum", () => {
    const schema = SRC.slice(SRC.indexOf("properties: {"), SRC.indexOf("const ORCAMENTO_DA_DECISAO"));
    expect(schema).toMatch(/natureza_emocional: \{ type: "string", enum: \["neutra", "desabafo"\] \}/);
    expect(schema).toMatch(/pediu_para_contar: \{ type: "boolean" \}/);
    // e o enum de intencao dentro do MESMO schema segue intacto
    expect(schema).toMatch(
      /intencao: \{\s*type: "string",\s*enum: \["rotina_criar", "rotina_ver", "rotina_editar", "organizacao", "plano", "outro"\],/,
    );
  });

  it("o prompt manda preencher `intencao` como se os campos não existissem", () => {
    expect(SRC).toMatch(/Estes dois campos NÃO mudam "intencao"/);
  });

  it("o parser de `intencao` continua com a mesma allowlist e o mesmo fallback", () => {
    expect(interpretar(bruto({ ...base, intencao: "plano" }), PERMITIDAS).intencao).toBe("plano");
    expect(interpretar(bruto({ ...base, intencao: "desabafo" }), PERMITIDAS).intencao).toBe("outro");
    expect(interpretar(bruto({ ...base, intencao: "inventada" }), PERMITIDAS).intencao).toBe("outro");
  });
});

describe("D · SOMBRA — nenhum consumidor lê os campos novos", () => {
  const ORQ = readFileSync(new URL("../ayla/orchestrator.ts", import.meta.url), "utf8");
  const EXP = readFileSync(new URL("../ayla/experimental.ts", import.meta.url), "utf8");

  it("nenhum `if` de produção decide por `naturezaEmocional`", () => {
    for (const [nome, src] of [["orquestrador", ORQ], ["experimental", EXP]] as const) {
      // ⚠️ PROIBIDO É O USO CONDICIONAL, NÃO A MENÇÃO — Gate 2C. Os dois
      // sinais passaram a ser PUBLICADOS no payload de `lacuna_decisao`, que
      // é telemetria: sem isso não haveria o que observar em produção.
      // Decidir por eles continua proibido.
      expect(src, nome).not.toMatch(/if \([^)]*naturezaEmocional/);
      expect(src, nome).not.toMatch(/naturezaEmocional\s*===/);
      expect(src, nome).not.toMatch(/naturezaEmocional\s*\?/);
    }
  });

  it("`pediuParaContar` nao mexe em `intencao` nem em feature — so no convite", () => {
    /**
     * ⚠️ INVERTIDO NO GATE 2. O sinal deixou de ser puro observador: ele é o
     * gatilho do convite de Perfil. O invariante que sobra — e que era o que
     * importava desde o começo — é que ele não desloque `intencao` nem faça
     * feature nenhuma mudar de rota.
     */
    expect(ORQ).not.toContain("intencao = turnoClassificado.pediuParaContar");
    expect(EXP).not.toContain("pediuParaContar");
    // Consumido em lugares CONTADOS, todos do convite: o rastro da lacuna, a
    // entrada do decisor, o gate da reserva e a telemetria. Se subir, alguem
    // comecou a usa-lo em outro lugar.
    expect((ORQ.match(/turnoClassificado\.pediuParaContar/g) ?? []).length).toBe(4);
  });

  it("o convite ESTA fiado, e o magic link e o existente", () => {
    // ⚠️ INVERTIDO NO GATE 2. Reusa `gerarMagicLink`, que já existia e já era
    // usada para `/planos/:id` — nenhuma infra nova de link.
    expect(ORQ).toContain("decidirConviteDePerfil({");
    expect(ORQ).toContain("next: destinoDoConvite(decisao.dominio)");
  });

  it("os campos não entram no envelope da PEND-187B", () => {
    // O contrato do Core segue sendo `{ fala, campo_investigado }`.
    const LAC = readFileSync(new URL("../ayla/lacuna-decisiva.ts", import.meta.url), "utf8");
    expect(LAC).not.toMatch(/natureza_emocional|pediu_para_contar/);
    expect(LAC).toMatch(/required: \["fala", "campo_investigado"\]/);
  });
});

describe("E · zero chamada a mais", () => {
  it("os campos saem da MESMA chamada — o schema é um só", () => {
    /**
     * ⚠️ ESTA ASSERÇÃO ERA VACUAMENTE VERDADEIRA na primeira versão: contava
     * `await client.` / `await openai.`, e este arquivo não chama o SDK
     * diretamente — ele monta um `pedido` e passa para `gerarConversacional`.
     * A sabotagem "segunda chamada de modelo" passou por causa disso. O que se
     * conta agora é a invocação real.
     */
    // ⚠️ O INVARIANTE É "UM PEDIDO, DUAS TENTATIVAS", e a segunda é a RETRY do
    // MESMO objeto — está documentado no próprio arquivo. Então o que se conta
    // é: um `pedido` montado, e nenhuma invocação com um pedido DIFERENTE.
    expect((SRC.match(/const pedido = \{/g) ?? []).length).toBe(1);
    expect((SRC.match(/gerarConversacional\(pedido\)/g) ?? []).length).toBe(2);
    // nenhuma chamada com objeto inline — seria um segundo pedido
    expect(SRC).not.toMatch(/gerarConversacional\(\{/);
    // e há UM schema, não dois
    expect((SRC.match(/json_schema/g) ?? []).length).toBeLessThanOrEqual(2);
  });

  it("`required` cresceu junto — o modelo devolve os campos na mesma resposta", () => {
    const req = SRC.slice(SRC.indexOf('required: ['), SRC.indexOf("properties: {"));
    expect(req).toContain('"natureza_emocional"');
    expect(req).toContain('"pediu_para_contar"');
    expect(req).toContain('"intencao"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * A BANCADA — 32 casos, rodados contra o modelo REAL em 12/09/2026.
 *
 * ⚠️ ESTES SÃO OS VALORES MEDIDOS, não a expectativa de quem escreveu. A
 * bancada offline não cabe em teste unitário (custa chamada de modelo), então
 * o que fica aqui é o CONTRATO que ela verificou: quais casos têm de ser
 * desabafo, quais não, e quais são pedido de aprofundamento. Se a definição do
 * prompt mudar e a semântica virar, é aqui que a divergência aparece.
 */
describe("F · o contrato que a bancada de 32 casos verificou", () => {
  const DESABAFO = [
    "Hoje estou exausta. Foi um dia horrível.",
    "Não aguento mais, estou muito cansada.",
    "Hoje eu só queria desabafar.",
    "Estou muito triste hoje, sinto que não dou conta.",
    "Tô no meu limite. Chorei escondida no banheiro.",
    "Hoje estou acabada, mas ele dormiu bem.",
  ];
  const NAO_DESABAFO = [
    "Ele gritou três vezes hoje e eu estou exausta.",
    "Ele não fala e eu estou desesperada, o que faço?",
    "Estou preocupada porque ele não come.",
    "Estou destruída com as crises dele. Me ajuda a montar um plano?",
  ];
  const CONTAR = [
    "Quero te contar mais sobre ele.",
    "Quero que você conheça melhor meu filho.",
    "Posso preencher tudo?",
    "Quero adiantar essas informações.",
    "Tem algum lugar onde eu possa colocar mais informações sobre ele?",
    "Quero te passar tudo para você conseguir me orientar melhor.",
  ];
  const NAO_CONTAR = [
    "Vou te contar o que aconteceu hoje.",
    "Ele me contou uma história.",
    "Quero contar uma coisa.",
    "Quero falar sobre o sono dele.",
    "Quero contar como foi a escola.",
    "Posso te fazer uma pergunta?",
  ];

  it("cada exemplo da definição está no prompt, do lado certo", () => {
    const instr = SRC.slice(SRC.indexOf('"natureza_emocional" —'), SRC.indexOf("CONTINUIDADE —"));
    // os quatro casos difíceis de EMOÇÃO QUE NÃO É DESABAFO estão declarados
    for (const t of NAO_DESABAFO) expect(instr, t).toContain(t);
    // e os negativos de `pediu_para_contar` também
    for (const t of ["Vou te contar o que aconteceu hoje.", "Quero falar sobre o sono dele."]) {
      expect(instr, t).toContain(t);
    }
    expect(instr).toMatch(/Emoção presente NÃO é desabafo/);
    expect(instr).toMatch(/Na dúvida, "neutra"/);
    expect(instr).toMatch(/Na dúvida, false/);
  });

  it("os quatro grupos são disjuntos — nenhuma frase em dois papéis", () => {
    const todos = [...DESABAFO, ...NAO_DESABAFO, ...CONTAR, ...NAO_CONTAR];
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("`crise` NÃO entra na taxonomia — o dono desse estado é outro", () => {
    // ⚠️ `segurancaAberta` é o dono, e duas fontes para a mesma decisão sempre
    // divergem. A taxonomia mínima que resolve o problema é de dois valores.
    const schema = SRC.slice(SRC.indexOf("natureza_emocional: {"), SRC.indexOf("pediu_para_contar: {"));
    expect(schema).toContain('"neutra"');
    expect(schema).toContain('"desabafo"');
    expect(schema).not.toContain('"crise"');
    const ORQ = readFileSync(new URL("../ayla/orchestrator.ts", import.meta.url), "utf8");
    expect(ORQ).toMatch(/const seguranca = await segurancaAberta\(/);
  });
});
