import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { respostaOrientouEmergencia, notaDeSeguranca, segurancaAberta } from "./estado-seguranca";

/**
 * O CASO ADELLY — 03/08/2026, e é o motivo deste módulo existir.
 *
 * Uma mãe relatou que a filha de 13 anos tinha tentado suicídio e voltado a
 * usar substância. A Ayla ACERTOU o primeiro turno: parou tudo, disse que era
 * emergência de saúde, mandou avisar o especialista hoje, apontou CAPS e SAMU.
 *
 * E cinco minutos depois estava organizando a rotina da casa em blocos.
 *
 * As 13 mensagens seguintes saíram com `tipo = "resposta_registro"` — o mesmo
 * de qualquer conversa. SAMU e CAPS apareceram UMA vez e nunca mais. O prompt
 * estava certo e foi obedecido; o que não existia era ESTADO.
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const RESP = readFileSync(resolve(__dirname, "responder.ts"), "utf8");

/** Duplo do Supabase: só o suficiente pra `segurancaAberta` consultar. */
function supabaseCom(linhas: Array<{ tipo: string; created_at: string }>) {
  const q = {
    select: () => q,
    eq: () => q,
    in: () => q,
    gte: (_c: string, iso: string) => {
      const corte = new Date(iso).getTime();
      q._filtradas = linhas.filter((l) => new Date(l.created_at).getTime() >= corte);
      return q;
    },
    order: () => q,
    limit: () => ({
      data: [...(q._filtradas ?? linhas)].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ).slice(0, 1),
    }),
    _filtradas: undefined as undefined | typeof linhas,
  };
  return { from: () => q } as never;
}

const AGORA = new Date("2026-08-03T12:00:00Z");
const hMenos = (h: number) => new Date(AGORA.getTime() - h * 3600_000).toISOString();

// ============================================================
// A resposta orientou emergência? (primeira das duas condições)
// ============================================================

describe("detecção do ato de orientar emergência", () => {
  it("pega a mensagem REAL que a Ayla mandou à Vivi", () => {
    const real =
      "Se você não conseguir falar com o especialista hoje, ou se ela parecer em risco agora, " +
      "o CAPS da sua cidade atende situações assim — é gratuito e é o lugar certo pra isso. " +
      "Emergência médica: SAMU 192.";
    expect(respostaOrientouEmergencia(real)).toBe(true);
  });

  it("pega CVV/188 e pronto-socorro", () => {
    expect(respostaOrientouEmergencia("liga pro CVV, 188, é 24h")).toBe(true);
    expect(respostaOrientouEmergencia("procure o pronto-socorro")).toBe(true);
  });

  it("conversa comum não dispara", () => {
    expect(respostaOrientouEmergencia("Vamos organizar a tarde dele: chega 12h40, almoça…")).toBe(false);
    expect(respostaOrientouEmergencia("Ela pode estar cansada depois da escola.")).toBe(false);
  });
});

// ============================================================
// O estado, inferido do histórico
// ============================================================

describe("estado de segurança", () => {
  it("uma outbound 'seguranca' recente deixa o estado ABERTO", async () => {
    const e = await segurancaAberta(supabaseCom([{ tipo: "seguranca", created_at: hMenos(1) }]), "f", AGORA);
    expect(e.aberta).toBe(true);
    expect(e.precisaChecar).toBe(false);
  });

  it("'seguranca_encerrada' depois dela FECHA", async () => {
    const e = await segurancaAberta(
      supabaseCom([
        { tipo: "seguranca", created_at: hMenos(3) },
        { tipo: "seguranca_encerrada", created_at: hMenos(2) },
      ]),
      "f",
      AGORA,
    );
    expect(e.aberta).toBe(false);
  });

  it("depois de 6h pede checagem antes de liberar — não solta em silêncio", async () => {
    const e = await segurancaAberta(supabaseCom([{ tipo: "seguranca", created_at: hMenos(8) }]), "f", AGORA);
    expect(e.aberta).toBe(true);
    expect(e.precisaChecar).toBe(true);
  });

  it("passadas as 12h da janela, não fica aberto pra sempre", async () => {
    const e = await segurancaAberta(supabaseCom([{ tipo: "seguranca", created_at: hMenos(20) }]), "f", AGORA);
    expect(e.aberta).toBe(false);
  });

  it("família sem histórico de segurança: fechado", async () => {
    expect((await segurancaAberta(supabaseCom([]), "f", AGORA)).aberta).toBe(false);
  });

  it("falha de consulta NÃO trava artefatos de todo mundo", async () => {
    const quebrado = { from: () => { throw new Error("banco fora"); } } as never;
    expect((await segurancaAberta(quebrado, "f", AGORA)).aberta).toBe(false);
  });
});

// ============================================================
// A nota do turno
// ============================================================

