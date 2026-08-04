import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * UM PEDIDO DE PLANO, UMA ENTREGA — 03/08/2026, teste real de produção.
 *
 * A mãe pediu um plano sobre pinça e pegada do lápis. Recebeu CINCO mensagens:
 * um acolhimento, um anúncio ("já estou montando… vai chegar em PDF e com
 * link"), um magic link que abria o Relatório pra professora, uma instrução
 * inventada ("No app: Lúdico → Plano estratégico → Criar plano") e só então a
 * entrega de verdade, com o PDF e o link certo.
 *
 * Dois fluxos responderam ao mesmo pedido e nenhum sabia do outro. E o PDF que
 * chegou certo se chamava "Guardar brinquedos com modelo junto" — título
 * herdado de uma conversa de 9h25 antes, que ainda cabia nas 10 últimas
 * mensagens que o gerador usava como "desafio".
 */

const PONTE = readFileSync(resolve(__dirname, "ponte.ts"), "utf8");
const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const RESP = readFileSync(resolve(__dirname, "responder.ts"), "utf8");

// ============================================================
// 1. O CONTEXTO DO PLANO
// ============================================================

describe("o desafio é o pedido de agora", () => {
  it("a conversa recente ganhou janela — não são mais 'as 10 últimas'", () => {
    expect(PONTE).toMatch(/const desde = new Date\(Date\.now\(\) - 45 \* 60 \* 1000\)/);
    expect(PONTE).toMatch(/\.gte\("created_at", desde\)/);
  });

  it("o pedido de agora é declarado como o assunto, e o resto como contexto", () => {
    expect(PONTE).toMatch(/O PEDIDO DE AGORA é este/);
    expect(PONTE).toMatch(/o título tem que refletir ISSO/);
    expect(PONTE).toMatch(/ele é contexto, não é o plano/);
  });

  it("sem conversa recente, o desafio é a própria mensagem", () => {
    expect(PONTE).toMatch(/if \(linhas\.length === 0\) return mensagemAtual/);
  });

  it("guarda o caso real que produziu o título errado", () => {
    expect(PONTE).toMatch(/Guardar brinquedos com modelo/);
    expect(PONTE).toMatch(/9h25 antes/);
  });
});

// ============================================================
// 2 e 3. UMA AUTORIDADE DE ENTREGA
// ============================================================

describe("o turno reativo não compete com a ponte", () => {
  it("pedido de plano não recebe os links do Lúdico", () => {
    expect(ORCH).toMatch(/const pedidoDePlano = pedeUmPlano\(inbound\.texto\)/);
    expect(ORCH).toMatch(/const ofereceLudico = ehCrianca && !pedidoDePlano/);
    expect(ORCH).toMatch(/const linksLudico = ofereceLudico/);
  });

  it("nenhum dos cinco links é mais cunhado por `ehCrianca` sozinho", () => {
    expect(ORCH).not.toMatch(/ehCrianca \? gerarMagicLink/);
    expect(ORCH).not.toMatch(/^\s*ehCrianca\n\s*\? gerarMagicLink/m);
  });

  it("os links continuam existindo pra quem realmente pede o recurso", () => {
    // A regressão proibida: história, rotina, desenho, avatar e relatório
    // seguem sendo entregues em conversa comum.
    expect(ORCH).toMatch(/next: "\/historias\/criar"/);
    expect(ORCH).toMatch(/next: "\/ludico\/rotinas\/semana"/);
    expect(ORCH).toMatch(/next: "\/ludico\/desenhos"/);
    expect(ORCH).toMatch(/next: "\/configuracoes\/avatar"/);
    expect(ORCH).toMatch(/next: "\/evolucao\/relatorio"/);
  });

  it("a fala do pedido de plano não anuncia, não manda link, não dá caminho", () => {
    expect(RESP).toMatch(/QUEM ENTREGA O PLANO NÃO É VOCÊ, É O SISTEMA/);
    expect(RESP).toMatch(
      /NÃO mande link nenhum, NÃO diga que o PDF está vindo, NÃO diga que já montou, NÃO dê caminho de menu no app/,
    );
    // A forma antiga — anunciar o PDF e o link — não pode voltar.
    expect(RESP).not.toMatch(/vai mandar agora — em PDF e com um link pra abrir no app/);
  });

  it("a ponte segue sendo quem entrega, com o link específico", () => {
    expect(ORCH).toMatch(/const nudge = await montarPonteWhatsApp\(supabase, \{/);
    expect(ORCH).toMatch(/forcar: querPlano/);
  });
});

// ============================================================
// 4. NAVEGAÇÃO
// ============================================================

describe("caminho no app", () => {
  it("só os caminhos que existem, e nada de inventar seguindo o padrão", () => {
    expect(RESP).toMatch(/Use SÓ estes caminhos, que são os que existem de verdade/);
    expect(RESP).toMatch(/NUNCA invente um caminho seguindo o padrão destes/);
    expect(RESP).not.toMatch(/SEMPRE mande TAMBÉM o CAMINHO/);
  });

  it("artefato pronto → o link é a navegação, não a tela de criação", () => {
    expect(RESP).toMatch(
      /não mande a mãe pra uma tela de criação depois que a coisa já está pronta/,
    );
  });
});

// ============================================================
// 5 e 7. O QUE NÃO PODE QUEBRAR
// ============================================================

describe("o resto da cadeia do Plano continua igual", () => {
  it("valida antes de persistir", () => {
    const PLANO = readFileSync(resolve(__dirname, "../ia/plano.ts"), "utf8");
    expect(PLANO.indexOf("validarPlano({")).toBeLessThan(PLANO.indexOf('.from("planos")\n    .insert('));
    expect(PLANO).toMatch(/throw new PlanoSemSubstanciaError/);
  });

  it("o deep link do plano continua específico", () => {
    expect(PONTE).toMatch(/\/planos\/\$\{/);
  });

  it("a segurança continua barrando o Plano", () => {
    expect(ORCH).toMatch(/args\.tipo === "resposta_registro" && !args\.params\.notaDeSeguranca/);
  });
});
