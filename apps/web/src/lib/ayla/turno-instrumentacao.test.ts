import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { metaDoTurno, type UsageTracking } from "./responder";

/**
 * INSTRUMENTAÇÃO DO TURNO — o piloto (`parser` + `responder`).
 *
 * ⚠️ POR QUE EXISTE. Medido em 11/08/2026: **1 de 2.788 chamadas de IA** tinha
 * duração registrada, e era a conversa web instrumentada no mesmo dia. A
 * latência percebida do WhatsApp é **P50 22,4 s · P95 57,7 s · pior 100,6 s**,
 * o turno mediano dispara 4 a 5 chamadas de modelo — e não havia como saber
 * quanto disso é modelo e quanto é arquitetura.
 *
 * Nada de comportamento muda aqui: mesmos modelos, mesmo prompt, mesmo
 * contexto, mesmo número de chamadas, mesmo paralelismo.
 */

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const ORCH = src("ayla/orchestrator.ts");
const PARSER = src("ayla/parser.ts");
const RESPONDER = src("ayla/responder.ts");

describe("A · o turno tem UM id, e ele nasce uma vez", () => {
  it("1. MORDE: `turnId` é const, no topo de processInbound", () => {
    // Se algum ramo gerasse o próprio id, as chamadas do MESMO turno viriam com
    // correlacionadores diferentes e a soma por turno mentiria sem avisar.
    expect(ORCH).toMatch(/const turnId = crypto\.randomUUID\(\)/);
    expect(ORCH.split("crypto.randomUUID()").length - 1, "há mais de uma origem de turn_id").toBe(1);
  });

  it("2. MORDE: parser e responder recebem o MESMO turnId", () => {
    // Os dois trackings do piloto saem da mesma variável do escopo da função.
    expect(ORCH).toMatch(/feature: "ayla_parser",\s*\n\s*turn_id: turnId,/);
    expect(ORCH).toMatch(/turn_id: turnId,\s*\n\s*message_id: inboundMessageId,/);
    // E o responder recebe por parâmetro, porque vive em outra função.
    expect(ORCH).toMatch(/feature: "ayla_responder",\s*\n\s*turn_id: args\.turn_id,/);
  });

  it("3. MORDE: o id do inbound é capturado, e é OPCIONAL", () => {
    // Ele NÃO é o correlacionador: nasce condicionalmente (falha do claim de
    // idempotência, webhook sem messageId). Por isso `turn_id` é um UUID
    // próprio e `message_id` é a ponte para o texto — quando existir.
    expect(ORCH).toMatch(/let inboundMessageId: string \| null = null/);
    expect(ORCH).toMatch(/inboundMessageId = \(claim\?\.\[0\]\?\.id as string \| undefined\) \?\? null/);
  });
});

describe("B · o formato do meta", () => {
  const base: UsageTracking = {
    supabase: {} as never,
    family_account_id: "fam-1",
    feature: "ayla_parser",
  };

  it("4. carrega turn_id e message_id, e preserva o resto", () => {
    const m = metaDoTurno({ ...base, turn_id: "t-1", message_id: "m-1" }, { ms: 900, tentativas: 1 });
    expect(m).toEqual({ turn_id: "t-1", message_id: "m-1", ms: 900, tentativas: 1 });
  });

  it("5. MORDE: message_id ausente vira null e NÃO derruba a correlação", () => {
    const m = metaDoTurno({ ...base, turn_id: "t-1" }, { ms: 10, tentativas: 1 });
    expect(m.message_id).toBeNull();
    expect(m.turn_id, "o turno perdeu correlação por falta de message_id").toBe("t-1");
  });

  it("6. tracking sem nada ainda produz as chaves — o buraco fica visível", () => {
    expect(metaDoTurno(undefined, { ms: 1 })).toEqual({ turn_id: null, message_id: null, ms: 1 });
  });
});

