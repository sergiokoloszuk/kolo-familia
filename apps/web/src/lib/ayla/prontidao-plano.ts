import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";

/**
 * "A conversa já tem que virar entrega — e qual?" — o DECISOR de entrega.
 *
 * Histórico (importa pra não repetir o vaivém, que já deu três voltas):
 * - Até 24/07/2026 a ponte entregava o plano sozinha assim que o parser marcava
 *   um desafio. Atropelava a conversa e, com quem tinha acabado de chegar, saía
 *   genérico (perfil raso).
 * - No 6d4e21a isso virou "a mãe precisa dizer a palavra plano". Aí a rota
 *   determinística morreu e conversas de dias terminavam sem NENHUMA entrega.
 * - No d326b35 entrou um gate de suficiência que exigia TRÊS critérios ao mesmo
 *   tempo (problema + contexto + exemplo) e reprovava "sofrimento do adulto".
 *   Na auditoria de 30/07 ele reprovou uma conversa que era, funcionalmente,
 *   um pedido de plano: "ela não está ligando pontos e queria exercitar isso
 *   com ela". Três de três é rígido demais — e o desabafo junto do pedido não
 *   apaga o pedido.
 *
 * O que mora aqui agora não é um sim/não: é a ESCOLHA DO PRÓXIMO MOVIMENTO.
 *
 *   gerar     → tem material suficiente; entrega o plano (e a Ayla só avisa)
 *   perguntar → falta UMA coisa essencial; a Ayla faz UMA pergunta e nada mais
 *   conversar → ainda é acolhimento/investigação aberta
 *
 * Duas mudanças de fundo em relação ao gate antigo:
 *
 * 1. PONTUAÇÃO, não "3 de 3". Vários caminhos levam a material suficiente —
 *    objetivo declarado pela mãe vale tanto quanto exemplo concreto.
 * 2. FECHADOR OBRIGATÓRIO. Se a Ayla já terminou duas respostas seguidas
 *    perguntando sobre o mesmo assunto, ela perde o direito de perguntar de
 *    novo. Boa conversa que nunca conclui não é boa conversa — é a mãe
 *    trabalhando de graça pra gente.
 *
 * A rubrica está escrita em RUBRICA_SUFICIENCIA de propósito, num lugar só, pra
 * a Karina poder ler e ajustar sem caçar prompt.
 */

/** Quanto cada elemento da conversa vale. Somado, decide o próximo movimento. */
export const RUBRICA_SUFICIENCIA = `Pontue o que a conversa JÁ tem (some tudo o que se aplica):

+2 HABILIDADE OU DIFICULDADE DEFINIDA — dá pra nomear o que precisa ser trabalhado ("não liga os pontos entre as coisas", "não come nada de textura mole", "trava na transição de sair de casa"). Não vale mal-estar difuso ("tá difícil", "tô cansada").
+2 OBJETIVO DA MÃE — ela disse o que QUER fazer, mesmo sem usar a palavra plano: "queria exercitar isso com ela", "quero ensinar", "quero treinar", "o que faço em casa", "quero como brincadeira", "quero trabalhar isso".
+1 CRIANÇA IDENTIFICADA — está claro de quem é o desafio.
+1 CONTEXTO — quando/onde acontece (em casa, na escola, na hora de dormir, quando precisa parar algo).
+1 EXEMPLO CONCRETO — uma situação real que a família contou, com detalhe.
+1 PERFIL COM DADOS — o bloco de perfil trazido junto já tem idade/interesses/desafios pra personalizar.

Zere tudo (score 0) quando NÃO cabe entregável nenhum:
- crise acontecendo AGORA (a pessoa precisa de socorro, não de material);
- a conversa é sobre outra coisa (preço, acesso ao app, agradecimento, assunto do time humano);
- a família está falando de várias crianças e ainda não dá pra saber de quem é o desafio;
- é dúvida pontual que a própria resposta na conversa resolve.

IMPORTANTE — sofrimento NÃO anula pedido. "Achava que ela não aprendia nada, queria exercitar isso com ela" tem as duas camadas: o desabafo E o pedido prático. Pontue o pedido normalmente. Acolher é trabalho da resposta, não motivo pra não entregar.`;

export type AcaoEntrega = "gerar" | "perguntar" | "conversar";

