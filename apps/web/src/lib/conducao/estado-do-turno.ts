/**
 * O ESTADO DO TURNO — o que o código sabe e o modelo não conseguia ver.
 *
 * ⚠️ O PROBLEMA QUE ISTO RESOLVE, em uma frase: a memória do produto era de dez
 * linhas de prosa.
 *
 * A auditoria de 06/09/2026 mostrou que `messages` leva só a mensagem atual e o
 * histórico entra como `<conversa_recente>` — dez linhas de "Ayla: … /
 * Responsável: …". Tudo o mais que a Kolo sabe (o plano em acompanhamento e o
 * resultado dele, a oferta que ficou de pé, a rotina esperando um tema) está no
 * banco e NUNCA chegava ao modelo.
 *
 * O caso que dói: Karina, 06/09/2026. Às 15:01 a Ayla prometeu uma rotina que
 * ficou em `aguardando`. Às 17:14 ela cobrou — "E agora?", "Consegue trazer?" —
 * e a resposta foi "Sobre quem você está falando? Mario ou Manu?". O modelo não
 * errou: ele não tinha como saber que havia um quadro devendo. O dado existia
 * na tabela `rotinas` e não existia no prompt.
 *
 * ⚠️ ESTE MÓDULO NÃO DECIDE NADA. Ele não classifica intenção, não escolhe
 * tema, não seleciona conhecimento e não escreve fala. Ele apura fatos e os
 * entrega legíveis, para que quem decide — o GPT — decida com o que a Kolo
 * realmente sabe. É a inversão que a Fase 1 persegue: o código prepara, o
 * modelo interpreta.
 *
 * ⚠️ E ELE NÃO INVENTA ESTADO. Onde a Kolo não tem estrutura para saber, o
 * campo diz `nao_rastreado` — não `nenhum`. A diferença é material: "não há
 * correção" convida o modelo a seguir em frente; "não sei se houve" convida a
 * ler o histórico com cuidado. Confundir desconhecido com inexistente é como se
 * fabrica confiança falsa.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { perguntaAberta, type OpcaoDaPergunta } from "./continuidade";

/**
 * Um fato que a Kolo pode ou não saber.
 *
 * ⚠️ TRÊS ESTADOS, NÃO DOIS. `sabido` traz o valor; `nenhum` afirma a ausência
 * (perguntamos e não há); `nao_rastreado` admite que o produto não guarda essa
 * informação. Um campo binário forçaria `nao_rastreado` a virar `nenhum`, e aí
 * a Ayla passaria a agir como se soubesse que não houve — que é exatamente a
 * confiança falsa que este módulo existe para não produzir.
 */
export type Fato<T> =
  | { conhecido: "sim"; valor: T }
  | { conhecido: "nenhum" }
  | { conhecido: "nao_rastreado" };

export type EstadoDoTurno = {
  sujeito: Fato<{ id: string; nome: string }>;
  perguntaPendente: Fato<{ pergunta: string; opcoes: OpcaoDaPergunta[] }>;
  ofertaPendente: Fato<string>;
  jaOrientouNestaConversa: boolean;
  estrategiaEmAcompanhamento: Fato<{ tema: string; desdeDias: number; perguntamos: boolean }>;
  resultadoConhecido: Fato<{ resultado: string; nota: number | null }>;
  artefatoPendente: Fato<{ tipo: "rotina"; id: string; nome: string; falta: "tema" | "geracao" }>;
  perguntasRecentes: string[];
  correcoesDaFamilia: Fato<never>;
};

/** Uma fala do histórico, no formato que o chamador já tem em mãos. */
export type FalaDoHistorico = { direcao: string; texto: string | null };

/**
 * ⚠️ 200 CARACTERES SEPARAM ORIENTAÇÃO DE CONVERSA, e o número não é palpite:
 * veio da medição registrada em `experimental.ts` — a mediana das respostas do
 * caminho oficial é 666, e as falas curtas da amostra (despedidas, "imagina",
 * confirmações) ficam abaixo de 200. Reaproveitado aqui de propósito: duas
 * réguas para a mesma pergunta divergiriam.
 */
