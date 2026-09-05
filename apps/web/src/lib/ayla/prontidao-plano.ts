import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";

/**
 * "Já dá pra entregar o plano?" — o gate de SUFICIÊNCIA.
 *
 * Histórico (importa pra não repetir o vaivém):
 * - Até 24/07/2026 a ponte entregava o plano sozinha assim que o parser marcava
 *   um desafio. Karina reclamou, com razão: atropelava a conversa e, com quem
 *   tinha acabado de chegar, saía genérico (perfil raso).
 * - No commit 6d4e21a isso foi removido e o plano passou a depender da mãe
 *   dizer a palavra "plano" (ou aceitar uma oferta). Aí virou o outro extremo:
 *   conversas de dias, ricas, terminando sem NENHUMA entrega.
 *
 * O meio-termo que a Karina pediu era "conversa rica → ao ter elementos
 * suficientes, entregar". É isso que mora aqui: não é a PALAVRA que libera o
 * plano, é o ESTADO da conversa.
 *
 * O critério é conteúdo de produto — está escrito em CRITERIO_SUFICIENCIA de
 * propósito, num lugar só, pra a Karina poder ler e ajustar sem caçar prompt.
 */

/** O que precisa estar na mesa pra um plano sair BOM (e não genérico). */
export const CRITERIO_SUFICIENCIA = `Um plano estratégico só vale a pena quando a conversa JÁ TEM, ao mesmo tempo:
1. PROBLEMA DEFINIDO — um desafio concreto e nomeável do dia a dia (a transição que gera crise, a seletividade alimentar, o travamento na fala), não um mal-estar difuso ("tô cansada", "tá difícil").
2. CONTEXTO — quando/onde aquilo acontece (em casa, na escola, na hora de dormir, quando precisa parar algo).
3. EXEMPLO CONCRETO — pelo menos UMA situação real que a família contou, com detalhe ("não termina o quebra-cabeça antes do sinal tocar", "grita quando ofereço a palavra que ele procura").

NÃO está pronto quando:
- é crise acontecendo agora, desabafo ou sofrimento do adulto (aí a pessoa precisa de acolhimento, não de material);
- é dúvida pontual que a resposta na conversa já resolve;
- o tema apareceu agora e ainda não foi explorado (1 mensagem solta);
- a conversa está sobre outra coisa (preço, acesso ao app, agradecimento, assunto do time humano);
- a família está falando de várias crianças e ainda não ficou claro de quem é o desafio.`;

export type Prontidao = {
  pronto: boolean;
  /** O tema específico do plano, nas palavras da conversa. */
  tema: string | null;
  /** Por que sim/não — vai pro log, ajuda a calibrar o critério. */
  motivo: string;
};

const NAO = (motivo: string): Prontidao => ({ pronto: false, tema: null, motivo });

/**
 * ⚠️ O GATE DE EVIDÊNCIA — 05/09/2026, incidente Vanessa/Lucila.
 *
 * ⚠️ O QUE ACONTECEU. A Vanessa recebeu um plano cujo tema era **"Responder
 * 'ok' com clareza"**. A Lucila recebeu **"Dizer 'ok' e seguir instruções"** e
 * **"Esperar após fazer um pedido"** (depois de dizer "Verdade"). Existe até um
 * plano chamado **"Jackson tem 9 anos"** — o cadastro da criança virou desafio.
 *
 * ⚠️ POR QUE O CRITÉRIO ANTIGO DEIXOU PASSAR. `linhas` é o histórico INTEIRO,
 * Ayla incluída. Na Vanessa, as 14 últimas mensagens eram seis proativas da
 * própria Ayla, um aviso de Trial e UMA palavra da mãe: "Ok". O `linhas.length
 * < 3` foi satisfeito por mensagens que a Kolo escreveu para si mesma, e o
 * modelo — obrigado a devolver um tema "nas palavras da própria conversa" —
 * pegou a única palavra disponível.
 *
 * ⚠️ MEDI A DIMENSÃO: **51 dos 195 planos (26%)** nasceram até 10 minutos
 * depois de uma resposta de até três palavras, em 32 famílias. Quatro são
 * indefensáveis; a maioria é legítima (resposta curta que FECHA uma
 * investigação rica). Por isso o gate mede a evidência da FAMÍLIA, e não o
 * tamanho da última mensagem — bloquear por tamanho mataria os legítimos.
 */
