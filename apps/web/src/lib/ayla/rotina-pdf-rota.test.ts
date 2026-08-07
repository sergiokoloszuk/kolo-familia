import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  pedeArtefatoImprimivel,
  alvoDoPedido,
  pedeReenvio,
  RESPOSTA_PDF,
} from "./rotina-pdf-rota";

/**
 * "QUERO O PDF" — a rota que faltava.
 *
 * O caso real (Rosângela, 07/08/2026): a mãe pediu o PDF quatro vezes. A Ayla
 * afirmou que já tinha enviado (não tinha), pediu a sequência duas vezes com a
 * MESMA frase, e no fim criou uma segunda rotina duplicada.
 *
 * A causa não era o contrato de verdade — ele estava certo. Era que
 * `pediuParaImprimir` existia, tinha teste, e nunca fora ligada como rota de
 * entrada. Sem função pra executar, o modelo narrou o estado que parecia certo.
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const GUIADA = readFileSync(resolve(__dirname, "rotina-guiada.ts"), "utf8");

describe("1-3. o pedido é reconhecido", () => {
  it.each(["Quero o pdf", "manda o PDF", "quero imprimir", "me manda pra imprimir"])(
    "%s",
    (t) => expect(pedeArtefatoImprimivel(t)).toBe(true),
  );

  it("a frase real que duplicou a rotina é reconhecida", () => {
    expect(
      pedeArtefatoImprimivel(
        "Eu já mandei e você montou a rotina e os cartões. Só preciso do PDF para imprimir.",
      ),
    ).toBe(true);
  });

  it("conversa comum não vira pedido de artefato", () => {
    for (const t of ["Bom dia", "ele dormiu bem", "quero uma rotina pra manhã"])
      expect(pedeArtefatoImprimivel(t)).toBe(false);
  });
});

describe("4/6. cartões são outro artefato", () => {
  it("'quero o pdf' seco é o SIMPLES", () => {
    expect(alvoDoPedido("quero o pdf")).toBe("pdf_simples");
    expect(alvoDoPedido("manda pra imprimir")).toBe("pdf_simples");
  });

  it("citar cartões manda no alvo, mesmo com a palavra pdf junto", () => {
    // "PDF" ali é o formato; "cartões" é o substantivo que manda.
    expect(alvoDoPedido("quero o PDF dos cartões")).toBe("cartoes");
    expect(alvoDoPedido("faz os cards pra recortar")).toBe("cartoes");
  });
});

describe("7-8. 'não chegou' exige âncora", () => {
  it("com entrega recente, é reenvio", () => {
    expect(pedeReenvio("não chegou", { artefatoRecente: true })).toBe(true);
    expect(pedeReenvio("manda de novo", { artefatoRecente: true })).toBe(true);
  });

  it("SEM âncora, não age — a frase é ambígua demais", () => {
    // "Não está na rotina" já foi lido como "faltam etapas" e fez a Ayla
    // reescrever o que estava certo.
    expect(pedeReenvio("não chegou", { artefatoRecente: false })).toBe(false);
    expect(pedeReenvio("não abriu", { artefatoRecente: false })).toBe(false);
  });

  it("texto que não é reclamação de entrega nunca vira reenvio", () => {
    expect(pedeReenvio("ele não chegou a dormir ontem", { artefatoRecente: true })).toBe(true);
    // ⚠️ Conhecido e aceito: com âncora recente, um "não chegou" sobre outra
    // coisa pode reenviar o PDF. O custo é um arquivo a mais; o inverso —
    // ignorar quem não recebeu — é pior.
    expect(pedeReenvio("tudo certo por aqui", { artefatoRecente: true })).toBe(false);
  });
});

describe("12-13. verdade operacional", () => {
  it("só existe UMA linha que autoriza dizer 'enviei'", () => {
    expect(GUIADA).toMatch(/return enviou \? RESPOSTA_PDF\.enviado : RESPOSTA_PDF\.falhou;/);
  });

  it("a entrega do PDF passou a DEVOLVER se enviou", () => {
    expect(GUIADA).toMatch(/export async function entregarPdfDaRotina\([\s\S]{0,900}Promise<boolean>/);
    expect(GUIADA).toMatch(/return Boolean\(envio\?\.messageId\);/);
    expect(GUIADA).toMatch(/return false;/);
  });

  it("a falha não inventa estado e não deixa a mãe sem caminho", () => {
    expect(RESPOSTA_PDF.falhou).toMatch(/Não consegui/);
    expect(RESPOSTA_PDF.falhou).toMatch(/segue salva na Kolo/);
    expect(RESPOSTA_PDF.falhou).not.toMatch(/enviei|já foi/i);
  });

  it("nenhuma resposta de sucesso diz 'entregue' ou 'recebeu'", () => {
    // `messageId` prova ACEITE do provedor, não entrega nem leitura.
    for (const r of [RESPOSTA_PDF.enviado]) expect(r).not.toMatch(/entregue|recebeu|chegou/i);
  });
});

describe("5. cartões: zero promessa de envio automático", () => {
  it("não promete mandar quando ficarem prontos — porque nada manda", () => {
    // Ao terminar, o código só faz `update cards_status = 'pronto'`. Não há job
    // que avise a mãe. Prometer seria repetir o defeito que isto veio corrigir.
    const t = RESPOSTA_PDF.cartoesGerando("https://x");
    expect(t).not.toMatch(/assim que (ficarem|estiverem) prontos,? eu te (envio|mando)/i);
    expect(t).toMatch(/me avisa que eu te mando/);
    expect(t).toMatch(/vão aparecer aqui/);
  });

  it("já em geração não dispara de novo nem promete duas vezes", () => {
    expect(RESPOSTA_PDF.cartoesJaGerando("https://x")).toMatch(/já estão sendo preparados/);
  });
});

describe("10. duas rotinas → UMA pergunta, e nada de pedir a sequência", () => {
  it("a pergunta cita as duas pelo nome", () => {
    expect(RESPOSTA_PDF.qualDelas(["Sábado do parque", "Rotina do sono"])).toBe(
      "Você quer o PDF de qual delas: Sábado do parque ou Rotina do sono?",
    );
  });

  it("sem rotina nenhuma, não inventa artefato", () => {
    expect(RESPOSTA_PDF.semRotina).toMatch(/Ainda não temos uma rotina montada/);
    expect(RESPOSTA_PDF.semRotina).not.toMatch(/enviei|mandei/i);
  });
});

// ============================================================
// A ORDEM — é ela que impede a duplicação
// ============================================================

describe("2/9/14. a rota vem ANTES do construtor", () => {
  it("o gate de PDF aparece antes do gate de rotina no orquestrador", () => {
    const pdf = ORCH.indexOf("pedeArtefatoImprimivel(inbound.texto)");
    const construtor = ORCH.indexOf("pedeRotina(inbound.texto) ||");
    expect(pdf).toBeGreaterThan(0);
    expect(construtor).toBeGreaterThan(0);
    expect(pdf).toBeLessThan(construtor);
  });

  it("o comentário explica por que a ordem É a correção", () => {
    expect(ORCH).toMatch(/contém a palavra\s*\n?\s*\/\/ ROTINA, e `pedeRotina` casa com ela/);
  });

  it("a rota não chama o construtor de rotina", () => {
    const trecho = GUIADA.slice(GUIADA.indexOf("export async function entregarArtefatoImprimivel"));
    const fim = trecho.indexOf("export async function lerFeedbackDaRotina");
    const corpo = trecho.slice(0, fim);
    expect(corpo).not.toMatch(/conduzirRotina|aplicarRotina|gerarRotina/);
  });

  it("11. a rotina lida é a do membro em foco", () => {
    const trecho = GUIADA.slice(GUIADA.indexOf("export async function entregarArtefatoImprimivel"));
    expect(trecho.slice(0, 1200)).toMatch(/\.eq\("membro_atipico_id", params\.membroAtipicoId\)/);
  });

  it("membro ambíguo pergunta qual criança antes de entregar", () => {
    const t = ORCH.slice(ORCH.indexOf("pedeArtefatoImprimivel(inbound.texto)"));
    expect(t.indexOf("perguntarQualCrianca")).toBeLessThan(t.indexOf("entregarArtefatoImprimivel"));
  });
});

describe("o PDF simples reusa o gerador que já existia", () => {
  it("nenhum gerador novo foi criado", () => {
    expect(GUIADA).toMatch(/await entregarPdfDaRotina\(supabase, \{/);
    const SRC = readFileSync(resolve(__dirname, "rotina-pdf-rota.ts"), "utf8");
    expect(SRC).not.toMatch(/pdf-lib|PDFDocument/);
  });

  it("3. e não depende de cards_status", () => {
    // Sem as linhas de comentário: a única menção ali é o comentário que diz
    // justamente que não depende. O que importa é não haver LEITURA do campo.
    const trecho = GUIADA.slice(
      GUIADA.indexOf("// PDF SIMPLES: imediato"),
      GUIADA.indexOf("return enviou ? RESPOSTA_PDF.enviado"),
    );
    const codigo = trecho
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(codigo).not.toMatch(/cards_status/);
  });
});
