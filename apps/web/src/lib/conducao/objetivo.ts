import { pedeUmPlano } from "@/lib/ia/pedido-plano";

/**
 * O OBJETIVO VIGENTE DA CONVERSA — o que esta família decidiu trabalhar AGORA.
 *
 * ⚠️ POR QUE ISTO EXISTE. Até 11/08/2026 o Plano da web nascia da concatenação
 * de TODAS as falas da mãe (`papel === "user"`, 1.800 caracteres, sem
 * hierarquia). Três consequências, todas medidas na auditoria de PEND-027:
 *
 *   - o REFINAMENTO se perdia. "Quero melhorar a comunicação" vira, ao longo da
 *     conversa, "ela fala bem mas trava para entrar na roda" — e essa frase é da
 *     Ayla. Descartada, o plano voltava ao tema genérico.
 *   - o ACEITE virava objetivo. "sim" e "pode ser" entravam no meio do texto
 *     com o mesmo peso de tudo.
 *   - a MUDANÇA DE DIREÇÃO não vencia. Objetivo antigo e novo competiam sem
 *     que nada dissesse qual valia.
 *
 * ⚠️ E POR QUE NÃO É "incluir também as falas da Ayla". Concatenar os dois lados
 * contamina o objetivo com hipótese não confirmada, sugestão descartada,
 * pergunta e possibilidade que a mãe não escolheu. O problema nunca foi de
 * QUANTIDADE de texto — é de HIERARQUIA. A solução é a mesma que o WhatsApp já
 * usa desde 03/08: **um objetivo em destaque, o resto explicitamente
 * subordinado a ele**.
 *
 * ⚠️ E POR QUE NÃO UMA CHAMADA DE MODELO. Seria uma segunda fonte de verdade
 * para uma pergunta que os dados já respondem, e uma chance a mais de inventar
 * objetivo. Aqui é determinístico: dá para ler o código e saber o que sai.
 */

/**
 * ACEITE CURTO NÃO É OBJETIVO.
 *
 * "sim" não carrega conteúdo: usá-lo como alvo do Plano produz um plano sobre
 * nada. Quando a última fala é uma destas, o objetivo está no turno ANTERIOR —
 * é a mesma leitura que `classificarIntencao` já faz para não recomeçar a
 * conversa a cada resposta curta.
 *
 * A lista é FECHADA de propósito, e não um teste de tamanho: "ele morde" tem
 * dez caracteres e é uma situação concreta. O erro caro seria descartar uma
 * fala curta que diz algo.
 */
const ACEITES = new Set([
  "sim", "quero", "queria", "pode", "pode ser", "podeser", "vamos", "vamo",
  "faz", "manda", "isso", "isso mesmo", "essa", "esse", "aceito", "claro",
  "ok", "okay", "blz", "beleza", "certo", "combinado", "perfeito", "top",
  "bora", "uhum", "aham", "sim por favor", "por favor", "obrigada", "obrigado",
  "valeu", "legal", "otimo", "ótimo", "boa", "gostei", "adorei", "quero sim",
  "pode sim", "vamos sim", "a primeira", "a segunda", "a terceira", "o primeiro",
  "o segundo", "1", "2", "3", "4", "5",
]);

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[!.?,;:]/g, "").replace(/\s+/g, " ").trim();

/**
 * Esta fala carrega objetivo, ou é só uma confirmação?
 *
 * Também derruba o PEDIDO DE PLANO puro ("me monta um plano"): pedir o artefato
 * não diz sobre o quê ele é. Mas um pedido COM assunto ("me monta um plano pra
 * ela dormir sozinha") é substantivo — daí o teste ser sobre o que sobra depois
 * de tirar o pedido, e não sobre a presença da palavra "plano".
 */
export function ehFalaSubstantiva(texto: string | null | undefined): boolean {
  const t = norm(texto ?? "");
  if (!t) return false;
  if (ACEITES.has(t)) return false;
  // Pedido de plano sem assunto: "pode me montar um plano?" → não é objetivo.
  if (pedeUmPlano(texto ?? "")) {
    const semPedido = t
      .replace(/\b(plano|roteiro|passo a passo)\b/g, " ")
      .replace(/\b(quero|queria|preciso|gostaria|pode|poderia|consegue|tem como|me|voce|voce|faz|fazer|monta|montar|cria|criar|prepara|preparar|manda|mandar|traz|trazer|um|uma|o|a|de|pra|para|por favor)\b/g, " ")
      .replace(/\s+/g, " ").trim();
    return semPedido.length >= 12;
  }
  return t.length >= 6;
}

export type TurnoConversa = {
  de: "familia" | "ayla";
  texto: string;
  /** A Ayla ofereceu o Plano NESTE turno? (marcador presente) */
  ofereceuPlano?: boolean;
};

export type ObjetivoDaConversa = {
  /** O alvo do Plano, nas palavras de quem o disse. */
  objetivo: string;
  /** De onde ele veio — para o log e para o teste, não para o prompt. */
  origem: "familia" | "oferta_da_ayla" | "fallback";
  /** O que ficou como pano de fundo, já em ordem cronológica. */
  contexto: TurnoConversa[];
};