const MIN_INBOUNDS_COM_SUBSTANCIA = 2;
/**
 * Abaixo disto a mensagem é aceite, escolha de menu ou confirmação.
 *
 * ⚠️ TRÊS, E NÃO QUATRO. Com quatro, a bancada dos 195 planos reais barrou
 * **"Aponta e leva — pedindo ajuda"**, e a mãe tinha escrito exatamente
 * "Aponta e leva": três palavras que SÃO o conteúdo. "Ok", "Verdade", "Sim" e
 * "2" continuam abaixo do corte. O limiar existe para separar aceite de relato,
 * não para exigir prosa de quem escreve curto.
 */
const PALAVRAS_MIN_SUBSTANCIA = 3;

/**
 * ⚠️ CONFIRMAÇÃO NÃO É PEDIDO — e é por isso que este gate existe aqui e não
 * no tamanho da mensagem.
 *
 * A oferta ACEITA já tem caminho próprio: `forcar`, que ignora a prontidão por
 * completo. Logo, tudo que chega neste ponto é o caminho AUTOMÁTICO — e nele um
 * "ok", um "verdade" ou um "2" nunca podem ser o gatilho, porque não pedem
 * nada. Foi exatamente assim que nasceram "Responder 'ok' com clareza",
 * "Dizer 'ok' e seguir instruções" e um plano depois de "Verdade".
 *
 * ⚠️ E A REGRA NÃO É "MENSAGEM CURTA". "Aponta e leva" tem três palavras e é
 * conteúdo puro — a bancada dos 195 planos reais provou que barrar por tamanho
 * mata o legítimo. O que se barra é a FORMA de confirmar.
 */
const CONFIRMACAO_PURA =
  /^\s*(ok(ay)?|sim|nao|não|isso|certo|exato|verdade|tudo|ambos|blz|beleza|uhum|aham|s|n|👍|✅|[1-9](\s*(e|,)\s*[1-9])*)\s*[.!]?\s*$/i;

/** A última fala da família é só um aceite/escolha, sem conteúdo próprio? */
export function ultimaFalaEhConfirmacao(texto: string): boolean {
  return CONFIRMACAO_PURA.test((texto ?? "").trim());
}

/** "Jackson tem 9 anos", "Lucas, 5 anos" — cadastro, nunca desafio. */
const TEMA_SO_IDENTIDADE = /^[\p{L}\s]{2,30}?(tem|,)\s*\d{1,2}\s*(anos?|meses)\.?$/iu;

/** Quantas falas da FAMÍLIA trazem conteúdo, e não só aceite ou número. */
export function inboundsComSubstancia(
  linhas: ReadonlyArray<{ direcao: string; texto: string | null }>,
): number {
  return linhas.filter(
    (m) =>
      m.direcao === "inbound" &&
      (m.texto ?? "").trim().split(/\s+/).filter(Boolean).length >= PALAVRAS_MIN_SUBSTANCIA,
  ).length;
}

/**
 * O tema ecoa a última fala curta da família?
 *
 * ⚠️ NÃO É COMPARAÇÃO DE TEXTO INTEIRO. "Responder 'ok' com clareza" não contém
 * "ok" como substring isolada — contém a PALAVRA. Por isso a checagem é por
 * token, e só quando a fala é curta: numa fala longa, repetir uma palavra dela
 * é justamente a personalização que queremos.
 */
export function temaEcoaFalaCurta(tema: string, ultimaFalaFamilia: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  const fala = norm(ultimaFalaFamilia);
  if (fala.length === 0 || fala.length >= PALAVRAS_MIN_SUBSTANCIA) return false;
  const doTema = new Set(norm(tema));
  return fala.some((p) => doTema.has(p));
}

/**
 * Lê as últimas trocas e decide. Chamada leve (Haiku) — roda só quando a ponte
 * já passou pelos freios baratos (cooldown, dedup de 20h, profundidade).
 * Qualquer falha → NÃO entrega: na dúvida, a conversa segue (o silêncio é
 * recuperável; um plano genérico entregue não é).
 */
