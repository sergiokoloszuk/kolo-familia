import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * MEMÓRIA É CONTEXTO, NÃO PAUTA — 19/11/2026.
 *
 * ⚠️ O DEFEITO QUE ISTO CORRIGE. Uma criança falou do álbum de figurinhas da
 * Copa seis meses atrás; seis meses depois a Ayla ainda propunha "mais uma
 * figurinha e depois banho". REPRODUZIDO na bancada `memoria-respostas` com o
 * caminho oficial e o Core v12: o juiz deu 2/5 e apontou o interesse velho.
 * Três portas deixavam o passado entrar como presente:
 *
 *   1. `interessesAtuais` não tem data — o perfil guarda a lista crua, e o
 *      prompt a rotulava "Interesses atuais", ao lado de uma legenda que diz
 *      "o que não tem marca é recente";
 *   2. a conversa recente eram as 12 últimas mensagens SEM janela e SEM data:
 *      a troca de 186 dias atrás chegava como se fosse de ontem;
 *   3. as proativas (repertório semanal, espontâneas) usavam a mesma lista e
 *      gravavam o texto no histórico — e a próxima resposta lia a própria
 *      Ayla reforçando o interesse velho.
 *
 * ⚠️ POR QUE ESTRUTURAL, E NÃO UMA FRASE NO CORE. A legenda "use como hipótese"
 * já existe e não segurou (protocolo §15: regra que falha no prompt se corrige
 * no que o orquestrador oferece). O interesse sem confirmação recente SAI do
 * prompt; a Ayla pode perguntar do que a criança gosta hoje, porque a lacuna
 * "interesses atuais" volta a existir.
 *
 * ⚠️ DE ONDE VEM A DATA. O perfil não carimba interesse por interesse. As
 * evidências reais disponíveis são:
 *   · a FAMÍLIA mencionou o interesse numa mensagem dos últimos 90 dias
 *     (só `inbound` — o que a Ayla disse não confirma nada, é o laço do item 3);
 *   · o perfil nasceu há menos de 90 dias (onboarding recente);
 *   · a família editou as preferências há menos de 90 dias
 *     (`categorias_extras.preferencias.atualizado_em`).
 * O `updated_at` da linha NÃO serve: qualquer campo atualiza a linha, e o
 * extrator escreve nela o tempo todo.
 */

export const JANELA_INTERESSE_DIAS = 90;
/** Até aqui a conversa entra como de agora. */
export const JANELA_CONVERSA_HORAS = 72;
/** Depois disto a mensagem não entra na conversa recente — perfil e eventos guardam o que ficou. */
export const JANELA_CONVERSA_MAX_DIAS = 30;

const MS_DIA = 86_400_000;

export type Mencao = {
  texto: string | null;
  created_at: string | null;
  membro_atipico_id?: string | null;
};

const PALAVRAS_VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "com", "para", "pra", "em", "no", "na",
  "nos", "nas", "um", "uma", "coisas", "coisa", "muito", "tudo",
]);

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Radical simples: "figurinhas" casa com "figurinha", "dinossauros" com "dinossauro". */
function radical(p: string): string {
  return p.length > 4 ? p.replace(/(oes|aes|ns|es|s)$/, "") : p;
}

function termosDe(interesse: string): string[] {
  return normalizar(interesse)
    .split(" ")
    .filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p))
    .map(radical);
}

function mencionou(interesse: string, texto: string): boolean {
  const alvo = normalizar(interesse);
  const t = ` ${normalizar(texto)} `;
  if (alvo && t.includes(` ${alvo} `)) return true;
  const palavras = new Set(t.split(" ").filter(Boolean).map(radical));
  return termosDe(interesse).some((r) => palavras.has(r));
}

/**
 * "Agora é dinossauro, esqueceu a Patrulha Canina" menciona a Patrulha — e a
 * DESCARTA. Fala com sinal de abandono não confirma interesse nenhum dela.
 */
const ABANDONO = /\b(esqueceu|enjoou|largou|parou de|nao gosta mais|nao quer mais|perdeu o interesse|nao liga mais|deixou de)\b/;

function recente(iso: string | null | undefined, agora: Date, dias: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && agora.getTime() - t <= dias * MS_DIA;
}

/**
 * Separa os interesses do perfil em RECENTES (com evidência dos últimos 90
 * dias) e SEM CONFIRMAÇÃO. A ordem original é preservada.
 */
export function classificarInteresses(params: {
  interesses: readonly string[];
  mencoes: readonly Mencao[];
  membroId: string | null;
  perfilCriadoEm?: string | null;
  preferenciasAtualizadasEm?: string | null;
  agora?: Date;
}): { recentes: string[]; semConfirmacao: string[] } {
  const agora = params.agora ?? new Date();
  const perfilNovo =
    recente(params.perfilCriadoEm, agora, JANELA_INTERESSE_DIAS) ||
    recente(params.preferenciasAtualizadasEm, agora, JANELA_INTERESSE_DIAS);
  if (perfilNovo) return { recentes: [...params.interesses], semConfirmacao: [] };
  // A fala sobre OUTRA criança não confirma o gosto desta.
  const falas = params.mencoes.filter(
    (m) =>
      m.texto &&
      !ABANDONO.test(normalizar(m.texto)) &&
      recente(m.created_at, agora, JANELA_INTERESSE_DIAS) &&
      (!m.membro_atipico_id || !params.membroId || m.membro_atipico_id === params.membroId),
  );
  const recentes: string[] = [];
  const semConfirmacao: string[] = [];
  for (const i of params.interesses) {
    (falas.some((f) => mencionou(i, f.texto!)) ? recentes : semConfirmacao).push(i);
  }
  return { recentes, semConfirmacao };
}

/**
 * O que a FAMÍLIA escreveu nos últimos 90 dias — a única evidência de que um
 * interesse continua valendo. Escopo por família na origem.
 */
export async function lerMencoesRecentes(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date = new Date(),
): Promise<Mencao[]> {
  try {
    const { data, error } = await supabase
      .from("ayla_messages")
      .select("texto, created_at, membro_atipico_id")
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound")
      .gte("created_at", new Date(agora.getTime() - JANELA_INTERESSE_DIAS * MS_DIA).toISOString())
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []) as Mencao[];
  } catch (e) {
    // Sem evidência, nenhum interesse antigo é promovido a atual: falhar aqui
    // só deixa a Ayla com menos gancho, nunca com gancho velho.
    console.warn("[ayla:memoria] menções recentes indisponíveis:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * A IDADE DE UMA MENSAGEM NA CONVERSA RECENTE.
 *
 * `""` — até 72 h: entra como conversa de agora, sem etiqueta;
 * `"[há N dias]"` — de 3 a 30 dias: entra, mas datada;
 * `null` — mais de 30 dias, ou sem data: NÃO entra.
 */
export function etiquetaDaFala(createdAt: string | null | undefined, agora: Date = new Date()): string | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return null;
  const ms = agora.getTime() - t;
  if (ms <= JANELA_CONVERSA_HORAS * 3_600_000) return "";
  const dias = Math.round(ms / MS_DIA);
  if (dias > JANELA_CONVERSA_MAX_DIAS) return null;
  return `[há ${dias} dias]`;
}

/** Linha de legenda para quando a conversa recente traz falas datadas. */
export const LEGENDA_FALAS_DATADAS =
  "(Falas marcadas com [há N dias] são de conversas anteriores, não de hoje: não trate o que foi dito ali como situação atual sem confirmar.)";