/**
 * A HIERARQUIA, aplicada de trás para frente.
 *
 * 1. última fala SUBSTANTIVA da família — decisão explícita mais recente vence;
 * 2. se a última fala foi só um aceite, e a Ayla tinha OFERECIDO o plano logo
 *    antes, o objetivo é o da oferta — foi o que a família confirmou ao dizer
 *    "sim". É este passo que preserva o refinamento construído na conversa sem
 *    dar a hipótese solta da Ayla como objetivo: só vale a oferta que a família
 *    aceitou em seguida.
 * 3. nada disso → a última fala da família, qualquer que seja (fallback honesto:
 *    é melhor um objetivo fraco e rastreável do que um inventado).
 *
 * ⚠️ HIPÓTESE NÃO CONFIRMADA NUNCA VIRA OBJETIVO. Uma fala da Ayla só ganha
 * precedência quando (a) é a oferta do Plano e (b) a família respondeu com
 * aceite logo depois. Sem o aceite, ela é contexto como qualquer outra.
 */
export function objetivoDaConversa(turnos: readonly TurnoConversa[]): ObjetivoDaConversa | null {
  if (turnos.length === 0) return null;

  const ultimoIdxFamilia = (() => {
    for (let i = turnos.length - 1; i >= 0; i--) if (turnos[i].de === "familia") return i;
    return -1;
  })();
  if (ultimoIdxFamilia === -1) return null;

  // 1 · a última fala substantiva da família
  for (let i = turnos.length - 1; i >= 0; i--) {
    const t = turnos[i];
    if (t.de !== "familia") continue;
    if (ehFalaSubstantiva(t.texto)) {
      return { objetivo: t.texto.trim(), origem: "familia", contexto: turnos.filter((_, j) => j !== i) };
    }
    // 2 · foi aceite: a oferta que a família acabou de confirmar vale
    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
      const anterior = turnos[j];
      if (anterior.de === "ayla" && anterior.ofereceuPlano) {
        return {
          objetivo: anterior.texto.trim(),
          origem: "oferta_da_ayla",
          contexto: turnos.filter((_, k) => k !== j),
        };
      }
      if (anterior.de === "familia" && ehFalaSubstantiva(anterior.texto)) {
        return {
          objetivo: anterior.texto.trim(),
          origem: "familia",
          contexto: turnos.filter((_, k) => k !== j),
        };
      }
    }
  }

  // 3 · fallback
  const t = turnos[ultimoIdxFamilia];
  return {
    objetivo: t.texto.trim(),
    origem: "fallback",
    contexto: turnos.filter((_, j) => j !== ultimoIdxFamilia),
  };
}

/** Teto do texto que vai ao gerador. O objetivo NUNCA entra nesta conta. */
const TETO_CONTEXTO = 1800;

/**
 * O ENQUADRAMENTO — a semântica que o WhatsApp já provou desde 03/08.
 *
 * Um objetivo em destaque e o resto explicitamente subordinado. É isto que os
 * dois canais compartilham; a SELEÇÃO das mensagens continua sendo de cada um
 * (a web tem `conversa_id`, o WhatsApp tem janela de 45 min e isolamento por
 * irmão — regras diferentes para realidades diferentes).
 *
 * ⚠️ O CORTE COMEÇA PELO CONTEXTO MAIS ANTIGO, e nunca toca o objetivo. Antes,
 * um `slice(0, 1800)` sobre o texto inteiro podia decapitar justamente a última
 * decisão da família numa conversa longa — o objetivo ficava de fora do próprio
 * plano que ele deveria dirigir.
 */
export function enquadrarObjetivo(o: ObjetivoDaConversa, nomeQuemFala = "Mãe"): string {
  const linhas: string[] = [];
  let orcamento = TETO_CONTEXTO;
  // De trás para frente: o contexto RECENTE é o que explica o objetivo.
  for (let i = o.contexto.length - 1; i >= 0; i--) {
    const t = o.contexto[i];
    const txt = t.texto.trim();
    if (!txt) continue;
    const linha = `${t.de === "familia" ? nomeQuemFala : "Ayla"}: ${txt.slice(0, 500)}`;
    if (linha.length > orcamento) break;
    orcamento -= linha.length;
    linhas.unshift(linha);
  }

  const alvo = `O OBJETIVO DESTE PLANO é este, e só ele:\n"${o.objetivo}"`;
  if (linhas.length === 0) return alvo;

  return `${alvo}\n\nA conversa abaixo é CONTEXTO — serve para você entender a criança, o que já foi tentado e o que a família respondeu. Ela NÃO é o objetivo: não amplie o plano para outros temas que aparecem aqui, não retome assunto que a família deixou para trás, e não trate hipótese que ela não confirmou como se fosse fato.\n\n${linhas.join("\n")}`;
}