export async function avaliarProntidaoParaPlano(
  supabase: SupabaseClient,
  params: { familyId: string; mensagemAtual: string },
): Promise<Prontidao> {
  try {
    const { data } = await supabase
      .from("ayla_messages")
      .select("direcao, texto, created_at")
      .eq("family_account_id", params.familyId)
      .order("created_at", { ascending: false })
      .limit(14);

    const linhas = ((data ?? []) as Array<{ direcao: string; texto: string | null }>)
      .reverse()
      .map((m) => {
        const t = m.texto?.trim();
        if (!t) return null;
        return `${m.direcao === "inbound" ? "Mãe" : "Ayla"}: ${t.slice(0, 400)}`;
      })
      .filter((l): l is string => Boolean(l));

    if (linhas.length < 3) return NAO("conversa curta demais");

    // ⚠️ A EVIDÊNCIA TEM QUE SER DA FAMÍLIA. Ver o comentário do gate acima:
    // seis proativas da própria Ayla não são conversa.
    const brutas = (data ?? []) as Array<{ direcao: string; texto: string | null }>;
    if (inboundsComSubstancia(brutas) < MIN_INBOUNDS_COM_SUBSTANCIA) {
      return NAO("sem material da família — só falas da Ayla e respostas curtas");
    }

    // ⚠️ E O TURNO QUE DISPARA NÃO PODE SER UMA CONFIRMAÇÃO. Ver acima: a
    // oferta aceita entra por `forcar`; aqui é só o automático.
    const ultimoInbound = brutas.find((m) => m.direcao === "inbound")?.texto ?? "";
    if (ultimaFalaEhConfirmacao(ultimoInbound)) {
      return NAO("último turno da família é confirmação, não pedido");
    }

    const system = `Você avalia se uma conversa entre uma mãe e a assistente Ayla já tem material suficiente pra montar um plano estratégico personalizado pra a criança.

${CRITERIO_SUFICIENCIA}

Responda APENAS JSON: {"pronto":true|false,"tema":"...","motivo":"..."}
- tema: o desafio específico, em 3 a 8 palavras, nas palavras da própria conversa (ex.: "parar atividade antes de terminar"). null se não estiver pronto.
- motivo: no máximo 12 palavras.
Seja CRITERIOSO: na dúvida, responda false. É melhor conversar mais uma vez do que entregar um plano genérico.`;

    const client = getAnthropicClient();
    const final = await client.messages.create({
      model: MODELS.leve,
      max_tokens: 200,
      system: [{ type: "text", text: system }],
      messages: [
        {
          role: "user",
          content: `<conversa>\n${linhas.join("\n")}\n</conversa>\n\n<mensagem_de_agora>\n${params.mensagemAtual.slice(0, 800)}\n</mensagem_de_agora>\n\nSó o JSON.`,
        },
      ],
    });

    const raw = (final.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return NAO("resposta ilegível do classificador");
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const pronto = o.pronto === true;
    const tema = typeof o.tema === "string" && o.tema.trim() ? o.tema.trim() : null;
    const motivo = typeof o.motivo === "string" ? o.motivo.slice(0, 120) : "";
    // Sem tema não há plano focado — e plano sem foco é o genérico que a
    // Karina não quer.
    if (pronto && !tema) return NAO("pronto sem tema definido");

    // ⚠️ E O TEMA NÃO PODE SER A PALAVRA QUE ELA ACABOU DE DIZER. É o que
    // produziu "Responder 'ok' com clareza" e "Dizer 'ok' e seguir instruções":
    // o modelo cumpriu a instrução de usar "as palavras da própria conversa"
    // quando a única palavra disponível era um aceite.
    const ultimaFamilia = [...brutas].find((m) => m.direcao === "inbound")?.texto ?? "";
    if (pronto && tema && temaEcoaFalaCurta(tema, ultimaFamilia)) {
      return NAO("tema ecoaria a resposta curta da família");
    }
    // ⚠️ E IDENTIDADE NÃO É DESAFIO. Existe em produção um plano chamado
    // **"Jackson tem 9 anos"**: o turno em que a família informa quem é a
    // criança virou tema de plano estratégico. O `CRITERIO_SUFICIENCIA` já pede
    // "um desafio concreto e nomeável"; esta é a forma que nunca pode ser um.
    if (pronto && tema && TEMA_SO_IDENTIDADE.test(tema)) {
      return NAO("tema é identidade da criança, não desafio");
    }
    return { pronto, tema, motivo };
  } catch (e) {
    return NAO(`falha: ${e instanceof Error ? e.message : "erro"}`);
  }
}