const MIN_CHARS_ORIENTACAO = 200;

/**
 * Apura o estado do turno a partir do que a Kolo já persistiu.
 *
 * ⚠️ TODAS AS LEITURAS FALHAM ABERTO. Um estado que não pôde ser lido vira
 * `nao_rastreado`, nunca `nenhum`, e nunca derruba o turno: a família que
 * escreveu tem que receber resposta mesmo quando uma consulta cai. O custo de
 * falhar aberto aqui é uma Ayla com menos memória num turno; o custo de falhar
 * fechado seria silêncio.
 */
export async function apurarEstadoDoTurno(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroId: string | null;
    membroNome: string | null;
    /** Histórico já carregado pelo chamador — este módulo não recarrega nada. */
    historico: FalaDoHistorico[];
  },
): Promise<EstadoDoTurno> {
  const { familyId, membroId, membroNome, historico } = params;

  const falasDaAyla = historico.filter((f) => f.direcao !== "inbound");
  const ultimaDaAyla = falasDaAyla.at(-1)?.texto ?? null;

  // ── PERGUNTA PENDENTE ──────────────────────────────────────────────────
  // ⚠️ REUSA `perguntaAberta`, não reimplementa. Ela já sabe achar a última
  // interrogativa e as opções numeradas, e já é testada. Uma segunda extração
  // divergiria da primeira no primeiro formato de lista novo.
  const aberta = perguntaAberta(ultimaDaAyla);
  const perguntaPendente: EstadoDoTurno["perguntaPendente"] = aberta.pergunta
    ? { conhecido: "sim", valor: { pergunta: aberta.pergunta, opcoes: aberta.opcoes } }
    : { conhecido: "nenhum" };

  // ── JÁ ORIENTOU? ───────────────────────────────────────────────────────
  // Booleano de verdade: o histórico está em mãos, então isto nunca é
  // "não sei". Serve ao "ajuda antes de investigar" — se ela já ajudou, o
  // turno seguinte pode aprofundar em vez de recomeçar.
  const jaOrientouNestaConversa = falasDaAyla.some(
    (f) => (f.texto ?? "").trim().length >= MIN_CHARS_ORIENTACAO,
  );

  // ── PERGUNTAS RECENTES ─────────────────────────────────────────────────
  // ⚠️ CONTRA O INTERROGATÓRIO. É o que permite ao modelo ver que já perguntou
  // aquilo — a queixa da Vanessa era exatamente recoleta do que já tinha sido
  // respondido. Derivado do histórico em mãos; nenhuma consulta nova.
  const perguntasRecentes = falasDaAyla
    .flatMap((f) => (f.texto ?? "").split(/(?<=\?)\s+/))
    .filter((frase) => frase.includes("?"))
    .map((frase) => frase.trim().slice(0, 160))
    .filter(Boolean)
    .slice(-6);

  const sujeito: EstadoDoTurno["sujeito"] =
    membroId && membroNome
      ? { conhecido: "sim", valor: { id: membroId, nome: membroNome } }
      : { conhecido: "nenhum" };

  // ── O QUE VEM DO BANCO ─────────────────────────────────────────────────
  const [artefatoPendente, acompanhamento] = await Promise.all([
    lerArtefatoPendente(supabase, familyId),
    lerAcompanhamento(supabase, familyId, membroId),
  ]);

  return {
    sujeito,
    perguntaPendente,
    // ⚠️ OFERTA PENDENTE FICA `nao_rastreado` DE PROPÓSITO NESTA FASE. Ela
    // existe (`ofertaFimDeSemanaPendente`), mas quem a apura é o orquestrador,
    // com o inbound ainda não persistido — reconsultar aqui daria uma resposta
    // diferente da que o orquestrador usou para decidir. Duas fontes para o
    // mesmo fato divergem; então esta fase admite não saber em vez de chutar.
    ofertaPendente: { conhecido: "nao_rastreado" },
    jaOrientouNestaConversa,
    estrategiaEmAcompanhamento: acompanhamento.estrategia,
    resultadoConhecido: acompanhamento.resultado,
    artefatoPendente,
    perguntasRecentes,
    // ⚠️ A KOLO NÃO GUARDA CORREÇÕES. Não há coluna, tabela nem marcação: uma
    // correção ("não, é a Manu") vive só como texto de uma fala. Dizer `nenhum`
    // aqui afirmaria que a família não corrigiu nada — e ela pode ter corrigido
    // três vezes. Admitir a lacuna é o comportamento correto até existir
    // estrutura para preenchê-la.
    correcoesDaFamilia: { conhecido: "nao_rastreado" },
  };
}

