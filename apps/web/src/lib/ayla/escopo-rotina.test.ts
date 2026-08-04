import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CRITERIO_SUFICIENCIA_ROTINA } from "./prontidao-rotina";
import { SYSTEM_ROTINA } from "@/lib/ludico/rotina-ia-core";

/**
 * O CASO DA TARDE DA MANU — 03/08/2026, primeiro teste real em produção.
 *
 * A mãe escreveu "Quero organizar a tarde da Manu." e recebeu, na hora, uma
 * rotina de 14 etapas com preparação para passeio, protetor solar, aviso do
 * barco e passeio de barco. Ela não tinha informado nenhuma atividade.
 *
 * Tudo aquilo ela tinha dito mesmo — horas antes, sobre outro dia. A janela de
 * 12h que existe pra a Ayla não re-perguntar o que já foi respondido virou
 * matéria-prima da rotina, e a regra do gerador ("não invente o que não foi
 * mencionado") foi obedecida ao pé da letra: mencionado ANTES, em outro
 * assunto, não é mencionado AGORA.
 */

const GUIADA = readFileSync(resolve(__dirname, "rotina-guiada.ts"), "utf8");
const PRONTIDAO = readFileSync(resolve(__dirname, "prontidao-rotina.ts"), "utf8");
const PAGE = readFileSync(
  resolve(__dirname, "../../app/(app)/ludico/rotinas/[id]/page.tsx"),
  "utf8",
);

// ============================================================
// 1. O GERADOR SÓ COMPÕE COM O PEDIDO EM CURSO
// ============================================================

describe("o gerador não herda etapas de outro assunto", () => {
  it("a sequência é só do pedido em curso", () => {
    expect(SYSTEM_ROTINA).toMatch(/A SEQUÊNCIA É SÓ DO PEDIDO EM CURSO/);
    expect(SYSTEM_ROTINA).toMatch(/nunca pra virar etapa/);
  });

  it("guarda o caso real, com o que ele ensina", () => {
    expect(SYSTEM_ROTINA).toMatch(/protetor solar e passeio de barco/);
    expect(SYSTEM_ROTINA).toMatch(/mencionado ANTES, em outro assunto, não é mencionado AGORA/);
  });

  it("sem sequência no pedido, devolve pergunta — não preenche pelo histórico", () => {
    expect(SYSTEM_ROTINA).toMatch(/NÃO preencha com o que você leu no histórico/);
    expect(SYSTEM_ROTINA).toMatch(/devolva "rotinas":\[\] e uma "pergunta"/);
  });

  it("a trava antiga continua lá — ela não estava errada, só era insuficiente", () => {
    expect(SYSTEM_ROTINA).toMatch(/NÃO invente atividades que a pessoa não mencionou/);
  });
});

// ============================================================
// 2. A FRONTEIRA DA CONVERSA
// ============================================================

describe("o que pertence a esta rotina", () => {
  it("a conversa de rotina começa depois da última fala NÃO-rotina da Ayla", () => {
    expect(GUIADA).toMatch(/if \(h\.de === "kolo" && h\.tipo && h\.tipo !== "rotina_conversa"\)/);
    expect(GUIADA).toMatch(/const historicoDaRotina = historico\.slice\(inicio\)/);
  });

  it("o `tipo` passou a ser carregado — sem ele não há fronteira", () => {
    expect(GUIADA).toMatch(/\.select\("texto, direcao, tipo, created_at"\)/);
  });

  it("a prontidão julga sobre a conversa DESTA rotina", () => {
    expect(GUIADA).toMatch(/const conversaTxt = linhas\(historicoDaRotina\)/);
  });

  it("o que veio antes entra rotulado como contexto, não como sequência", () => {
    expect(GUIADA).toMatch(/CONVERSA ANTERIOR \(outro assunto — contexto, NÃO é a sequência de agora\)/);
  });

  it("a janela de 12h continua existindo — ela não era o erro", () => {
    // Ela existe pra a Ayla não re-perguntar o que a mãe já respondeu.
    expect(GUIADA).toMatch(/12 \* 60 \* 60 \* 1000/);
  });
});

