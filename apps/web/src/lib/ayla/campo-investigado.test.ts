import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CHAVES_DECISIVAS,
  esquemaDaResposta,
  instrucaoDoEnvelope,
  lerEnvelope,
  jaRespondidas,
} from "./lacuna-decisiva";

/**
 * PEND-187B — O VÍNCULO ENTRE A PERGUNTA FEITA E O CAMPO INVESTIGADO.
 *
 * ⚠️ O QUE ISTO RESOLVE. A PEND-187A parou de AFIRMAR o que não se sabia:
 * `lacuna_sugerida` diz só que o Gate B ofereceu um campo. Ficou faltando saber
 * o que a Ayla de fato perguntou — e nos dois turnos reais da Manu (10/09/2026)
 * a sugestão foi `sensorial.perfil` e a pergunta feita foi outra, nas duas
 * vezes.
 *
 * ⚠️ E O QUE ISTO NÃO É. `campo_investigado` descreve a PERGUNTA. Nunca
 * significa respondido, aprendido, incorporado ou verdadeiro. Não fecha lacuna,
 * não entra em `jaRespondidas`, não é memória paralela. O Perfil continua sendo
 * a fonte de verdade sobre o que a Ayla sabe — a decisão da PEND-187A não é
 * revogada aqui, é complementada.
 */

const FONTE_EXP = readFileSync(new URL("./experimental.ts", import.meta.url), "utf8");
const FONTE_ORCH = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

describe("PEND-187B · o contrato de saída", () => {
  it("o enum é DERIVADO de CAMPOS_DECISIVOS, nunca digitado", () => {
    // Uma segunda lista à mão divergiria da primeira no dia em que alguém
    // editasse uma só — e o modelo declararia chave que o decisor não conhece.
    const fonte = readFileSync(new URL("./lacuna-decisiva.ts", import.meta.url), "utf8");
    expect(fonte).toMatch(/CHAVES_DECISIVAS[\s\S]{0,120}Object\.entries\(CAMPOS_DECISIVOS\)/);
    expect(CHAVES_DECISIVAS).toContain("emocional.gatilhos");
    expect(CHAVES_DECISIVAS).toContain("sensorial.perfil");
    expect(CHAVES_DECISIVAS.every((c) => c.split(".").length === 2)).toBe(true);
  });

  it("o schema fecha o vocabulário — não dá para inventar chave", () => {
    const e = esquemaDaResposta() as {
      json_schema: {
        strict: boolean;
        schema: { required: string[]; properties: { campo_investigado: { enum: unknown[] } } };
      };
    };
    expect(e.json_schema.strict).toBe(true);
    expect(e.json_schema.schema.required).toEqual(["fala", "campo_investigado"]);
    const enums = e.json_schema.schema.properties.campo_investigado.enum;
    expect(enums).toContain(null);
    expect(enums.length).toBe(CHAVES_DECISIVAS.length + 1);
  });

  it("a instrução NÃO altera o Core v11 — ela é do turno, não da identidade", () => {
    const i = instrucaoDoEnvelope();
    expect(i).toContain("campo_investigado");
    // Diz explicitamente que declarar a sugerida sem tê-la perguntado é pior.
    expect(i).toMatch(/nunca declare a chave que foi sugerida/i);
    expect(i).toMatch(/orientar sem perguntar continua certo/i);
    // ⚠️ A SEPARAÇÃO TEM QUE ESTAR ESCRITA: o envelope é observabilidade e não
    // pode governar o que a mãe recebe. Sem esta frase, o modelo encurta.
    expect(i).toMatch(/Não altere nada por causa deste/i);
    expect(i).toMatch(/nem a profundidade/i);
    expect(i).toMatch(/Quem decide o quanto dizer é o Core/i);
    // E nenhuma régua de tamanho — nem mínimo, nem máximo.
    expect(i).not.toMatch(/palavras|caracteres|curt[ao]|breve|conciso/i);
    // E o glossário sai dos campos reais.
    expect(i).toContain("emocional.gatilhos");
  });
});

