import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/log";
import { biaHabilitadaNoPrompt } from "./flag";
import { buscarConhecimentosBIA } from "./retriever";
import { montarBlocoBia, tokensAprox } from "./bloco";
import { detectarConflitos } from "./conflitos";
import { ehDesabafoPuro } from "./desabafo";
import { contextoTemSinalDeRisco, type ContextoBia } from "./pontuacao";

/**
 * PONTO DE ENTRADA ÚNICO DA BIA PARA OS DOIS CANAIS.
 *
 * WhatsApp (`lib/ayla/orchestrator.ts`) e Web (`lib/ia/engine.ts`) chamam ESTA
 * função e mais nenhuma. É o que garante — estruturalmente, não por disciplina —
 * que os dois canais usem o mesmo serviço de recuperação, as mesmas cotas, o
 * mesmo orçamento e as mesmas instruções. Foi exatamente a falta disso que
 * produziu o drift entre canais que a Fase 1 teve de consertar (cada canal com
 * a sua lista de domínios do perfil, escrita à mão, as duas erradas).
 *
 * FRONTEIRA (não se atravessa):
 *   Core (diretrizes.ts) → identidade, condução, tom, limites
 *   prontidao-plano.ts   → decide o próximo movimento
 *   BIA (aqui)           → recupera CONHECIMENTO, contexto complementar
 *   boas-praticas.ts     → sugestões práticas curadas
 *   prompt builder       → organiza os blocos
 *
 * A BIA não decide nada. Não pergunta nada. Não muda tom. Se falhar, some.
 */

/**
 * Palavra → domínio do Kolo Vivo. Heurística determinística, sem IA.
 *
 * Serve para dar ao retriever o filtro ESTRUTURADO (o sinal mais forte) a partir
 * de uma conversa livre, quando quem chama não tem um domínio explícito — que é
 * o caso do WhatsApp. Sem isto sobraria só a busca textual, e a recuperação
 * ficaria bem pior nos dois canais.
 *
 * Conservadora de propósito: na dúvida devolve `null` (nenhum domínio), e o
 * retriever cai só no textual. Errar o domínio é pior do que não ter domínio.
 */
const PISTAS_DOMINIO: ReadonlyArray<[string, RegExp]> = [
  ["sono", /\b(dormir|sono|soneca|madrugada|acorda|adormec|cochil|insonia|ins[oô]nia)/i],
  // "come" precisa casar tanto quanto "comer" — a mãe escreve "só come arroz".
  // O fim de palavra é um lookahead explícito, e NÃO `\b`: `\b` considera "ç"
  // um separador, então "começa a chorar" casava com "come" e mandava uma crise
  // de transição para o núcleo de alimentação. Acentuados contam como letra.
  [
    "nutricional",
    /\b(com(?:e|er|eu|em|endo|ia)(?![\wÀ-ſ])|comida|refei[çc][ãa]o|alimenta|almo[çc]|jantar|seletiv|crocante|mastig|engasg)/i,
  ],
  [
    "comunicacao",
    // "não olha na minha cara" é relato de contato visual e é conteúdo de
    // comunicação — sem esta pista a consulta ficava sem domínio e caía só no
    // textual, justamente no tema em que a BIA discorda de uma Boa Prática.
    /\b(fala|falar|palavra|comunica|ecolalia|apontar|gesto|linguagem|contato visual|n[ãa]o (me )?olha|olha (na|no|pra|para))/i,
  ],
  [
    "socializacao",
    // "sozinh" sozinho não serve: "me sinto sozinha" é a solidão da MÃE, e
    // mandava um desabafo para o conhecimento de socialização da criança. Só
    // conta quando vem colado a um verbo de quem está sozinho.
    /\b(amig|social|brincar com outr|coleg|isolad|festa|parqu|(brinca|fica|anda|almo[çc]a|senta|passa o dia)\w*\s+sozinh)/i,
  ],
  ["sensorial", /\b(sensorial|barulho|som alto|textura|toque|luz|etiqueta|roupa aperta|sobrecarga)/i],
  ["motor", /\b(motor|coordena|equil[íi]brio|desajeit|cai muito|segurar o l[áa]pis|escrever|amarrar)/i],
  ["autonomia", /\b(sozinh[oa] (o|a)?\s*(banho|vestir)|autonomia|vestir|banho|escovar os dentes|banheiro|desfralde)/i],
  ["aprendizado", /\b(aprend|escola|professor|licao|li[çc][ãa]o|tarefa|alfabetiz|ler|leitura|matem[áa]tica)/i],
  ["foco", /\b(foco|aten[çc][ãa]o|concentra|distra|impulsiv|agita)/i],
  ["emocional", /\b(crise|birra|explod|chora|raiva|frustra|regula[çc][ãa]o|desregul|ansiedad|medo)/i],
  ["rotina", /\b(rotina|transi[çc][ãa]o|previsibilidade|hor[áa]rio|mudan[çc]a de|sair de casa)/i],
  ["imitacao", /\b(imit|copia|faz igual|faz de conta|espelh)/i],
];

