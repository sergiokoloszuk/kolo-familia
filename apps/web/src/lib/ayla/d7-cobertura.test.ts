import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROATIVAS_ISENTAS } from "./cadencia";

/**
 * O FECHAMENTO DO TESTE — 26/08/2026.
 *
 * ⚠️ O QUE FOI MEDIDO EM PRODUÇÃO, e é a razão deste arquivo existir:
 * **223 trials venceram, 11 receberam `trial_d0` — 5%.**
 *
 * A causa foi reproduzida contra o dado real, gate a gate. Das 129 famílias que
 * passavam por consentimento, WhatsApp e desativação:
 *
 *   115 (89%)  morriam em "fora da janela preferida"
 *    10        foram enviadas
 *     3        "família escreveu naquele dia"
 *     1        nenhum portão explica
 *
 * E a aritmética: o cron comercial rodava **uma vez por dia, 15:00 UTC = 12:00
 * BRT**, e a janela preferida é escolhida pela família. MEDI a distribuição:
 *
 *   19:00-21:00 ... 134 famílias   ← 12:00 fora
 *   08:00-10:00 .... 61 famílias   ← fora
 *   15:00-17:00 .... 26 famílias   ← fora
 *   12:00-14:00 .... 15 famílias   ← a ÚNICA que inclui 12:00
 *
 * O fechamento alcançava 6% da base, por coincidência de horário.
 *
 * ⚠️ A CORREÇÃO NÃO REMOVE A JANELA. A preferência é da família. O cron passa a
 * bater nas MESMAS quatro horas da rotina (11, 15, 18, 22 UTC), que cobrem as
 * quatro janelas — e a idempotência entra junto, porque quatro tentativas por
 * dia sem trava é spam.
 */
const ORQ = fs.readFileSync(path.join(__dirname, "orchestrator.ts"), "utf8");

/**
 * ⚠️ O FALLBACK É LIDO DO FONTE, não importado. Ele é `const` privado em
 * `messageTemplates.ts`, e exportá-lo só para o teste alargaria a superfície do
 * módulo por conveniência de quem testa. O que interessa aqui é o TEXTO — se a
 * rota errada voltar a ser escrita, ela volta escrita.
 */
const TEMPLATES = fs.readFileSync(path.join(__dirname, "messageTemplates.ts"), "utf8");
function variacoesDe(chave: string): string[] {
  const i = TEMPLATES.indexOf(`  ${chave}: [`);
  if (i < 0) return [];
  const fim = TEMPLATES.indexOf("\n  ],", i);
  const trecho = TEMPLATES.slice(i, fim);
  return [...trecho.matchAll(/"([^"]*)"/g)].map((m) => m[1]).filter((v) => v.length > 20);
}
const VERCEL = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "..", "vercel.json"), "utf8"),
) as { crons: Array<{ path: string; schedule: string }> };

describe("1 · o cron alcança as quatro janelas", () => {
  const comercial = VERCEL.crons.find((c) => c.path.includes("tipo=comercial"));

  it("o cron comercial existe e roda quatro vezes por dia", () => {
    expect(comercial).toBeDefined();
    expect(comercial!.schedule).toBe("0 11,15,18,22 * * *");
  });

  it("MORDE: as quatro batidas cobrem as quatro janelas configuradas na base", () => {
    // UTC → BRT (America/Sao_Paulo, UTC-3)
    const batidasBrt = comercial!.schedule.split(" ")[1].split(",").map((h) => (Number(h) - 3 + 24) % 24);
    const janelas: Array<[string, string]> = [
      ["08:00", "10:00"],
      ["12:00", "14:00"],
      ["15:00", "17:00"],
      ["19:00", "21:00"],
    ];
    for (const [ini, fim] of janelas) {
      const alcancada = batidasBrt.some((h) => {
        const hh = `${String(h).padStart(2, "0")}:00`;
        return hh >= ini && hh <= fim;
      });
      expect(alcancada, `janela ${ini}-${fim} precisa de uma batida`).toBe(true);
    }
  });

  it("MORDE: uma batida só volta a deixar 3 das 4 janelas sem cobertura", () => {
    const soUma = [12];
    const semCobertura = ([
      ["08:00", "10:00"],
      ["15:00", "17:00"],
      ["19:00", "21:00"],
    ] as Array<[string, string]>).filter(
      ([ini, fim]) => !soUma.some((h) => `${String(h).padStart(2, "0")}:00` >= ini && `${String(h).padStart(2, "0")}:00` <= fim),
    );
    expect(semCobertura).toHaveLength(3);
  });

  it("o cron da rotina continua com as mesmas quatro horas — não foi tocado", () => {
    const rotina = VERCEL.crons.find((c) => c.path.includes("tipo=rotina"));
    expect(rotina!.schedule).toBe("0 11,15,18,22 * * *");
  });
});

/**
 * O CORPO INTEIRO DE `sendTrial`, sem contar bytes.
 *
 * ⚠️ A ÂNCORA É A PRÓXIMA DECLARAÇÃO DE TOPO, e não um tamanho fixo. Duas vezes
 * um comentário novo dentro da função empurrou trecho relevante para fora de
 * uma janela de N bytes e deixou o teste vermelho por escrita, não por
 * comportamento. Quem lê o corpo inteiro não tem esse problema.
 */
function corpoDeSendTrial(): string {
  const i = ORQ.indexOf("export async function sendTrial");
  expect(i, "`sendTrial` sumiu do orquestrador").toBeGreaterThan(-1);
  const fim = ORQ.indexOf("\n// ====", i);
  expect(fim, "o fim de `sendTrial` não foi encontrado").toBeGreaterThan(i);
  return ORQ.slice(i, fim);
}