describe("PEND-187B · a leitura do envelope", () => {
  it("envelope válido devolve fala e campo", () => {
    const r = lerEnvelope(JSON.stringify({ fala: "Vale reparar no que vem antes.", campo_investigado: "emocional.gatilhos" }));
    expect(r.valido).toBe(true);
    expect(r.fala).toBe("Vale reparar no que vem antes.");
    expect(r.campo).toBe("emocional.gatilhos");
  });

  it("campo null é resultado legítimo, não falha", () => {
    const r = lerEnvelope(JSON.stringify({ fala: "Hoje é só respirar. 💛", campo_investigado: null }));
    expect(r.valido).toBe(true);
    expect(r.campo).toBeNull();
    expect(r.fala).toBeTruthy();
  });

  it("chave FORA do enum vira null — segunda camada, como no decisor", () => {
    const r = lerEnvelope(JSON.stringify({ fala: "oi", campo_investigado: "telepatia.leitura" }));
    expect(r.valido).toBe(true);
    expect(r.campo).toBeNull();
  });

  it("NÃO É JSON: a família recebe a fala assim mesmo, e o campo se perde", () => {
    // ⚠️ Emudecer alguém porque um campo de telemetria não veio seria trocar um
    // problema de observabilidade por um problema de produto.
    const r = lerEnvelope("Entendo, Karina — isso desgasta muito.");
    expect(r.valido).toBe(false);
    expect(r.fala).toBe("Entendo, Karina — isso desgasta muito.");
    expect(r.campo).toBeNull();
  });

  it("JSON sem fala é inválido — e não inventa campo", () => {
    const r = lerEnvelope(JSON.stringify({ campo_investigado: "emocional.gatilhos" }));
    expect(r.valido).toBe(false);
    expect(r.campo).toBeNull();
  });

  it("vazio não vira fala", () => {
    expect(lerEnvelope("").fala).toBe("");
    expect(lerEnvelope(null).valido).toBe(false);
  });
});

