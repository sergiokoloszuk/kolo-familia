import { atoSobreArtefato, type AtoSobreArtefato } from "@/lib/conducao/ato-artefato";
import { pedeUmPlano } from "@/lib/ia/pedido-plano";

/**
 * AS QUATRO DECISÕES QUE MORAVAM NUM BOOLEANO SÓ.
 *
 * ⚠️ `forcar` queria dizer, ao mesmo tempo: "a família pediu", "pode criar",
 * "não precisa avaliar se sei o suficiente" e "não precisa checar duplicata".
 * Quatro perguntas diferentes, uma resposta única — e por isso não havia como
 * mudar uma sem mexer nas outras três. Endurecer a suficiência do pedido
 * explícito, por exemplo, exigia desligar junto o anti-duplicata.
 *
 * ⚠️ ESTA FATIA NÃO MUDA COMPORTAMENTO. Os quatro campos são calculados de modo
 * que o resultado seja byte a byte o de antes; o que muda é que agora dá para
 * mexer em UM deles. A prova disso são os testes de equivalência.
 */
export type DecisaoDePlano = {
  /** O que a família quer fazer com o artefato. */
  ato: AtoSobreArtefato;
  /** Há permissão contextual para CRIAR um plano neste turno? */
  autoridadeParaCriar: boolean;
  /**
   * Pular a avaliação de suficiência.
   *
   * ⚠️ HOJE ISTO É `true` SEMPRE QUE HÁ AUTORIDADE, e é exatamente o que a
   * próxima fatia vai atacar: pedido explícito concede autoridade para criar,
   * e não prova que sabemos o bastante para criar BEM. Fica separado aqui
   * justamente para poder ser desligado sozinho.
   */
  pularSuficiencia: boolean;
  /** Pular os freios anti-duplicata (a janela de 20 h e a profundidade). */
  pularDedup: boolean;
};

/**
 * ⚠️ O QUE ESTA FUNÇÃO NÃO DECIDE: dedup de segundos. O cooldown curto — "acabei
 * de mandar um plano agora há pouco" — roda SEMPRE, antes de tudo, e não é
 * pulável por pedido nenhum. Ele protege contra o mesmo turno disparando duas
 * vezes, que é acidente, não intenção.
 */
export function decidirSobrePlano(params: {
  texto: string;
  /** A mãe respondeu "sim" a uma oferta de plano recente. */
  ofertaAceitaAgora: boolean;
}): DecisaoDePlano {
  const ato = atoSobreArtefato(params.texto);
  // O PISO continua sendo o vocabulário do artefato (`pedeUmPlano`), e o ATO
  // decide. Um sem o outro volta a ser o defeito do caso Mário.
  const pedidoExplicito = pedeUmPlano(params.texto) && ato === "criar";
  const autoridadeParaCriar = pedidoExplicito || params.ofertaAceitaAgora;

  return {
    ato,
    autoridadeParaCriar,
    // Iguais a `autoridadeParaCriar` HOJE — e é essa igualdade que a próxima
    // fatia quebra. Escrever os três separados é o que torna isso possível.
    pularSuficiencia: autoridadeParaCriar,
    pularDedup: autoridadeParaCriar,
  };
}