/**
 * A rotina que ficou devendo.
 *
 * ⚠️ É O CAMPO QUE JUSTIFICA ESTA FASE. Sem ele, "E agora?" chega ao modelo sem
 * referente e ele pergunta de qual filho se trata. Com ele, o modelo vê que há
 * um quadro esperando um tema e responde sobre isso.
 *
 * ⚠️ SÓ LÊ. Este módulo não escreve, não dispara geração e não altera
 * `cards_status` — o reconciliador é dono disso e continua sendo. Aqui a rotina
 * só fica VISÍVEL ao cérebro conversacional.
 */
async function lerArtefatoPendente(
  supabase: SupabaseClient,
  familyId: string,
): Promise<EstadoDoTurno["artefatoPendente"]> {
  try {
    const { data, error } = await supabase
      .from("rotinas")
      .select("id, nome, tema, cards_status")
      .eq("family_account_id", familyId)
      .eq("cards_status", "aguardando")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return { conhecido: "nao_rastreado" };
    const r = (data ?? [])[0];
    if (!r) return { conhecido: "nenhum" };
    return {
      conhecido: "sim",
      valor: {
        tipo: "rotina",
        id: r.id as string,
        nome: ((r.nome as string) ?? "").trim() || "a rotina",
        // As duas espécies de órfã, como o reconciliador já as distingue:
        // falta o dado, ou falta o ato.
        falta: (r.tema as string | null)?.trim() ? "geracao" : "tema",
      },
    };
  } catch {
    return { conhecido: "nao_rastreado" };
  }
}

/**
 * O plano em acompanhamento e o que se sabe do resultado dele.
 *
 * ⚠️ `perguntamos` É O QUE SEPARA DOIS SILÊNCIOS. `resultado` nulo pode ser
 * "mandamos o seguimento e ela não respondeu" ou "nunca perguntamos" — e a Ayla
 * se comporta diferente nos dois casos: no primeiro ela não insiste, no segundo
 * ela pode perguntar. `seguimento_enviado_em` é o que distingue, e por isso ele
 * viaja junto em vez de ficar reduzido a um booleano de "tem resultado".
 */