describe("PEND-187B · fluxo, segurança e recuperação", () => {
  it("A FRONTEIRA INSPECIONA A FALA, nunca o JSON bruto", () => {
    // ⚠️ A rede de fronteiras é a razão de o streaming ter saído. Se ela passar
    // a ler o envelope, uma resposta com diagnóstico informal dentro de `fala`
    // atravessaria — o buraco pelo qual uma mãe já recebeu diagnóstico.
    const i = FONTE_EXP.indexOf("lerEnvelope(r.texto)");
    const j = FONTE_EXP.indexOf("fronteiraAtravessada(texto");
    expect(i, "leitura do envelope não encontrada").toBeGreaterThan(0);
    expect(j, "a fronteira deixou de inspecionar `texto`").toBeGreaterThan(0);
    // A fronteira vem DEPOIS de `texto` já ser a fala do envelope.
    expect(j).toBeGreaterThan(i);
    expect(FONTE_EXP).not.toMatch(/fronteiraAtravessada\(\s*r\.texto/);
  });

  it("envelope inválido cai UMA vez para texto livre — e sem laço", () => {
    expect(FONTE_EXP).toMatch(/if \(envelopeFalhou\)/);
    expect(FONTE_EXP).toMatch(/gerar\(undefined, true\)/);
    // `semEnvelope = true` não reentra: só há uma chamada com ele.
    expect((FONTE_EXP.match(/gerar\(undefined, true\)/g) ?? []).length).toBe(1);
  });

  it("na recuperação, campo_investigado NÃO é persistido como válido", () => {
    const bloco = FONTE_EXP.slice(
      FONTE_EXP.indexOf("if (envelopeFalhou)"),
      FONTE_EXP.indexOf("const msModelo"),
    );
    expect(bloco).toMatch(/campoInvestigado = null/);
  });

  it("sem envelope, a instrução do envelope também sai do prompt", () => {
    expect(FONTE_EXP).toMatch(/semEnvelope \? "" : instrucaoDoEnvelope\(\)/);
    expect(FONTE_EXP).toMatch(/\.\.\.\(semEnvelope \? \{\} : \{ formatoJson: esquemaDaResposta\(\) \}\)/);
  });
});

describe("PEND-187B · persistência e observabilidade", () => {
  it("as duas chaves são gravadas SEPARADAS — uma nunca vira a outra", () => {
    expect(FONTE_ORCH).toMatch(/lacuna_sugerida: lacunaSugerida/);
    expect(FONTE_ORCH).toMatch(/campo_investigado: campoInvestigado/);
    // E no metadata da mensagem, cada uma no seu campo.
    expect(FONTE_ORCH).toMatch(/\{ lacuna_sugerida: lacunaSugerida \}/);
    expect(FONTE_ORCH).toMatch(/\{ campo_investigado: campoInvestigado \}/);
  });

  it("o rastro registra se a sugestão foi seguida — como observação", () => {
    expect(FONTE_ORCH).toMatch(/sugestao_seguida/);
    // `null` quando falta um dos dois: não se compara o que não existe.
    expect(FONTE_ORCH).toMatch(/lacunaSugerida && campoInvestigado \? lacunaSugerida === campoInvestigado : null/);
  });

  it("campo_investigado NÃO entra em jaRespondidas", () => {
    // ⚠️ A GARANTIA CENTRAL DA 187A, preservada. `jaRespondidas` lê `lacuna` e
    // `lacuna_sugerida` para OBSERVAR o histórico; `campo_investigado` não é
    // sequer lido lá — e mesmo que fosse, nada em `jaRespondidas` exclui.
    const fonte = readFileSync(new URL("./lacuna-decisiva.ts", import.meta.url), "utf8");
    const fn = fonte.slice(
      fonte.indexOf("export function jaRespondidas"),
      fonte.indexOf("export type DecisaoDeLacuna"),
    );
    expect(fn).not.toContain("campo_investigado");
  });

  it("o Perfil continua sendo a única fonte de fechamento", () => {
    const fonte = readFileSync(new URL("./lacuna-decisiva.ts", import.meta.url), "utf8");
    expect(fonte).toMatch(/const jaRespondido = new Set\(params\.jaRespondido \?\? \[\]\);/);
  });

  it("uma resposta seguinte não fecha campo por causa do campo_investigado", () => {
    const falas = [
      {
        direcao: "outbound",
        texto: "e o que costuma disparar?",
        metadata: { lacuna_sugerida: "sensorial.perfil", campo_investigado: "emocional.gatilhos" },
        membro_atipico_id: "manu",
      },
      { direcao: "inbound", texto: "Acontece quando eu insisto para ela parar", membro_atipico_id: "manu" },
    ];
    const r = jaRespondidas(falas, "manu");
    // O histórico é observado pela chave SUGERIDA (legado da 187A) e nada mais.
    expect(r.fechadas.has("emocional.gatilhos")).toBe(false);
  });
});

describe("PEND-187B · os dois turnos reais da Manu", () => {
  /**
   * ⚠️ O BENCHMARK VEM DE PRODUÇÃO, 10/09/2026 (`a81c9fa`). Nos dois turnos a
   * `lacuna_sugerida` foi `sensorial.perfil`; no primeiro a Ayla perguntou
   * sobre gatilho de transição, no segundo não perguntou nada. Aqui se prova o
   * TRATAMENTO desses envelopes — a bancada com o modelo real está em
   * `scratchpad/187b-*`.
   */
  it("T1 · sugerida ≠ investigada, e o que vale é a investigada", () => {
    const r = lerEnvelope(
      JSON.stringify({
        fala: "Ela fica mais irritada quando você avisa antes, ou principalmente quando precisa encerrar no meio da brincadeira?",
        campo_investigado: "emocional.gatilhos",
      }),
    );
    expect(r.campo).toBe("emocional.gatilhos");
    expect(r.campo).not.toBe("sensorial.perfil");
  });

  it("T2 · o Core não perguntou → null, mesmo com sugestão presente", () => {
    const r = lerEnvelope(
      JSON.stringify({
        fala: "Então, o que mais pesa parece ser parar sem conseguir concluir o que estava fazendo. 💛",
        campo_investigado: null,
      }),
    );
    expect(r.valido).toBe(true);
    expect(r.campo).toBeNull();
  });

  it("USOU o fato do Perfil sem perguntar → null (o defeito medido na bancada)", () => {
    // ⚠️ O CASO OBRIGATÓRIO. Na bancada ampliada, 2 execuções declararam
    // `sensorial.toques` numa fala que NÃO perguntou nada sobre toque — só
    // usou o que o Perfil já dizia ("não gosta de abraço"). Usar não é
    // investigar, e é a direção perigosa: declarar sem ter perguntado.
    const i = instrucaoDoEnvelope();
    expect(i).toMatch(/USOU um fato que já sabia do perfil, mas não perguntou/i);
    expect(i).toMatch(/NÃO é investigar toque/i);
    // E o tratamento do envelope respeita a declaração, seja ela qual for.
    const r = lerEnvelope(
      JSON.stringify({
        fala: "Como a Manu não gosta de abraço, evite abraçá-la à força durante a crise. Fique por perto e fale pouco.",
        campo_investigado: null,
      }),
    );
    expect(r.valido).toBe(true);
    expect(r.campo).toBeNull();
  });

  it("sugerida = investigada é um resultado possível, e não é suspeito", () => {
    const r = lerEnvelope(
      JSON.stringify({ fala: "O que costuma disparar?", campo_investigado: "emocional.gatilhos" }),
    );
    expect(r.campo).toBe("emocional.gatilhos");
  });
});