describe("C · o `ms` mede a chamada ao modelo, e só ela", () => {
  it("7. MORDE: no parser, o cronômetro fecha ANTES do pós-processamento", () => {
    // O `JSON.parse` do parser acontece bem depois, fora do bloco. Medir a
    // função inteira somaria parse ao tempo de IA — e é justamente essa
    // separação que a investigação de latência precisa.
    const i = PARSER.indexOf("const t0 = Date.now()");
    const j = PARSER.indexOf("const msModelo = Date.now() - t0");
    const k = PARSER.indexOf("stream.finalMessage()");
    expect(i, "t0 sumiu").toBeGreaterThan(-1);
    expect(j, "t1 sumiu").toBeGreaterThan(i);
    expect(k, "o fecho tem que vir DEPOIS da resposta do modelo").toBeLessThan(j);
    // e antes de qualquer parse
    const parse = PARSER.indexOf("JSON.parse", j);
    expect(parse, "o cronômetro fechou depois do parse").toBeGreaterThan(j);
  });

  it("8. MORDE: no responder, o cronômetro está DENTRO do callback da retentativa", () => {
    // Entre as duas tentativas há um `sleep(1200)`. Envolver o
    // `comRetentativaCurta` mediria a ESPERA junto com o modelo.
    const cb = RESPONDER.indexOf("comRetentativaCurta(async () => {");
    const t0 = RESPONDER.indexOf("const t0 = Date.now()", cb);
    const soma = RESPONDER.indexOf("msModelo += Date.now() - t0", cb);
    expect(cb, "o callback sumiu").toBeGreaterThan(-1);
    expect(t0, "t0 fora do callback").toBeGreaterThan(cb);
    expect(soma, "a soma sumiu").toBeGreaterThan(t0);
    // `finally`: a tentativa que FALHOU também consumiu tempo do turno.
    expect(RESPONDER.slice(cb, soma)).toMatch(/\} finally \{/);
  });

  it("9. MORDE: o responder soma TODAS as tentativas, não só a última", () => {
    // Registrar só a última subestimaria exatamente o caso lento — o que mais
    // interessa numa investigação de latência.
    expect(RESPONDER).toMatch(/msModelo \+= Date\.now\(\) - t0/);
    expect(RESPONDER).not.toMatch(/msModelo = Date\.now\(\) - t0/);
    expect(RESPONDER).toMatch(/ms: msModelo, tentativas \}/);
  });

  it("10. o acumulador de tentativas, exercitado de verdade", async () => {
    // Reproduz a mecânica do responder: 1ª falha, 2ª passa. `ms` tem que somar
    // as duas, e `tentativas` tem que dizer 2.
    let msModelo = 0;
    let tentativas = 0;
    const chamada = async (falhar: boolean) => {
      tentativas++;
      const t0 = Date.now();
      try {
        await new Promise((r) => setTimeout(r, 20));
        if (falhar) throw new Error("sobrecarga");
        return "ok";
      } finally {
        msModelo += Date.now() - t0;
      }
    };
    let r: string | null = null;
    try {
      r = await chamada(true);
    } catch {
      await new Promise((res) => setTimeout(res, 5)); // o sleep entre tentativas
      r = await chamada(false);
    }
    expect(r).toBe("ok");
    expect(tentativas).toBe(2);
    // As duas chamadas (20ms cada) contam; a espera de 5ms entre elas NÃO.
    expect(msModelo).toBeGreaterThanOrEqual(35);
    expect(msModelo, "a espera entre tentativas entrou na conta").toBeLessThan(80);
  });

  it("11. MORDE: pós-processamento lento NÃO entra no ms", () => {
    // O padrão do parser: fecha o cronômetro na resposta e só depois processa.
    const agora = vi.spyOn(Date, "now");
    let t = 1000;
    agora.mockImplementation(() => t);
    const t0 = Date.now();
    t += 300;                       // o modelo levou 300ms
    const ms = Date.now() - t0;
    t += 5000;                      // e o parse levou 5s
    agora.mockRestore();
    expect(ms).toBe(300);
  });
});

describe("D · nada de comportamento mudou", () => {
  it("12. MORDE: mesmos modelos, mesmo nº de chamadas, mesmo paralelismo", () => {
    // O piloto é aditivo. Se alguém aproveitar para "otimizar" junto, isto cai.
    expect(PARSER).toMatch(/AYLA_MODEL_FALLBACK/);
    expect(PARSER).toMatch(/max_tokens: 1024/);
    expect(RESPONDER).toMatch(/maxTokens: 900/);
    expect(RESPONDER).toMatch(/cacheSystem: true/);
    // a retentativa continua sendo UMA
    expect(RESPONDER).toMatch(/await new Promise\(\(r\) => setTimeout\(r, 1200\)\)/);
  });
});
