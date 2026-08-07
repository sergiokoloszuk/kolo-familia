/**
 * OS ÂNGULOS JÁ USADOS — pra conversa subir um degrau em vez de girar.
 *
 * ⚠️ POR QUE EXISTE (07/08/2026, conversa real da Karina sobre o Mario): em
 * dois turnos seguidos a Ayla entregou a MESMA orientação — sair da loja,
 * falar pouco, oferecer pressão/movimento, observar o gatilho. E não foi por
 * falta de contexto: a resposta anterior estava no histórico, provada no
 * banco. Ela tinha diante dos olhos o que já havia dito e disse de novo.
 *
 * A regra de progressão já existia na VOZ ("A CADA TURNO, AVANCE A CONVERSA")
 * e não segurou. Exortação genérica no fim de um núcleo grande o modelo
 * atropela; a lista concreta do que ele mesmo já disse é bem mais difícil de
 * ignorar. Por isso isto é código, não mais uma linha de prompt.
 *
 * ═══ POR QUE ÂNGULO E NÃO TÍTULO ═══
 *
 * A primeira ideia foi ler os títulos em negrito das respostas anteriores.
 * Não serve: "O que fazer agora" e "O que eu faria primeiro" são genéricos
 * demais — dizem a forma, não o conteúdo. Duas respostas idênticas no mérito
 * saem com títulos diferentes e passariam batido.
 *
 * O que se detecta aqui é a ESTRATÉGIA orientada: afastar da prateleira, falar
 * pouco, oferecer pressão. É o que a mãe reconheceria como "isso você já me
 * disse".
 *
 * ═══ O QUE ESTE MÓDULO NÃO É ═══
 *
 * Não é classificador, não chama modelo nenhum e não custa token de entrada
 * além do bloco curto que devolve. É léxico sobre o texto que a Ayla já
 * escreveu — barato o bastante pra rodar em todo turno dos dois canais.
 *
 * O viés é PERMISSIVO de propósito: na dúvida, não marca. Marcar ângulo que
 * não foi dado proíbe a Ayla de falar do que ainda não falou, e isso é pior
 * que deixar passar uma repetição.
 */

export type Angulo = {
  /** Estável — é o que os testes fixam. */
  id: string;
  /** Como o ângulo aparece pra ela no prompt. Frase da mãe, não jargão. */
  rotulo: string;
  padrao: RegExp;
};

/**
 * O repertório prático que a Ayla circula. Não é taxonomia fechada de nada —
 * é o conjunto de caminhos que aparecem nas respostas dela hoje, que é o que
 * precisa parar de se repetir.
 */