export type DecisaoEntrega = {
  /** O próximo movimento da Ayla. */
  acao: AcaoEntrega;
  /** O tema específico do plano, nas palavras da conversa. */
  tema: string | null;
  /** Soma da rubrica (0-8). Vai pro log — é como se calibra o corte. */
  score: number;
  /** O que faltou, quando faltou. Ex.: ["tipo de associação"]. */
  faltando: string[];
  /** A ÚNICA pergunta a fazer, quando acao === "perguntar". */
  pergunta: string | null;
  /** A mensagem é, funcionalmente, um pedido de entrega estruturada. */
  pedidoExplicito: boolean;
  /** A entrega foi forçada porque a Ayla já investigou demais. */
  fechador: boolean;
  /** Por que este movimento — vai pro log, ajuda a calibrar. */
  motivo: string;
};

const CONVERSAR = (motivo: string): DecisaoEntrega => ({
  acao: "conversar",
  tema: null,
  score: 0,
  faltando: [],
  pergunta: null,
  pedidoExplicito: false,
  fechador: false,
  motivo,
});

/** Corte pra entregar direto. */
const SCORE_GERAR = 5;
/** Abaixo disto nem pergunta — ainda é conversa aberta. */
const SCORE_PERGUNTAR = 3;

/**
 * A Ayla já terminou as duas últimas respostas perguntando? Então ela está
 * investigando em loop e a próxima tem que fechar.
 *
 * Deliberadamente burro (olha o "?" no fim do texto, não o tema): rastrear tema
 * exigiria estado novo no banco, e duas perguntas seguidas já são sinal
 * suficiente. Falso positivo custa um plano entregue cedo demais; falso
 * negativo custa a conversa infinita que a gente está consertando.
 */
const TERMINA_PERGUNTANDO = /\?[\s"'*_)\]}\p{Extended_Pictographic}\u{FE0F}\u{200D}]*$/u;

export async function investigandoEmLoop(
  supabase: SupabaseClient,
  familyId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("ayla_messages")
      .select("texto")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .eq("tipo", "resposta_registro")
      .order("created_at", { ascending: false })
      .limit(2);
    const ultimas = (data ?? []) as Array<{ texto: string | null }>;
    if (ultimas.length < 2) return false;
    return ultimas.every((m) => TERMINA_PERGUNTANDO.test((m.texto ?? "").trim()));
  } catch {
    return false;
  }
}

/**
 * Lê as últimas trocas e decide o próximo movimento. Chamada leve (Haiku), UMA
 * só — antes de a Ayla responder, porque "faça uma pergunta e nada mais" é
 * instrução PRA ELA: decidir depois de ela já ter falado chega tarde.
 *
 * Qualquer falha → conversar: na dúvida a conversa segue (o silêncio é
 * recuperável; um plano genérico entregue não é).
 */
