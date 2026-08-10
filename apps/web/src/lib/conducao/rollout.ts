/**
 * ROLLOUT EM TRÊS ESTADOS, POR FAMÍLIA — o padrão, num lugar só.
 *
 * Nasceu dentro de `lib/ia/provider.ts` (a migração conversacional, 06/08/2026)
 * e provou-se em produção: em 10/08/2026 a leitura de `api_calls` mostrou
 * exatamente 3 famílias em GPT e 55 em Claude, sem uma exceção. Quando a Fase
 * 4A precisou do mesmo comportamento, a escolha era copiar seis linhas ou
 * extrair o padrão. Isto é a extração.
 *
 * ── POR QUE TRÊS ESTADOS, e não "ligado + uma lista que restringe" ────────
 *
 * A segunda forma é menor de escrever e é uma armadilha: a lista passa a ser o
 * que SEGURA o rollout, então esvaziá-la por engano — apagar, renomear, um
 * deploy que não a carrega — promove todo mundo em silêncio. O acidente mais
 * provável vira o resultado mais perigoso.
 *
 * Aqui é o contrário: sob `teste`, lista vazia = ninguém. Ir para todos exige
 * alguém digitar `on`, que é uma decisão, não um descuido.
 *
 * O valor é comparado com o texto EXATO (só espaços em volta são tolerados,
 * porque espaço invisível colado num painel não é decisão de ninguém). Grafia
 * errada cai em `off` — pior caso é "continua como estava", nunca "vazou".
 */

export type EstadoRollout = "off" | "teste" | "on";

/**
 * Lê o estado a partir de uma variável de ambiente.
 *
 * `nomeTeste` e `nomeOn` são os textos que ligam cada estado, porque cada
 * rollout usa o seu vocabulário: o provider fala `openai_teste`/`openai`, a
 * Fase 4A fala `teste`/`on`. O COMPORTAMENTO é o mesmo; só o nome muda.
 */
export function estadoDeRollout(
  bruto: string | undefined | null,
  nomeTeste: string,
  nomeOn: string,
): EstadoRollout {
  const v = (bruto ?? "").trim();
  if (v === nomeOn) return "on";
  if (v === nomeTeste) return "teste";
  return "off";
}

/**
 * As famílias autorizadas no modo de teste — por `family_account_id`, que é o
 * identificador ESTRUTURAL. Nunca por nome, telefone ou qualquer coisa que o
 * modelo possa inferir: a lista precisa ser conferível por quem a escreveu.
 *
 * Separadores aceitos: vírgula, espaço, quebra de linha. Entradas vazias caem
 * fora — "id1,,id2 " é uma lista de dois, e uma lista só de vírgulas é vazia.
 */
export function listaDeFamilias(bruto: string | undefined | null): string[] {
  return (bruto ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A decisão, FAIL CLOSED sem exceção: id ausente, vazio, não-string ou fora da
 * lista → `false`. Não se entra num rollout por inferência, e a dúvida sempre
 * resolve para o lado de quem já está funcionando.
 */
export function alcancaFamilia(
  estado: EstadoRollout,
  lista: readonly string[],
  familyAccountId?: string | null,
): boolean {
  if (estado === "off") return false;
  if (estado === "on") return true;
  const id = typeof familyAccountId === "string" ? familyAccountId.trim() : "";
  if (!id) return false;
  return lista.includes(id);
}
