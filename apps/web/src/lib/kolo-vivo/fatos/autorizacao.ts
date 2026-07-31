/**
 * QUEM ENTRA NA MEMÓRIA VIVA — a barreira da amostra controlada.
 *
 * A flag `PERFIL_FATOS_SHADOW_WRITE` era global: ligá-la para testar com um
 * número passaria a escrever fato sobre TODAS as crianças de TODAS as famílias,
 * com um extrator que nunca viu linguagem real. Isso contradiz o protocolo da
 * amostra controlada (docs/memoria/amostra-controlada.md), onde entra quem
 * consentiu — e só.
 *
 * Duas condições, as duas obrigatórias: a flag ligada E a família na lista.
 *
 * FAIL-CLOSED EM TODOS OS CAMINHOS. Não existe configuração ausente,
 * malformada ou ambígua que autorize alguém. Na dúvida, ninguém entra: o custo
 * de não coletar um fato é ele voltar na próxima conversa; o custo de coletar
 * de quem não consentiu não tem desfazer.
 *
 * FORMATO:
 *
 *   PERFIL_FATOS_SHADOW_WRITE=1
 *   PERFIL_FATOS_FAMILIAS=6f1c...,9ab2...
 *
 * Só id interno de família (uuid). Nunca telefone, nome ou e-mail: identificador
 * textual muda, colide e vaza em log — e um "Maria" na lista autorizaria a
 * Maria errada.
 */

export const FLAG_ENV = "PERFIL_FATOS_SHADOW_WRITE";
export const LISTA_ENV = "PERFIL_FATOS_FAMILIAS";

/** Separadores aceitos: vírgula, ponto e vírgula e qualquer espaço/quebra. */
const SEPARADORES = /[,;\s]+/;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Env = Record<string, string | undefined>;

/**
 * Desligada por padrão. Com a flag off o serviço sai ANTES de qualquer I/O —
 * o sistema se comporta exatamente como antes, e o rollback é desligar a
 * variável.
 */
export function escritaSombraHabilitada(env: Env = process.env): boolean {
  const v = (env[FLAG_ENV] ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * As famílias autorizadas. Conjunto VAZIO quando a lista falta, está vazia ou
 * é inválida — e conjunto vazio não autoriza ninguém.
 *
 * UM TOKEN INVÁLIDO INVALIDA A LISTA INTEIRA, de propósito. Descartar só o
 * token quebrado e seguir com o resto transformaria um erro de digitação em
 * autorização parcial silenciosa: quem editou a variável acharia que colocou
 * três famílias e teria colocado duas, e a que faltou é a que ninguém notaria.
 */
export function familiasAutorizadas(env: Env = process.env): Set<string> {
  const bruto = (env[LISTA_ENV] ?? "").trim();
  if (!bruto) return new Set();

  const tokens = bruto.split(SEPARADORES).filter(Boolean);
  if (tokens.length === 0) return new Set();
  if (tokens.some((t) => !UUID.test(t))) return new Set();

  return new Set(tokens.map((t) => t.toLowerCase()));
}

/**
 * A pergunta única: esta família entra na Memória Viva?
 *
 * Chamada em DOIS lugares, e os dois são necessários:
 *   - `registrarFatoPerfil` — a última linha de defesa, por onde passam os
 *     quatro caminhos de escrita (WhatsApp, web, diário, incorporação).
 *   - antes de `registrarLote` no orquestrador — senão a família não
 *     autorizada não gravaria fato, mas pagaria a escrita do lote.
 */
export function memoriaVivaAutorizada(
  familyId: string | null | undefined,
  env: Env = process.env,
): boolean {
  if (!escritaSombraHabilitada(env)) return false;

  const id = (familyId ?? "").trim().toLowerCase();
  // Id ausente ou malformado nunca autoriza — nem por prefixo, nem por
  // coincidência de início: a comparação é de igualdade no conjunto.
  if (!UUID.test(id)) return false;

  return familiasAutorizadas(env).has(id);
}

/** Para telemetria e diagnóstico. Nunca expõe quem está na lista. */
export function resumoDaAutorizacao(env: Env = process.env): {
  flag: boolean;
  quantidade: number;
} {
  return { flag: escritaSombraHabilitada(env), quantidade: familiasAutorizadas(env).size };
}
