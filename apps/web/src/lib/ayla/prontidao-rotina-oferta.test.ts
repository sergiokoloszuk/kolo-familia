import { describe, expect, it } from "vitest";
import {
  CONTRATO_PRONTIDAO_ROTINA,
  CRITERIO_SUFICIENCIA_ROTINA,
  CRITERIO_TAMANHO_ROTINA,
} from "./prontidao-rotina";

/**
 * D-R2 e D-R4 (SPEC da Rotina, 08/08/2026) prendem uma DECISÃO DE PRODUTO que
 * vive em texto: o critério que a Karina lê e ajusta. Testar texto tem limite
 * conhecido — prova o que está escrito, não o que o modelo faz com aquilo —,
 * mas é o que impede a regra antiga de voltar por descuido num merge.
 *
 * O teste comportamental de verdade é a bancada, com chamada real; não cabe
 * na suíte e está registrado como pendência de validação na PEND-004.
 */

/** O contrato inteiro do porteiro — é ele que vai para o modelo. */
const CRITERIO = CONTRATO_PRONTIDAO_ROTINA;

describe("D-R4 · acontecimento único também é rotina", () => {
  it("1. o recorte pode ser um evento, e o critério diz isso com todas as letras", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/ACONTECIMENTO/);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/UMA VEZ SÓ/i);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/NÃO exija que se repita/i);
  });

  it("2. os quatro eventos obrigatórios da SPEC estão nomeados", () => {
    for (const evento of [/jantar/i, /dentista/i, /m[ée]dic/i, /viagem/i]) {
      expect(CRITERIO_SUFICIENCIA_ROTINA, `falta o exemplo ${evento}`).toMatch(evento);
    }
  });

  it("3. o critério é a SEQUÊNCIA, não a recorrência", () => {
    // A pergunta que a SPEC define: dá pra enxergar o que vem depois?
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/sequência de acontecimentos/i);
  });

  it("4. MORDE: a regra antiga exigia 'pedaço do dia' como ÚNICO recorte", () => {
    // Se alguém restaurar "1. QUAL PEDAÇO DO DIA —", o evento volta a ficar de
    // fora e este teste cai junto com o 1.
    expect(CRITERIO_SUFICIENCIA_ROTINA).not.toMatch(/1\.\s*QUAL PEDAÇO DO DIA\s*—/);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/1\.\s*QUAL RECORTE/);
  });

  it("5. um acontecimento não pode voltar como 'falta_escopo'", () => {
    expect(CRITERIO).toMatch(/UM ACONTECIMENTO JÁ É ESCOPO/i);
  });
});

describe("D-R2 · o contexto basta para OFERECER o apoio visual", () => {
  it("6. marcar visual é oferecer, não gerar à revelia", () => {
    expect(CRITERIO).toMatch(/marcar true é OFERECER/i);
    expect(CRITERIO).toMatch(/Não é gerar cartão à revelia/i);
  });

  it("7. MORDE: a exigência de evidência prévia não pode voltar", () => {
    // As duas frases que a decisão de 08/08 revogou. Restaurar qualquer uma
    // reintroduz a recusa de apoio visual a quem não sabe pedir.
    expect(CRITERIO).not.toMatch(/Só marque true se houver EVIDÊNCIA/i);
    expect(CRITERIO).not.toMatch(/TRANSIÇÃO DIFÍCIL TAMBÉM NÃO É EVIDÊNCIA DE VISUAL/i);
    expect(CRITERIO).not.toMatch(/Sem evidência, false/i);
  });

  it("8. as situações da decisão estão contempladas", () => {
    for (const situacao of [
      /sair de casa/i,
      /banho/i,
      /dormir/i,
      /desligar a tela/i,
      /trocar de atividade/i,
      /instrução verbal/i,
      /sozinha de mais etapas|autonomia|dê conta sozinha/i,
    ]) {
      expect(CRITERIO, `falta a situação ${situacao}`).toMatch(situacao);
    }
  });

  it("9. INDÍCIO NÃO É CONCLUSÃO — a distinção que a decisão manda preservar", () => {
    expect(CRITERIO).toMatch(/INDÍCIO NÃO É CONCLUSÃO/i);
    expect(CRITERIO).toMatch(/possibilidade relevante a OFERECER/i);
  });

  it("10. não pode virar lista rígida de palavra-chave", () => {
    expect(CRITERIO).toMatch(/NÃO VIRE ISTO NUMA LISTA DE PALAVRAS/i);
  });

  it("11. o diagnóstico continua não valendo como motivo", () => {
    // Esta parte da regra de 03/08 NÃO foi revogada e não pode se perder junto.
    expect(CRITERIO).toMatch(/NÃO INFIRA DO DIAGNÓSTICO/i);
  });
});

describe("o que a mudança NÃO pode ter derrubado", () => {
  it("12. rotina continua não sendo a resposta pra tudo", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/NÃO é caso de gerar rotina quando/i);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/crise acontecendo agora, desabafo/i);
  });

  it("13. sobrecarga sensorial não vira rotina — a sequência não é o que trava", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/sobrecarga sensorial/i);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/a criança sabe perfeitamente o que vem depois/i);
  });

  it("14. duas crianças sem clareza continua barrando a geração", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/várias crianças e não ficou claro/i);
  });

  it("15. o recorte continua sendo exigido — evento é mais um, não menos um", () => {
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/O MÍNIMO pra gerar são DUAS coisas/);
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/UMA SEQUÊNCIA/);
  });

  it("16. pedido explícito continua sem ser rebaixado", () => {
    expect(CRITERIO_TAMANHO_ROTINA).toMatch(/PEDIDO EXPLÍCITO NÃO SE REBAIXA/i);
  });

  it("17. 'não pergunte o que você já tem' continua de pé", () => {
    // Caso G da SPEC: a mãe que já deu tudo não pode ganhar pergunta.
    expect(CRITERIO_SUFICIENCIA_ROTINA).toMatch(/MANDA USAR O QUE JÁ CONTOU, USE/i);
  });
});