export function inferirDominio(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  for (const [dominio, re] of PISTAS_DOMINIO) {
    if (re.test(t)) return dominio;
  }
  return null;
}

export type CanalBia = "whatsapp" | "web";

export type ParamsBlocoBia = {
  supabase: SupabaseClient;
  canal: CanalBia;
  familyId: string;
  /** O contexto estruturado. `dominio` ausente → inferido do texto. */
  contexto: ContextoBia;
  /** Textos das Boas Práticas deste turno — só para detectar conflito. */
  textosBoasPraticas?: string[];
};

/**
 * Devolve o bloco pronto para o prompt, ou string vazia.
 *
 * NUNCA lança e nunca demora a ponto de travar o turno: qualquer erro vira ""
 * e a Ayla responde exatamente como responderia sem a BIA. É a mesma decisão de
 * `selecionarBoasPraticas` — conhecimento de apoio é bônus, e bônus não pode
 * derrubar a conversa.
 */
export async function carregarBlocoBia(params: ParamsBlocoBia): Promise<string> {
  const { supabase, canal, familyId, contexto, textosBoasPraticas = [] } = params;

  // Porta 1: a flag. Desligada → nem consulta o banco (custo zero).
  if (!biaHabilitadaNoPrompt()) return "";

  const inicio = Date.now();
  try {
    const relato = [contexto.dificuldade, contexto.textoDaConversa, contexto.objetivo]
      .filter(Boolean)
      .join(" ");
    const dominio = contexto.dominio ?? inferirDominio(relato);

    // Porta 2: desabafo puro. Acolhimento é do Core; conhecimento técnico aqui
    // empurra a Ayla a responder com conteúdo quando pediram colo. Risco e
    // problema concreto nunca caem nesta porta — ver `desabafo.ts`.
    if (
      ehDesabafoPuro({
        texto: relato,
        dominio,
        temRisco: contextoTemSinalDeRisco(contexto),
      })
    ) {
      await logEvent({
        kind: "bia_recuperacao",
        severity: "info",
        family_account_id: familyId,
        payload: {
          canal,
          consultada: false,
          motivo: "desabafo_puro",
          dominio: null,
          vazio: true,
          ms: Date.now() - inicio,
        },
      }).catch(() => {});
      return "";
    }

    const resultados = await buscarConhecimentosBIA(
      supabase,
      { ...contexto, dominio },
      // Pede um pouco mais do que cabe: as cotas precisam de candidatos de
      // tipos diferentes para escolher, senão a diversidade não acontece.
      { limite: 12, maxPorTipo: 4 },
    );

    const conflitos = detectarConflitos({
      textosBia: resultados.map((r) => r.chunk.texto_original),
      textosBoasPraticas,
    });

    const bloco = montarBlocoBia(resultados, { temConflito: conflitos.length > 0 });
    const ms = Date.now() - inicio;

    // ----- Instrumentação -----
    // Sem conteúdo da conversa e sem texto de chunk: só identificadores,
    // classificações e números. Dá para avaliar a qualidade da recuperação sem
    // expor o que a família contou.
    await logEvent({
      kind: "bia_recuperacao",
      // `warn` só quando há conflito — aí persiste em `eventos_app` para
      // auditoria. O resto fica no stdout estruturado, como o resto do produto.
      severity: conflitos.length > 0 ? "warn" : "info",
      family_account_id: familyId,
      message: conflitos.length > 0 ? "conflito BIA × Boa Prática" : undefined,
      payload: {
        canal,
        consultada: true,
        dominio,
        vazio: bloco.usados.length === 0,
        recuperados: resultados.length,
        usados: bloco.usados.length,
        nucleos: [...new Set(bloco.usados.map((r) => r.chunk.nucleo))],
        chunks: bloco.usados.map((r) => ({
          id: r.chunk.id,
          tipo: r.chunk.tipo_conhecimento,
          score: r.score,
          motivos: r.motivos.map((m) => m.codigo),
        })),
        chars: bloco.chars,
        tokens_aprox: tokensAprox(bloco.chars),
        ms,
        conflito: conflitos.length > 0,
        conflito_temas: conflitos.map((c) => c.tema),
      },
    }).catch(() => {});

    return bloco.texto;
  } catch (e) {
    // Falha da BIA nunca interrompe WhatsApp, Web ou geração de plano.
    await logEvent({
      kind: "bia_recuperacao_falhou",
      severity: "warn",
      family_account_id: familyId,
      message: e instanceof Error ? e.message.slice(0, 200) : "erro",
      payload: { canal, ms: Date.now() - inicio },
    }).catch(() => {});
    return "";
  }
}