async function lerAcompanhamento(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string | null,
): Promise<{
  estrategia: EstadoDoTurno["estrategiaEmAcompanhamento"];
  resultado: EstadoDoTurno["resultadoConhecido"];
}> {
  try {
    let q = supabase
      .from("planos")
      .select("tema, created_at, resultado, resultado_nota, seguimento_enviado_em")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(1);
    // ⚠️ ESCOPO POR MEMBRO QUANDO HÁ MEMBRO. Numa família com irmãos, mostrar o
    // plano do outro filho como "estratégia em acompanhamento" é vazamento de
    // contexto entre irmãos — a regra de `membro-escopo.ts`, aplicada aqui.
    if (membroId) q = q.eq("membro_atipico_id", membroId);
    const { data, error } = await q;
    if (error) {
      return { estrategia: { conhecido: "nao_rastreado" }, resultado: { conhecido: "nao_rastreado" } };
    }
    const p = (data ?? [])[0];
    if (!p) {
      return { estrategia: { conhecido: "nenhum" }, resultado: { conhecido: "nenhum" } };
    }
    const tema = ((p.tema as string) ?? "").trim();
    const desdeDias = Math.max(
      0,
      Math.floor((Date.now() - new Date(p.created_at as string).getTime()) / 86_400_000),
    );
    const perguntamos = !!p.seguimento_enviado_em;
    const res = ((p.resultado as string | null) ?? "").trim();
    return {
      estrategia: tema
        ? { conhecido: "sim", valor: { tema, desdeDias, perguntamos } }
        : { conhecido: "nenhum" },
      resultado: res
        ? { conhecido: "sim", valor: { resultado: res, nota: (p.resultado_nota as number | null) ?? null } }
        : // Perguntamos e ela não respondeu = ausência de verdade.
          // Nunca perguntamos = a Kolo não sabe, e não deve fingir que sabe.
          perguntamos
          ? { conhecido: "nenhum" }
          : { conhecido: "nao_rastreado" },
    };
  } catch {
    return { estrategia: { conhecido: "nao_rastreado" }, resultado: { conhecido: "nao_rastreado" } };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A RENDERIZAÇÃO — o estado vira texto legível para o modelo.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ FORMATO EXPLÍCITO, NÃO PROSA. A auditoria mostrou que o histórico chega
 * como "Ayla: … / Responsável: 3", e ligar o "3" à lista certa em prosa é
 * justamente o que falhou com a Lucila, a Vanessa e a Samara. Aqui cada fato
 * tem rótulo e valor, e `não rastreado` aparece escrito por extenso — porque a
 * ausência de uma linha seria lida como ausência do fato.
 */
export function blocoDeEstado(e: EstadoDoTurno): string {
  const linhas: string[] = [];
  const diz = (rotulo: string, f: Fato<unknown>, formatar: (v: never) => string) => {
    if (f.conhecido === "sim") linhas.push(`${rotulo}: ${formatar(f.valor as never)}`);
    else if (f.conhecido === "nenhum") linhas.push(`${rotulo}: nenhum`);
    else linhas.push(`${rotulo}: não rastreado (a Kolo não guarda isto — não conclua nada)`);
  };

  diz("sujeito", e.sujeito, (v: { nome: string }) => v.nome);
  diz("pergunta_pendente", e.perguntaPendente, (v: { pergunta: string; opcoes: OpcaoDaPergunta[] }) =>
    v.opcoes.length
      ? `${v.pergunta} — opções: ${v.opcoes.map((o) => `${o.numero}) ${o.texto}`).join("; ")}`
      : v.pergunta,
  );
  diz("oferta_pendente", e.ofertaPendente, (v: string) => v);
  linhas.push(`ja_orientou_nesta_conversa: ${e.jaOrientouNestaConversa ? "sim" : "não"}`);
  diz(
    "estrategia_em_acompanhamento",
    e.estrategiaEmAcompanhamento,
    (v: { tema: string; desdeDias: number; perguntamos: boolean }) =>
      `${v.tema} (há ${v.desdeDias} dia(s); seguimento ${v.perguntamos ? "já enviado" : "ainda não enviado"})`,
  );
  diz("resultado_da_estrategia", e.resultadoConhecido, (v: { resultado: string; nota: number | null }) =>
    v.nota != null ? `${v.resultado} (nota ${v.nota})` : v.resultado,
  );
  // ⚠️ A LINHA MAIS IMPORTANTE DO BLOCO. É ela que faz "E agora?" ter
  // referente. O texto diz o que FALTA, porque é sobre isso que a conversa
  // precisa ser — e diz explicitamente para não afirmar que está pronto, que é
  // a falha que o portão 3 da Rotina Visual barra do outro lado.
  diz(
    "artefato_pendente",
    e.artefatoPendente,
    (v: { tipo: string; nome: string; falta: string }) =>
      v.falta === "tema"
        ? `${v.tipo} "${v.nome}" está esperando o TEMA dos cartões — ela não está pronta, não diga que está`
        : `${v.tipo} "${v.nome}" tem tema e ainda não foi gerada — não diga que está pronta`,
  );
  if (e.perguntasRecentes.length) {
    linhas.push(
      `ja_perguntei_recentemente: ${e.perguntasRecentes.map((p) => `"${p}"`).join(" | ")}`,
    );
  }
  diz("correcoes_da_familia", e.correcoesDaFamilia, () => "");

  return `<estado>\n${linhas.join("\n")}\n</estado>`;
}