describe("2 · idempotência — quatro tentativas, no máximo um envio", () => {
  it("a trava existe e vem ANTES de qualquer consulta cara", () => {
    const corpo = corpoDeSendTrial();
    const iTrava = corpo.indexOf("jaEnviouTipoHoje");
    const iReativo = corpo.indexOf("fechamentoReativoRecente");
    const iPode = corpo.indexOf("podeEnviarProativa");
    expect(iTrava).toBeGreaterThan(0);
    expect(iTrava).toBeLessThan(iReativo);
    expect(iTrava).toBeLessThan(iPode);
  });

  it("MORDE: a trava pergunta ao que DE FATO saiu, não a uma reserva", () => {
    const i = ORQ.indexOf("async function jaEnviouTipoHoje");
    const corpo = ORQ.slice(i, ORQ.indexOf("\n}", i));
    expect(corpo).toMatch(/from\("ayla_messages"\)/);
    expect(corpo).toMatch(/eq\("direcao", "outbound"\)/);
    expect(corpo).toMatch(/eq\("tipo", tipo\)/);
  });

  it("MORDE: erro na consulta da trava vira 'já enviou' — cala em vez de repetir", () => {
    const i = ORQ.indexOf("async function jaEnviouTipoHoje");
    const corpo = ORQ.slice(i, ORQ.indexOf("\n}", i));
    expect(corpo).toMatch(/if \(error\) return true;/);
  });
});

describe("3 · observabilidade — nunca mais 'não sabemos por quê'", () => {
  it("toda tentativa registra, e o evento é PERSISTIDO", () => {
    const i = ORQ.indexOf("async function registrarTentativaTrial");
    const corpo = ORQ.slice(i, ORQ.indexOf("\n}\n", i));
    expect(corpo).toMatch(/kind: "trial_fechamento_tentativa"/);
    expect(corpo).toMatch(/persistir: true/);
    // `info` sumiria com a retenção da Vercel — foi assim que a cobertura
    // ficou invisível por semanas.
    expect(corpo).not.toMatch(/severity: "info"/);
  });

  it("o payload carrega o que a investigação precisou e não teve", () => {
    const i = ORQ.indexOf("async function registrarTentativaTrial");
    const corpo = ORQ.slice(i, ORQ.indexOf("\n}\n", i));
    for (const campo of ["tipo", "dia_trial", "enviada", "motivo", "canal", "erro"]) {
      expect(corpo).toContain(campo);
    }
  });

  it("MORDE: os três caminhos de não-envio registram o motivo", () => {
    // ⚠️ A JANELA ANCORA NO FIM REAL DA FUNÇÃO, e passou a ancorar em
    // 28/08/2026. Antes eram 3000 bytes contados a partir do começo — e um
    // comentário novo dentro de `sendTrial` (a explicação do prazo defasado do
    // caso Nicole) empurrou o quarto `registrarTentativaTrial` para fora da
    // contagem. O teste ficou vermelho sem que nada do comportamento mudasse.
    // Contagem de bytes é uma âncora que envelhece sozinha.
    const corpo = corpoDeSendTrial();
    // fechamento reativo · portão da proativa · sem contexto
    const registros = (corpo.match(/registrarTentativaTrial\(/g) ?? []).length;
    expect(registros).toBeGreaterThanOrEqual(4); // 3 falhas + 1 resultado final
  });

  it("MORDE: telemetria nunca derruba o envio", () => {
    const i = ORQ.indexOf("async function registrarTentativaTrial");
    const corpo = ORQ.slice(i, ORQ.indexOf("\n}\n", i));
    expect(corpo).toMatch(/\.catch\(/);
  });
});

describe("4 · o link comercial — /precos em todo caminho", () => {
  it("MORDE: nenhum fallback de trial manda para /assinatura", () => {
    for (const chave of ["trial_d0", "trial_d3"] as const) {
      for (const v of variacoesDe(chave)) {
        expect(v, `${chave}: ${v.slice(0, 60)}`).not.toMatch(/\/assinatura/);
      }
    }
  });

  it("o link entra como VARIÁVEL, não escrito à mão", () => {
    const d0 = variacoesDe("trial_d0");
    // Toda variação que fala em continuar precisa carregar o link.
    const comLink = d0.filter((v) => v.includes("{link_planos}"));
    expect(comLink.length).toBe(d0.length);
  });

  it("MORDE: `/planos` NÃO é rota de assinatura — não pode aparecer", () => {
    for (const chave of ["trial_d0", "trial_d3"] as const) {
      for (const v of variacoesDe(chave)) {
        expect(v).not.toMatch(/\/planos/);
      }
    }
  });
});

describe("5 · o que NÃO mudou", () => {
  it("trial_d0 e trial_d3 seguem isentos da cadência de 3h", () => {
    expect(PROATIVAS_ISENTAS.has("trial_d0")).toBe(true);
    expect(PROATIVAS_ISENTAS.has("trial_d3")).toBe(true);
  });

  it("MORDE: a janela preferida NÃO foi removida de podeEnviarProativa", () => {
    const RULES = fs.readFileSync(path.join(__dirname, "rules.ts"), "utf8");
    expect(RULES).toMatch(/horario_preferido_inicio/);
    expect(RULES).toMatch(/Fora da janela|janela preferida/i);
  });

  it("MORDE: o limite de 2 proativas/dia continua de pé", () => {
    const RULES = fs.readFileSync(path.join(__dirname, "rules.ts"), "utf8");
    expect(RULES).toMatch(/Limite de 2 proativas\/dia/);
  });

  it("MORDE: o fechamento reativo recente continua calando a proativa", () => {
    expect(ORQ).toMatch(/fechamentoReativoRecente\(supabase, familyAccountId, agora\)/);
  });
});