export async function decidirEntrega(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    mensagemAtual: string;
    /** O regex de pedido OU o classificador de intenção já apontaram plano. */
    sinalDePedido?: boolean;
    /** Há uma criança definida no foco da conversa. */
    criancaIdentificada?: boolean;
    /** O Perfil (Kolo Vivo) já tem material pra personalizar. */
    perfilComDados?: boolean;
  },
): Promise<DecisaoEntrega> {
  try {
    const [{ data }, emLoop] = await Promise.all([
      supabase
        .from("ayla_messages")
        .select("direcao, texto, created_at")
        .eq("family_account_id", params.familyId)
        .order("created_at", { ascending: false })
        .limit(14),
      investigandoEmLoop(supabase, params.familyId),
    ]);

    const linhas = ((data ?? []) as Array<{ direcao: string; texto: string | null }>)
      .reverse()
      .map((m) => {
        const t = m.texto?.trim();
        if (!t) return null;
        return `${m.direcao === "inbound" ? "Mãe" : "Ayla"}: ${t.slice(0, 400)}`;
      })
      .filter((l): l is string => Boolean(l));

    if (linhas.length < 3 && !params.sinalDePedido) {
      return CONVERSAR("conversa curta demais");
    }

    const system = `Você decide o PRÓXIMO MOVIMENTO da Ayla (assistente de famílias atípicas) numa conversa de WhatsApp: entregar um plano estratégico personalizado, fazer UMA pergunta que destrave a entrega, ou apenas seguir conversando.

${RUBRICA_SUFICIENCIA}

Responda APENAS JSON:
{"score":0-8,"pedido_explicito":true|false,"tema":"...","faltando":["..."],"pergunta":"..."}

- score: a soma da rubrica acima.
- pedido_explicito: a mãe está pedindo uma AÇÃO ESTRUTURADA (ensinar, exercitar, treinar, trabalhar uma habilidade, atividades, brincadeira pra isso, o que fazer em casa/na semana), mesmo sem dizer a palavra "plano". Pedir consolo, contar o dia ou tirar uma dúvida NÃO é.
- tema: o desafio específico em 3 a 8 palavras, nas palavras da própria conversa (ex.: "associar causa e efeito no dia a dia"). null se não houver um.
- faltando: no máximo 2 itens, o que impede um plano BOM (ex.: ["que tipo de associação"]). [] se não falta nada.
- pergunta: a ÚNICA pergunta que destravaria a entrega — curta, fechada, com opções quando couber ("é mais sequência de acontecimentos, causa e efeito, ou relacionar figuras?"). Nunca uma pergunta ampla que só prolonga a conversa. null se nada falta.

Não pergunte o que a conversa ou o perfil já têm (idade, diagnóstico, interesses, dificuldade já nomeada).`;

    const contexto = [
      params.criancaIdentificada ? "Criança do foco: definida." : "Criança do foco: ainda indefinida.",
      params.perfilComDados ? "Perfil da criança: já tem dados." : "Perfil da criança: vazio ou raso.",
      params.sinalDePedido ? "O classificador de intenção apontou PEDIDO DE PLANO." : "",
    ]
      .filter(Boolean)
      .join("\n");

    const client = getAnthropicClient();
    const final = await client.messages.create({
      model: MODELS.leve,
      max_tokens: 350,
      system: [{ type: "text", text: system }],
      messages: [
        {
          role: "user",
          content: `<conversa>\n${linhas.join("\n")}\n</conversa>\n\n<mensagem_de_agora>\n${params.mensagemAtual.slice(0, 800)}\n</mensagem_de_agora>\n\n<contexto>\n${contexto}\n</contexto>\n\nSó o JSON.`,
        },
      ],
    });

    const raw = (final.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return CONVERSAR("resposta ilegível do decisor");
    const o = JSON.parse(m[0]) as Record<string, unknown>;

    const score = Math.max(0, Math.min(8, Number(o.score) || 0));
    const tema = typeof o.tema === "string" && o.tema.trim() ? o.tema.trim() : null;
    const pergunta =
      typeof o.pergunta === "string" && o.pergunta.trim() ? o.pergunta.trim().slice(0, 300) : null;
    const faltando = Array.isArray(o.faltando)
      ? o.faltando.filter((f): f is string => typeof f === "string").slice(0, 2)
      : [];
    // O sinal do classificador de intenção (ou do regex) REFORÇA, mas quem tem a
    // frase inteira na frente é o decisor: se ele leu a conversa e disse que não
    // é pedido, respeitamos. É a ressalva certa — "queria exercitar isso com
    // ela" é pedido; "e agora, o que eu faço da vida?" não é.
    const pedidoExplicito = o.pedido_explicito === true;

    return decidirMovimento({ score, tema, pergunta, faltando, pedidoExplicito, emLoop });
  } catch (e) {
    return CONVERSAR(`falha: ${e instanceof Error ? e.message : "erro"}`);
  }
}

/**
 * A regra de decisão, separada da chamada de IA pra poder ser lida (e testada)
 * sem rede. Ordem importa: o fechador vem por último e vence.
 */
export function decidirMovimento(input: {
  score: number;
  tema: string | null;
  pergunta: string | null;
  faltando: string[];
  pedidoExplicito: boolean;
  emLoop: boolean;
}): DecisaoEntrega {
  const { score, tema, pergunta, faltando, pedidoExplicito, emLoop } = input;
  const base = { tema, score, faltando, pedidoExplicito, fechador: false };

  // Sem tema não há plano focado — e plano sem foco é o genérico que a Karina
  // não quer. Vale pra qualquer caminho.
  if (!tema) return { ...base, acao: "conversar", pergunta: null, motivo: "sem tema definido" };

  // FECHADOR OBRIGATÓRIO: duas respostas seguidas terminando em pergunta e já
  // há material mínimo → acabou a investigação, entrega.
  if (emLoop && score >= SCORE_PERGUNTAR) {
    return {
      ...base,
      acao: "gerar",
      pergunta: null,
      fechador: true,
      motivo: `fechador — 2 turnos investigando, score ${score}`,
    };
  }

  if (score >= SCORE_GERAR) {
    return { ...base, acao: "gerar", pergunta: null, motivo: `score ${score}` };
  }

  // Pedido explícito nunca cai em "conversar": ou entrega, ou faz UMA pergunta
  // e entrega no turno seguinte. Ficar só conversando com quem pediu ação é
  // exatamente a queixa de 30/07.
  if (score >= SCORE_PERGUNTAR || pedidoExplicito) {
    return {
      ...base,
      acao: "perguntar",
      pergunta,
      motivo: `score ${score}${pedidoExplicito ? " (pedido explícito)" : ""} — falta ${faltando.join(", ") || "contexto"}`,
    };
  }

  return { ...base, acao: "conversar", pergunta: null, motivo: `score ${score}` };
}
