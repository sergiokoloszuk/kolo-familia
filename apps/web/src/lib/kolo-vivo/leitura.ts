import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MEMBRO_CAMPOS_TODOS,
  MEMBRO_CAMPO_LABEL,
  membroCampoStorage,
} from "./campos";

/**
 * LEITURA do Kolo Vivo — fonte ÚNICA pros dois canais.
 *
 * Por que este módulo existe (auditoria de 30/07/2026): cada canal tinha a sua
 * própria lista de domínios, escrita à mão, e as duas estavam erradas de formas
 * diferentes.
 *
 * - WhatsApp (`carregarKoloVivoResumo`): lista hardcoded de 5 top-level + 9
 *   extras = 14 de 20. Ficavam INVISÍVEIS `aprendizado`, `escola`,
 *   `saude_geral`, `imitacao`, `tela_midia` e `gostos`. Pior: a função de
 *   LACUNAS varria os 20 e dizia no prompt "JÁ TEM no perfil: Aprendizado,
 *   Escola…", com a instrução de não re-perguntar. A Ayla era informada de que
 *   sabia o que não podia ver — e por isso nem sabia nem perguntava.
 * - Web (`buildContext`): lia 19 de 20 (faltava `gostos`) e ainda filtrava pelos
 *   `kolo_vivo_fields` das skills roteadas — o perfil visível MUDAVA conforme o
 *   sorteio do roteador.
 *
 * Agora existe um leitor só, sobre `MEMBRO_CAMPOS_TODOS`. Domínio novo entra em
 * `campos.ts` e os dois canais passam a ver junto — que é o ponto.
 *
 * Aqui também moram as duas leituras que existiam no banco e NÃO chegavam a
 * conversa nenhuma: a linha do tempo (`eventos_membro`, o único lugar com DATA)
 * e as estratégias já tentadas com resultado (`preferencias.experimentos`).
 */

/** As colunas de `perfil_vivo_membro` que compõem o perfil inteiro. */
export const PERFIL_MEMBRO_SELECT =
  "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras";

/** Texto de cada domínio, por chave de campo. Só entra o que tem conteúdo. */
export type SecoesMembro = Record<string, string>;

/**
 * Extrai o texto legível de um campo jsonb. Os campos guardam formas
 * diferentes: `{ texto }` (livre), `{ interesses: [] }` e
 * `{ desafios_iniciais: [] }` (onboarding), `{ conquista_inicial }`
 * (essencial). Ler só `.texto` era o motivo de a Ayla "não saber" interesses e
 * desafios vindos do cadastro.
 */
export function textoDoCampo(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const o = json as Record<string, unknown>;
  const partes: string[] = [];
  if (typeof o.texto === "string" && o.texto.trim()) partes.push(o.texto.trim());
  for (const k of ["interesses", "desafios_iniciais"]) {
    const v = o[k];
    if (Array.isArray(v)) {
      const itens = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      if (itens.length) partes.push(itens.join(", "));
    }
  }
  if (typeof o.conquista_inicial === "string" && o.conquista_inicial.trim()) {
    partes.push(o.conquista_inicial.trim());
  }
  return partes.join(" · ");
}

/** Todas as seções COM conteúdo de uma linha de `perfil_vivo_membro`. */
export function lerSecoesMembro(row: Record<string, unknown> | null | undefined): SecoesMembro {
  const out: SecoesMembro = {};
  if (!row) return out;
  const extras = (row.categorias_extras as Record<string, unknown> | null) ?? {};
  for (const campo of MEMBRO_CAMPOS_TODOS) {
    const bruto = membroCampoStorage(campo) === "toplevel" ? row[campo] : extras[campo];
    const texto = textoDoCampo(bruto);
    if (texto) out[campo] = texto;
  }
  return out;
}

/** Busca + lê o perfil inteiro de um membro. Falha → objeto vazio. */
export async function carregarSecoesMembro(
  supabase: SupabaseClient,
  membroId: string | null,
): Promise<SecoesMembro> {
  if (!membroId) return {};
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select(PERFIL_MEMBRO_SELECT)
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    return lerSecoesMembro(data as Record<string, unknown> | null);
  } catch {
    return {};
  }
}

/** "O essencial: …\nAlimentação: …" — o bloco que vai pro prompt. */
export function resumoRotulado(secoes: SecoesMembro): string {
  return MEMBRO_CAMPOS_TODOS.map((campo) => {
    const texto = secoes[campo];
    if (!texto) return null;
    return `${MEMBRO_CAMPO_LABEL[campo] ?? campo}: ${texto}`;
  })
    .filter((l): l is string => l !== null)
    .join("\n");
}

