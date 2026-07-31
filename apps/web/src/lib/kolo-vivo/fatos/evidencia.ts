import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * EVIDÊNCIA ORIGINAL — de onde o fato veio, e como voltar lá.
 *
 * Sem isto, reprocessar é impossível: o fato guarda a interpretação e perde a
 * matéria-prima. Era o bloqueador nº 1 da coleta.
 *
 * QUATRO IDENTIDADES DIFERENTES, que se confundem com facilidade:
 *
 *   `source_content_id`  — a EVIDÊNCIA. O conteúdo original que o extrator leu.
 *                          Estável entre reprocessamentos: reler a mesma
 *                          conversa amanhã produz o mesmo valor.
 *   `extraction_run_id`  — a EXECUÇÃO. Muda a cada passada do extrator, e é
 *                          compartilhada por todos os fatos daquela passada.
 *   `source_message_id`  — a MENSAGEM, quando o canal tem uma. Nem todo canal
 *                          tem: o diário não tem, e inventar um seria mentir.
 *   `idempotency_key`    — o FATO. Distingue reprocessamento técnico de
 *                          repetição legítima da família.
 *
 * A UNIDADE DE EVIDÊNCIA varia por canal, e fingir que é sempre "uma mensagem"
 * seria falso — o extrator da web recebe a conversa inteira, e o WhatsApp
 * agrupa a rajada num turno só. Cada tipo abaixo declara qual é a sua.
 */

/** Tipos de evidência. O prefixo diz de onde veio e como resolver. */
export type TipoEvidencia =
  /** A conversa da web, inteira. É o que o extrator automático lê. */
  | "web_conversation"
  /** Uma entrada do diário. Vários fatos podem sair da mesma. */
  | "diario_entry"
  /**
   * O LOTE que o extrator leu — o conjunto ordenado de mensagens da rajada.
   * É a unidade correta do WhatsApp e a que deve ser usada daqui em diante.
   */
  | "extracao_lote"
  /**
   * LEGADO. Uma mensagem só, escolhida entre as da rajada. Descrevia mal o
   * insumo: reconstruir o caso recuperava um terço da entrada. Continua sendo
   * resolvido porque é o que sobra quando o registro do lote falha, e porque
   * evidência antiga tem de continuar legível — mas não se escreve mais.
   */
  | "whatsapp_turn";

/**
 * Monta o identificador. Determinístico, sem dado pessoal no valor — só
 * identificadores técnicos — e legível o suficiente para auditoria.
 *
 * NÃO é hash do texto, de propósito: o mesmo texto pode existir em registros
 * diferentes, e um registro pode ser editado. Hash identificaria o conteúdo,
 * não a evidência.
 */
export function idDeEvidencia(tipo: TipoEvidencia, id: string): string {
  return `${tipo}:${id}`;
}

/** Quebra o identificador de volta em tipo e id. */
export function lerIdDeEvidencia(
  sourceContentId: string | null | undefined,
): { tipo: TipoEvidencia; id: string } | null {
  const bruto = (sourceContentId ?? "").trim();
  const i = bruto.indexOf(":");
  if (i <= 0) return null;
  const tipo = bruto.slice(0, i) as TipoEvidencia;
  const id = bruto.slice(i + 1);
  if (!id) return null;
  if (!["web_conversation", "diario_entry", "extracao_lote", "whatsapp_turn"].includes(tipo)) {
    return null;
  }
  return { tipo, id };
}

export type SituacaoOrigem = "existente" | "apagada" | "inacessivel" | "desconhecida";

export type EvidenciaOriginal = {
  tipo: TipoEvidencia;
  id: string;
  situacao: SituacaoOrigem;
  /** Onde o conteúdo vive. Referência, não cópia. */
  tabela: string;
  criadaEm: string | null;
  familyId: string | null;
  membroId: string | null;
  /** Como recuperar o texto. Não é o texto — é o caminho até ele. */
  comoRecuperar: string;
};

/** Onde cada tipo de evidência vive, e qual é a sua unidade. */
const ORIGENS: Record<
  TipoEvidencia,
  { tabela: string; unidade: string; colunaData: string; comoRecuperar: string }
> = {
  web_conversation: {
    tabela: "conversas",
    unidade: "a conversa inteira — o extrator automático lê o transcript, não uma mensagem",
    colunaData: "created_at",
    comoRecuperar: "select conteudo from mensagens_skill where conversa_id = <id> order by created_at",
  },
  diario_entry: {
    tabela: "diarios",
    unidade: "uma entrada do diário; vários fatos podem sair dela",
    colunaData: "created_at",
    comoRecuperar: "select conquista, desafio, observacao_livre from diarios where id = <id>",
  },
  extracao_lote: {
    tabela: "extracao_lotes",
    unidade:
      "o LOTE — o conjunto ordenado de mensagens efetivamente entregue ao extrator (ver memoria-viva/lote.ts)",
    colunaData: "criado_em",
    comoRecuperar:
      "reconstruirTextoDoLote(<id>) — refaz o texto pelas mensagens do lote e confere o texto_hash",
  },
  whatsapp_turn: {
    tabela: "ayla_messages",
    unidade:
      "um TURNO — pode agrupar várias mensagens da rajada (ver lote-inbound); o id é o da mensagem que levou o turno",
    colunaData: "created_at",
    comoRecuperar: "select texto from ayla_messages where zaap_message_id = <id>",
  },
};

/** O que cada tipo de evidência representa. Para documentação e auditoria. */
export function unidadeDeEvidencia(tipo: TipoEvidencia): string {
  return ORIGENS[tipo].unidade;
}

/**
 * Encontra a matéria-prima de um fato.
 *
 * Não devolve o conteúdo: devolve o caminho até ele, mais a situação da origem.
 * Ausência NUNCA é silenciosa — origem que sumiu volta como `apagada`, e o
 * chamador decide. Um fato cuja origem não existe mais é irreprocessável, e
 * isso precisa ser visível, não descoberto na hora de reprocessar.
 */
export async function resolverEvidenciaOriginal(
  supabase: SupabaseClient,
  sourceContentId: string | null | undefined,
): Promise<EvidenciaOriginal | null> {
  const ref = lerIdDeEvidencia(sourceContentId);
  if (!ref) return null;

  const origem = ORIGENS[ref.tipo];
  const base: EvidenciaOriginal = {
    tipo: ref.tipo,
    id: ref.id,
    situacao: "desconhecida",
    tabela: origem.tabela,
    criadaEm: null,
    familyId: null,
    membroId: null,
    comoRecuperar: origem.comoRecuperar.replace("<id>", ref.id),
  };

  try {
    // O legado `whatsapp_turn` guarda o id do PROVEDOR; os demais guardam o id
    // interno da própria linha.
    const coluna = ref.tipo === "whatsapp_turn" ? "zaap_message_id" : "id";
    // `select("*")` e nao uma lista montada: o tipo do supabase-js analisa a
    // string de colunas em tempo de compilacao e nao aceita interpolacao.
    const { data, error } = await supabase
      .from(origem.tabela)
      .select("*")
      .eq(coluna, ref.id)
      .maybeSingle();

    if (error) return { ...base, situacao: "inacessivel" };
    if (!data) return { ...base, situacao: "apagada" };

    const linha = data as unknown as Record<string, unknown>;
    return {
      ...base,
      situacao: "existente",
      criadaEm: (linha[origem.colunaData] as string | null) ?? null,
      familyId: (linha.family_account_id as string | null) ?? null,
      membroId: (linha.membro_atipico_id as string | null) ?? null,
    };
  } catch {
    return { ...base, situacao: "inacessivel" };
  }
}
