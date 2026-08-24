import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ehPerguntaComercial,
  precisaDeHumano,
  notaComercial,
  notaSuporte,
  linkPlanos,
} from "@/lib/billing/destino-comercial";
import { FATOS_COMERCIAIS } from "@/lib/billing/fatos-comerciais";

/**
 * PEND-115 + PEND-144 · o caminho OFICIAL ganha a verdade comercial, e as cinco
 * portas de queda para o Legacy ficam observáveis.
 *
 * ⚠️ O CASO REAL. Em 19/08 três perguntas diretas de preço ficaram sem resposta
 * no WhatsApp. Uma era de uma mãe em teste, com medo de ser cobrada. A correção
 * de 22/08 existia — e estava em `responder.ts`, o Legacy, que MEDI atender
 * **2,59%** dos turnos desde o rollout. `git log -S "FATOS_COMERCIAIS" --
 * experimental.ts` volta VAZIO: nunca esteve no caminho oficial.
 */

const EXPERIMENTAL = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
const ORCHESTRATOR = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const RESPONDER = readFileSync(resolve(__dirname, "responder.ts"), "utf8");
const PROMPT_WEB = readFileSync(resolve(__dirname, "../ia/prompt.ts"), "utf8");

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ─────────────────────────────────────────────────────────────────────────────
describe("A · as perguntas que a Ayla precisa reconhecer", () => {
  const DEVE_RECONHECER = [
    "quanto custa?",
    "quanto custa o plano?",
    "quais são os planos?",
    "quero assinar",
    "onde assino?",
    "como continuo depois do trial?",
    "quanto vou pagar depois do teste?",
    "me manda o link pra assinar",
    "qual o valor da mensalidade?",
  ];

  for (const t of DEVE_RECONHECER) {
    it(`1. "${t}" → é pergunta comercial`, () => {
      expect(ehPerguntaComercial(t)).toBe(true);
    });
  }

  it("2. e o que NÃO é comercial continua fora — o falso positivo importa", () => {
    for (const t of [
      "ele não quer assinar o caderno da escola",
      "meu plano é sair de casa mais cedo",
      "custa muito pra ele acordar",
      "o valor dele como pessoa",
      "vou assinar a autorização da escola",
    ]) {
      expect(ehPerguntaComercial(t)).toBe(false);
    }
  });

  it("2b. e 'teste' de criança NÃO vira conversa de dinheiro", () => {
    // Neste produto a criança faz teste de audiometria, teste do pezinho, teste
    // na escola. O padrão do fim do trial é estreito de propósito por causa
    // disto — responder preço a quem falava de exame seria o pior falso
    // positivo desta frente.
    for (const t of [
      "depois do teste de audiometria ele ficou agitado",
      "o teste do pezinho deu alterado",
      "amanhã tem o teste da escola",
      "quando acaba o teste dele com a fono?",
      "vamos continuar a terapia depois do teste",
    ]) {
      expect(ehPerguntaComercial(t)).toBe(false);
    }
  });

  it("2c. mas o fim do TESTE DO PRODUTO é comercial — é a hora da conversão", () => {
    for (const t of [
      "como continuo depois do trial?",
      "o que acontece quando acabar o teste grátis?",
      "meu período gratuito termina amanhã",
      "os 7 dias grátis acabaram, e agora?",
    ]) {
      expect(ehPerguntaComercial(t)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B · o OFICIAL recebe a verdade comercial", () => {
  it("3. importa as MESMAS funções que a web importa — nenhuma fonte nova", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/from "@\/lib\/billing\/fatos-comerciais"/);
    expect(src).toMatch(/from "@\/lib\/billing\/destino-comercial"/);
    for (const fn of ["ehPerguntaComercial", "precisaDeHumano", "notaComercial", "notaSuporte"]) {
      expect(src).toContain(fn);
    }
  });

  it("4. NÃO existe segunda fonte de preço no caminho oficial", () => {
    const src = semComentarios(EXPERIMENTAL);
    // preço em texto, link de planos escrito à mão, ou duração de teste solta
    expect(src).not.toMatch(/R\$/);
    expect(src).not.toMatch(/54,90|603,90/);
    expect(src).not.toMatch(/["'`][^"'`]*\/precos/);
    expect(src).not.toMatch(/TRIAL_DIAS\s*=/);
  });

  it("5. os fatos entram SEMPRE; as notas só no turno em que cabem", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("const comercial = ["), src.indexOf("const entrega ="));
    expect(bloco).toMatch(/FATOS_COMERCIAIS,/);
    expect(bloco).toMatch(/ehPerguntaComercial\(params\.mensagem\) \? notaComercial\(\) : ""/);
    expect(bloco).toMatch(/precisaDeHumano\(params\.mensagem\) \? notaSuporte\(\) : ""/);
  });

  it("6. e `comercial` entra no system, antes do formato", () => {
    const src = semComentarios(EXPERIMENTAL);
    const m = src.match(/system: \[([\s\S]*?)\]/);
    expect(m).not.toBeNull();
    const itens = m![1].split(",").map((x) => x.trim()).filter(Boolean);
    expect(itens).toContain("comercial");
    expect(itens.indexOf("comercial")).toBeLessThan(itens.indexOf("formato"));
    expect(itens.at(-1)).toBe("formato");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C · o destino é UM, e é o canônico", () => {
  it("7. a nota comercial manda o link de planos, não o suporte", () => {
    const nota = notaComercial();
    const link = linkPlanos();
    if (link) expect(nota).toContain(link);
    expect(nota).toMatch(/NÃO mande procurar suporte por causa de preço/);
  });

  it("8. o link canônico aponta para /precos", () => {
    const link = linkPlanos();
    // Pode ser null se a origem não estiver configurada — aí a nota tem
    // fallback próprio, e isso é fail-closed, não defeito.
    if (link) expect(link).toMatch(/\/precos$/);
  });

  it("9. suporte é para o que é de humano — e não para preço", () => {
    expect(precisaDeHumano("quanto custa?")).toBe(false);
    expect(notaSuporte()).toContain("94037-7337");
  });

  it("10. os fatos comerciais dizem a duração do teste, que a Ayla chutava", () => {
    expect(FATOS_COMERCIAIS).toMatch(/7 dias/);
    expect(FATOS_COMERCIAIS).toMatch(/nunca invente/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D · a WEB permanece inalterada e na mesma fonte", () => {
  it("11. continua importando e usando as mesmas funções", () => {
    expect(PROMPT_WEB).toMatch(/from "@\/lib\/billing\/fatos-comerciais"/);
    expect(PROMPT_WEB).toMatch(/ehPerguntaComercial\(userInput\) \? notaComercial\(\) : ""/);
    expect(PROMPT_WEB).toMatch(/precisaDeHumano\(userInput\) \? notaSuporte\(\) : ""/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("E · AS CINCO PORTAS ficam observáveis", () => {
  const PORTAS = [
    ["CONTEXTO_NULO", "loadFamiliaParaEnvio devolveu null — acontece ANTES do Oficial"],
    ["FORA_DO_OFICIAL", "ehFamiliaExperimental falso — a porta larga da variável de ambiente"],
    ["LLM_RESPOSTA_VAZIA", "o provider devolveu texto vazio"],
    ["FRONTEIRA_BARROU", "a rede de fronteiras recusou a resposta"],
    ["EXCECAO", "erro não tratado dentro do Oficial"],
  ] as const;

  it("12. o call site passa `onFalha` — o gancho deixou de ser código morto", () => {
    const src = semComentarios(ORCHESTRATOR);
    expect(src).toMatch(/onFalha: registrarQueda/);
  });

  it("13. e registra um evento PERSISTENTE, com severidade de erro", () => {
    const src = semComentarios(ORCHESTRATOR);
    const bloco = src.slice(src.indexOf("const registrarQueda ="), src.indexOf("if (ehFamiliaExperimental"));
    expect(bloco).toMatch(/kind: "ayla_oficial_cedeu"/);
    expect(bloco).toMatch(/severity: "error"/);
    expect(bloco).toMatch(/persistir: true/);
    expect(bloco).toMatch(/family_account_id: family\.id/);
  });

  for (const [motivo, porque] of PORTAS) {
    it(`14.${motivo} — ${porque}`, () => {
      const src = semComentarios(ORCHESTRATOR + EXPERIMENTAL);
      expect(src).toContain(motivo);
    });
  }

  it("15. as duas portas de FORA do Oficial são registradas pelo orquestrador", () => {
    const src = semComentarios(ORCHESTRATOR);
    expect(src).toMatch(/registrarQueda\("CONTEXTO_NULO"/);
    expect(src).toMatch(/registrarQueda\("FORA_DO_OFICIAL"/);
  });

  it("16. e as três de DENTRO continuam saindo por `onFalha`", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/params\.onFalha\?\.\(\s*"LLM_RESPOSTA_VAZIA"/);
    expect(src).toMatch(/params\.onFalha\?\.\("FRONTEIRA_BARROU"/);
    expect(src).toMatch(/params\.onFalha\?\.\("EXCECAO"/);
  });

  it("17. texto e áudio ficam distinguíveis no evento", () => {
    const src = semComentarios(ORCHESTRATOR);
    const bloco = src.slice(src.indexOf("const registrarQueda ="), src.indexOf("if (ehFamiliaExperimental"));
    expect(bloco).toMatch(/midia: inbound\.midiaTipo === "audio" \? "audio" : "texto"/);
  });

  it("18. NADA da conversa entra no evento — só métrica e motivo", () => {
    const src = semComentarios(ORCHESTRATOR);
    const bloco = src.slice(src.indexOf("const registrarQueda ="), src.indexOf("if (ehFamiliaExperimental"));
    // o texto da mãe nunca é carregado para o payload
    expect(bloco).not.toMatch(/inbound\.texto/);
    expect(bloco).not.toMatch(/mensagem:\s*inbound/);
    expect(bloco).not.toMatch(/exp\.texto|resp\.texto/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("F · a telemetria nunca custa a resposta da família", () => {
  it("19. o registro é `void`, não `await` — o turno não espera por ele", () => {
    const src = semComentarios(ORCHESTRATOR);
    const bloco = src.slice(src.indexOf("const registrarQueda ="), src.indexOf("if (ehFamiliaExperimental"));
    expect(bloco).toMatch(/void logEvent\(/);
    expect(bloco).not.toMatch(/await logEvent\(/);
  });

  it("20. e `logEvent` engole a própria falha, por construção", () => {
    const log = readFileSync(resolve(__dirname, "../log.ts"), "utf8");
    const persist = log.slice(log.indexOf("if (!evt.persistir"));
    expect(persist).toMatch(/try \{[\s\S]*catch/);
    expect(persist).toMatch(/nunca falhar o request por causa do log/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G · zero chamada de modelo a mais, e nada novo no Legacy", () => {
  it("21. o bloco comercial do Oficial não chama modelo nem banco", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("const comercial = ["), src.indexOf("const entrega ="));
    for (const proibido of ["await", "gerarConversacional", "messages.stream", "fetch(", "supabase"]) {
      expect(bloco).not.toContain(proibido);
    }
  });

  it("22. o Legacy NÃO ganhou nada — só continua sendo rede temporária", () => {
    const src = semComentarios(RESPONDER);
    // as mesmas quatro chamadas de antes, nem uma a mais
    expect((src.match(/notaComercial\(\)/g) ?? []).length).toBe(1);
    expect((src.match(/notaSuporte\(\)/g) ?? []).length).toBe(1);
    expect((src.match(/FATOS_COMERCIAIS/g) ?? []).length).toBe(2); // import + uso
  });

  it("23. e o Oficial não passou a depender do Legacy", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).not.toMatch(/from "\.\/responder"/);
    expect(src).not.toMatch(/from "@\/lib\/ayla\/responder"/);
    expect(src).not.toMatch(/nucleoConducao/);
  });
});