// ============================================================
// 3. CONHECIMENTO PRÉVIO × SEQUÊNCIA DE AGORA
// ============================================================

describe("o critério separa o que se sabe do que foi pedido", () => {
  it("rotina anterior e perfil enriquecem, não valem como sequência", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/A SEQUÊNCIA TEM QUE SER DESTA ROTINA/);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/são CONHECIMENTO PRÉVIO/);
  });

  it("o caso da Manu está escrito, e o desfecho esperado também", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(
      /"Quero organizar a tarde da Manu" tem escopo e não tem sequência/,
    );
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/Isso é "falta", e a pergunta é a sequência/);
  });

  // ── A exceção legítima ──────────────────────────────────────────────────
  it("quando ela manda usar o que já contou, usa", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/MAS QUANDO ELA MANDA USAR O QUE JÁ CONTOU, USE/);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/Já te contei os horários, agora monta/);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/segurar seria fazê-la repetir tudo/);
  });

  it("o separador é um só: ela apontou, ou você foi buscar?", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(
      /ela APONTOU pro que já disse, ou você é que foi buscar\?/,
    );
  });

  it("`reusaHistorico` é o campo que carrega essa decisão", () => {
    expect(PRONTIDAO).toMatch(/reusaHistorico: boolean/);
    expect(PRONTIDAO).toMatch(/"reusaHistorico": true SÓ quando a mensagem de agora APONTA/);
    expect(PRONTIDAO).toMatch(/reusaHistorico: o\.reusaHistorico === true/);
  });

  it("falha ou ausência do campo NÃO reusa — o silêncio não autoriza", () => {
    expect(PRONTIDAO).toMatch(/reusaHistorico: false,/);
  });

  it("só ele devolve a janela inteira ao gerador", () => {
    expect(GUIADA).toMatch(
      /historico: prontidao\.reusaHistorico \? historico : historicoDaRotina/,
    );
  });
});

// ============================================================
// 4. VISUAL E PDF — SÓ O PEDIDO EM CURSO
// ============================================================

describe("visual e impressão não varrem 12 horas", () => {
  it("o piso do visual olha a conversa desta rotina", () => {
    expect(GUIADA).toMatch(/historicoDaRotina\.some\(\n\s*\(h\) => h\.de === "mae" && pediuApoioVisual/);
    expect(GUIADA).not.toMatch(/historico\.some\(\(h\) => h\.de === "mae" && pediuApoioVisual/);
  });

  it("o PDF idem", () => {
    expect(GUIADA).toMatch(/historicoDaRotina\.some\(\n\s*\(h\) => h\.de === "mae" && pediuParaImprimir/);
    expect(GUIADA).not.toMatch(/historico\.some\(\(h\) => h\.de === "mae" && pediuParaImprimir/);
  });

  it("o motivo está escrito onde alguém vai ler antes de mexer", () => {
    expect(GUIADA).toMatch(/"cartões" dito três horas antes/);
  });
});

// ============================================================
// 5. ROTINA SIMPLES × ROTINA VISUAL
// ============================================================

describe("a decisão do visual chega ao artefato e à tela", () => {
  it("a Ayla escreve `modo_exibicao` ao criar", () => {
    expect(GUIADA).toMatch(/modo_exibicao: visual \? "cartoes" : "lista"/);
    expect(GUIADA).toMatch(/aplicarRotina\(supabase, familyId, params\.membroAtipicoId, r, tema, visual\)/);
  });

  it("virar visual depois atualiza a tela; o contrário não desfaz a escolha dela", () => {
    expect(GUIADA).toMatch(/} else if \(visual\) \{/);
    expect(GUIADA).toMatch(/se a mãe já escolheu ver em cartões, não desfazemos/);
  });

  it("o cabeçalho segue o modo — não diz 'Rotina Visual' sempre", () => {
    expect(PAGE).toMatch(/\{modoInicial === "cartoes" \? "Rotina Visual" : "Rotina"\}/);
    expect(PAGE).not.toMatch(/<Eyebrow>Rotina Visual<\/Eyebrow>/);
  });

  it("nada de schema novo — `modo_exibicao` já existia", () => {
    expect(PAGE).toMatch(/rotina\.modo_exibicao/);
  });
});