export const ANGULOS: readonly Angulo[] = [
  {
    id: "afastar",
    rotulo: "tirar do lugar / afastar dos objetos",
    padrao: /\b(afast|retir)\w*\s+(d[aoe]s?|o|a)?\s*\w*\s*(objeto|prateleira|quina|frágil)|sair (um pouco |da loja|do local|dali)|lev(e|ar)\s+\w+\s+para (um canto|fora)/i,
  },
  {
    id: "falar_pouco",
    rotulo: "reduzir a fala / menos palavras",
    padrao: /\b(reduz\w*|diminu\w*|menos)\s+(a\s+)?(fala|palavras?|estímulos? verbais)|fale (baixo e )?pouco|não tente (explicar|convencer)/i,
  },
  {
    id: "pressao_movimento",
    rotulo: "pressão ou movimento (empurrar, apertar, caminhar)",
    padrao: /empurrar (a |uma )?parede|apertar (uma |a )?almofada|fazer força|abraço (firme|apertado|de urso)|pressão (segura|profunda)|caminhar (alguns |uns )?minutos/i,
  },
  {
    id: "prevencao",
    rotulo: "agir antes, na preparação",
    padrao: /antes de (entrar|sair|ir)|não esperar\w*\s+\w+\s+(ficar|começar)|prevenir|combine antes/i,
  },
  {
    id: "treino_gradual",
    rotulo: "treino gradual (começar curto e aumentar)",
    padrao: /comece com|aos poucos|gradual\w*|vá aumentando|aumente (aos poucos|gradualmente)|\b(5|10|cinco|dez)[–\-\s]*(a\s*\d+\s*)?minutos? e (saia|volte)/i,
  },
  {
    id: "funcao_missao",
    rotulo: "dar uma função / missão concreta",
    padrao: /missão|(dê|dar|dando) (uma )?(função|tarefa)|ajudante|me ajuda(r)? a (levar|carregar|empurrar)|mãos (no|na) (carrinho|cestinha)|segurar a lista/i,
  },
  {
    id: "duracao",
    rotulo: "encurtar a duração / saída planejada",
    padrao: /visita (curta|breve)|mantenha? \w* breve|tempo limitado|saída (planejada|prevista)|idas? curtas?/i,
  },
  {
    id: "previsibilidade",
    rotulo: "antecipar o que vai acontecer (previsibilidade)",
    padrao: /combinad[oa]|antecip\w+|diga (antes )?o que vai acontecer|avis\w+ antes|rotina visual|quadro de rotina/i,
  },
  {
    id: "frase_pronta",
    rotulo: "frase pronta pra ela usar na hora",
    padrao: /pode dizer (apenas |só )?[:"“]|frase (simples|pronta)|dig[au] (assim )?[:"“]/i,
  },
  {
    id: "adaptacao_ambiente",
    rotulo: "adaptar o ambiente (barulho, luz, horário)",
    padrao: /reduz\w*\s+(o\s+)?(barulho|som|luz|estímulos?)|horário (mais )?vazio|lugar (mais )?(calmo|vazio|tranquilo)|menos estímulos/i,
  },
  {
    id: "observacao",
    rotulo: "observar quando/onde começa (observação discriminativa)",
    padrao: /repare se|observe se|note se|começa na entrada|em que momento|piora (mais )?(em|quando)/i,
  },
  {
    id: "outros_olhando",
    rotulo: "lidar com quem está olhando",
    padrao: /pessoas (olhando|que olham)|não precisa (se )?justificar|o que dizer às pessoas|julgamento/i,
  },
];

/** Quantos ângulos entram no bloco. Além disso vira parede de texto e a Ayla
 *  fica sem caminho — o objetivo é podar repetição, não emudecer. */
const MAX_NO_BLOCO = 6;

/**
 * Quais estratégias já foram orientadas nos turnos anteriores DELA.
 *
 * Recebe só o que a Ayla escreveu: o que a mãe disse não é orientação dada, e
 * marcar a fala dela proibiria a Ayla de responder ao que foi perguntado.
 */
export function angulosUsados(textosDaAyla: readonly string[]): string[] {
  const texto = textosDaAyla.filter((t) => typeof t === "string" && t.trim()).join("\n");
  if (!texto) return [];
  return ANGULOS.filter((a) => a.padrao.test(texto))
    .map((a) => a.rotulo)
    .slice(0, MAX_NO_BLOCO);
}

/**
 * O bloco que entra no prompt. Vazio quando não há repetição a evitar — não
 * pode virar peso fixo em toda conversa, sobretudo no primeiro turno.
 *
 * Ele NOMEIA o que já foi dado e NOMEIA saídas. Só proibir empurraria a Ayla
 * pro silêncio ou pra reformular a mesma coisa com outras palavras, que é a
 * repetição de novo — só que disfarçada.
 */
export function blocoProgressao(rotulos: readonly string[]): string {
  if (rotulos.length === 0) return "";
  const naoUsados = ANGULOS.filter((a) => !rotulos.includes(a.rotulo))
    .map((a) => a.rotulo)
    .slice(0, 5);
  return [
    "<ja_orientado_neste_assunto>",
    ...rotulos.map((r) => `- ${r}`),
    "</ja_orientado_neste_assunto>",
    "NÃO repita esses pontos como orientação principal — a família já os tem. Se um deles ainda for necessário, cite em meia linha e siga adiante.",
    naoUsados.length > 0
      ? `AVANCE para um ângulo novo. Ainda não usados aqui: ${naoUsados.join("; ")}. Ou outro que sirva melhor ao que ela acabou de contar.`
      : "AVANCE: aprofunde um caso concreto, um obstáculo previsível ou como saber se está funcionando.",
  ].join("\n");
}