// ============================================================
// Linha do tempo — a única memória DATADA que temos
// ============================================================

export type EventoLinhaDoTempo = {
  data: string;
  tipo: string;
  descricao: string;
};

/** Quanto tempo pra trás a conversa considera. Além disso é história, não agora. */
const EVENTOS_JANELA_DIAS = 120;
const EVENTOS_LIMITE = 12;

/**
 * Eventos datados do membro (troca de professora, férias, medicação, marco,
 * regressão…). Até 30/07 esta tabela era ESCRITA pela Ayla e lida só pelo
 * relatório: o sistema sabia que as férias foram em janeiro e não conseguia
 * usar isso na conversa. É a base pra "isso já passou".
 */
export async function carregarEventosRecentes(
  supabase: SupabaseClient,
  membroId: string | null,
): Promise<EventoLinhaDoTempo[]> {
  if (!membroId) return [];
  try {
    const desde = new Date(Date.now() - EVENTOS_JANELA_DIAS * 24 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const { data } = await supabase
      .from("eventos_membro")
      .select("data, tipo, descricao")
      .eq("membro_atipico_id", membroId)
      .gte("data", desde)
      .order("data", { ascending: false })
      .limit(EVENTOS_LIMITE);
    return ((data ?? []) as Array<{ data: string; tipo: string; descricao: string | null }>)
      .filter((e) => e.descricao?.trim())
      .map((e) => ({ data: e.data, tipo: e.tipo, descricao: e.descricao!.trim() }));
  } catch {
    return [];
  }
}

/** Bloco pro prompt, com a data VISÍVEL e o aviso de que é passado. */
export function blocoEventos(eventos: EventoLinhaDoTempo[]): string {
  if (eventos.length === 0) return "";
  const linhas = eventos.map((e) => `- ${e.data} (${e.tipo}): ${e.descricao}`).join("\n");
  return `${linhas}\n\nEstes são fatos DATADOS do passado. Um evento com data já ACONTECEU — férias que começaram em janeiro provavelmente terminaram, uma troca de professora já foi feita. Use pra entender a história e o que pode ter mudado desde então; NUNCA trate um evento antigo como se estivesse acontecendo agora, e não puxe o assunto se ninguém trouxe.`;
}

// ============================================================
// Estratégias já tentadas — e como foram
// ============================================================

export type Experimento = {
  item: string;
  resultado: string;
  data: string | null;
};

const EXPERIMENTOS_LIMITE = 15;

/**
 * O que a família já experimentou e como foi (`categorias_extras.preferencias.
 * experimentos`, gravado com data e resultado pela Ayla). Também era write-only
 * pra conversa — só o cron semanal de repertório lia. Por isso a Ayla recomendava
 * o que já tinha sido tentado e não funcionou.
 */
export async function carregarExperimentos(
  supabase: SupabaseClient,
  membroId: string | null,
): Promise<Experimento[]> {
  if (!membroId) return [];
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const extras = (data?.categorias_extras as Record<string, unknown> | null) ?? {};
    const pref = (extras.preferencias as Record<string, unknown> | null) ?? {};
    const lista = Array.isArray(pref.experimentos) ? pref.experimentos : [];
    return lista
      .map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        const item = typeof o.item === "string" ? o.item.trim() : "";
        if (!item) return null;
        return {
          item,
          resultado: typeof o.resultado === "string" ? o.resultado : "neutro",
          data: typeof o.data === "string" ? o.data : null,
        };
      })
      .filter((e): e is Experimento => e !== null)
      .slice(-EXPERIMENTOS_LIMITE);
  } catch {
    return [];
  }
}

const RESULTADO_LABEL: Record<string, string> = {
  amou: "amou",
  gostou: "gostou",
  neutro: "não deu pra saber",
  nao_gostou: "NÃO funcionou",
};

/** Bloco pro prompt: o que não repetir e o que já deu certo. */
export function blocoExperimentos(exps: Experimento[]): string {
  if (exps.length === 0) return "";
  const linhas = exps
    .map((e) => `- ${e.item} → ${RESULTADO_LABEL[e.resultado] ?? e.resultado}${e.data ? ` (${e.data})` : ""}`)
    .join("\n");
  return `${linhas}\n\nUse isto ANTES de sugerir: não proponha de novo o que está marcado como NÃO funcionou (a família já gastou energia nisso e vai sentir que você não lembra); e quando algo funcionou, PARTA DALI pra o próximo passo em vez de começar de zero.`;
}