describe("nota de segurança", () => {
  const nota = notaDeSeguranca({ precisaChecar: false });

  it("diz que a prioridade continua mesmo se a mensagem mudou de assunto", () => {
    expect(nota).toMatch(/Mudar de assunto não resolve o risco/);
    expect(nota).toMatch(/casa, escola, medicação, desabafo/);
  });

  it("proíbe o que ocupou o lugar da segurança na conversa real", () => {
    // Foi literalmente isto que aconteceu: bloco organizando a rotina da casa.
    expect(nota).toMatch(/análise da rotina da casa/);
    expect(nota).toMatch(/plano, rotina, atividades, brincadeiras/);
  });

  it("mantém PRIORIDADE sem repetir emergência a cada turno", () => {
    expect(nota).toMatch(/Repita CVV\/SAMU\/CAPS só se/);
    expect(nota).toMatch(/acompanhe a execução em vez de repetir/);
  });

  it("barra a frase clínica que escapou ('muito menos do que ela precisa')", () => {
    expect(nota).toMatch(/NÃO AVALIE A SUFICIÊNCIA DO TRATAMENTO/);
    expect(nota).toMatch(/é muito menos do que ela precisa/);
  });

  it("mantém a fronteira de medicação, com a pergunta neutra", () => {
    expect(nota).toMatch(/Não sugira qual começar, qual é mais fácil/);
    expect(nota).toMatch(/pedir orientação de como proceder/);
  });

  it("depois de horas, confirma antes de ampliar", () => {
    expect(notaDeSeguranca({ precisaChecar: true })).toMatch(/confirme em UMA pergunta curta/);
  });
});

// ============================================================
// Os fluxos que ficam bloqueados
// ============================================================

describe("durante a segurança, artefato nenhum dispara", () => {
  it("rotina — criar, ver e editar", () => {
    // A condição virou multilinha quando o pedido explícito entrou; o que
    // importa é a segurança continuar sendo o PRIMEIRO termo do gate.
    expect(ORCH).toMatch(/!seguranca\.aberta &&\n\s*\(rotinaConversa \|\|\n\s*intent === "rotina_criar"/);
    expect(ORCH).toMatch(/!seguranca\.aberta && !rotinaConversa && \(intent === "rotina_ver"/);
    // O gate de editar virou multilinha quando o FEEDBACK passou a entrar por
    // ele ("já faz sozinho", "não funcionou até o jantar"). A exigência é a
    // mesma e não afrouxou: segurança continua sendo o primeiro termo, e o
    // `ehFeedbackDeRotina` que entrou na disjunção também nasce com ela.
    expect(ORCH).toMatch(
      /!seguranca\.aberta &&\s*\n?\s*!rotinaConversa &&\s*\n?\s*\(intent === "rotina_editar"/,
    );
    expect(ORCH).toMatch(/const ehFeedbackDeRotina =\s*\n?\s*!seguranca\.aberta && !rotinaConversa/);
  });

  it("a ponte do Plano", () => {
    expect(ORCH).toMatch(/args\.tipo === "resposta_registro" && !args\.params\.notaDeSeguranca/);
  });

  it("o estado é lido ANTES do roteamento", () => {
    expect(ORCH.indexOf("const seguranca = await segurancaAberta")).toBeLessThan(
      ORCH.indexOf('intent === "rotina_criar"'),
    );
  });
});

describe("proativa não chega no meio de uma crise", () => {
  const CAD = readFileSync(resolve(__dirname, "cadencia.ts"), "utf8");

  it("a cadência consulta a segurança antes de reservar o envio", () => {
    expect(CAD).toMatch(/const cri = await segurancaAberta\(supabase, params\.familyAccountId, agora\)/);
    expect(CAD).toMatch(/return \{ ok: false, motivo: "seguranca_aberta" \}/);
  });

  it("a checagem vem ANTES do insert da reserva", () => {
    expect(CAD.indexOf("segurancaAberta(supabase")).toBeLessThan(CAD.indexOf('status: "enfileirada"'));
  });

  it("vale até pros tipos isentos de cadência", () => {
    // A isenção existe pra boas-vindas não ser engolida por rotina — não pra
    // furar uma crise. O gate fica antes de qualquer verificação de isenção.
    expect(CAD.indexOf("seguranca_aberta")).toBeLessThan(
      CAD.indexOf("!proativaIsentaDeCadencia((l as LinhaReserva).template_key)"),
    );
  });

  it("falha de consulta não trava as proativas do produto inteiro", () => {
    expect(CAD).toMatch(/Falha na consulta não pode travar toda proativa do produto/);
  });

  it("suprime o envio, mas NÃO encerra o estado", () => {
    expect(CAD).toMatch(/SUPRIME o envio; não encerra nem apaga o estado/);
    expect(CAD).not.toMatch(/seguranca_encerrada/);
  });
});

describe("abre com DUAS condições, fecha com evidência", () => {
  it("orientar emergência sozinho não abre — precisa de risco atual", () => {
    expect(ORCH).toMatch(/respostaOrientouEmergencia\(textoCompleto\)/);
    expect(ORCH).toMatch(/riscoEhAtual\(/);
    expect(ORCH).toMatch(/if \(risco\.atual\) tipoFinal = "seguranca"/);
  });

  it("só a confirmação de atendimento encerra", () => {
    expect(ORCH).toMatch(/segurancaFoiEncaminhada\(/);
    expect(ORCH).toMatch(/fim\.encaminhada \? "seguranca_encerrada" : "seguranca"/);
  });

  it("a nota entra nas notas internas e manda no que veio antes", () => {
    expect(RESP).toMatch(/if \(params\.notaDeSeguranca\)/);
    expect(RESP).toMatch(/quando existe,\s*\n\s*\/\/ ela manda em tudo que veio antes/);
  });
});
