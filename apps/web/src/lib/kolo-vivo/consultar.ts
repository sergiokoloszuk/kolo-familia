import type { SupabaseClient } from "@supabase/supabase-js";
import { DOMINIOS } from "@/app/(app)/kolo-vivo/dominios";
import { parsearSubcampos, subcamposDe, type SubCampo } from "./subcampos";

/**
 * BASE 1 — O PERFIL DA CRIANÇA, CONSULTÁVEL CAMPO A CAMPO.
 *
 * O que isto resolve: os 111 subcampos de 16 domínios existem, mas são
 * **serializados como rótulos dentro de UM texto por domínio** — decisão
 * consciente para não reescrever o backend. A consequência é que a pergunta
 * *"já sabemos isso?"* não tinha resposta programática, e sem ela a condução
 * não consegue cumprir duas promessas: **consultar antes de perguntar** e
 * **não repetir o que a família já contou**.
 *
 * ⚠️ NÃO RECONSTRÓI NADA. Lê o mesmo texto, com o mesmo `parsearSubcampos` que
 * a tela do Kolo Vivo já usa há tempos. Nenhuma migração, nenhum campo novo,
 * nenhuma escrita — e o formato continua sendo o que a tela grava.
 *
 * ── O QUE ESTA CAMADA NÃO SABE ─────────────────────────────────────────────
 *
 * **Origem e data.** O texto do perfil não carrega quem contou nem quando. A
 * distinção entre *relato da família* e *inferência da Ayla* não existe no
 * armazenamento — só em `sugestao_perfil_vivos`, que é a fila de sugestões, não
 * o perfil. Resolver isso é mudança estrutural, está fora desta fatia, e o
 * destino é PEND-018.
 *
 * Enquanto não estiver resolvido: **nada que sai daqui pode ser apresentado
 * como "a família contou"** — só como "está no perfil".
 */

/** O que se sabe de um campo. Três estados, e o terceiro é o que faltava. */
export type EstadoCampo =
  /** Tem valor. */
  | "preenchido"
  /** Nunca foi respondido — é sobre isto que vale perguntar. */
  | "vazio"
  /**
   * Foi respondido, e a resposta é uma NEGATIVA ("não", "não tem", "nenhum").
   *
   * Separado de `vazio` de propósito: são a mesma string curta para quem lê
   * rápido e coisas opostas para a condução. Perguntar de novo "ele acorda de
   * madrugada?" a quem já respondeu "não" é o erro que esta camada existe para
   * impedir.
   */
  | "negativo";

export type CampoPerfil = {
  /** Chave do subcampo, como em `subcampos.ts`. */
  key: string;
  /** Rótulo humano — é o que a Ayla usa se for citar. */
  label: string;
  estado: EstadoCampo;
  /** O texto, quando há. `null` quando vazio. */
  valor: string | null;
};

export type DominioPerfil = {
  dominio: string;
  /** Rótulo humano do domínio ("Sono", "Foco"). */
  label: string;
  campos: CampoPerfil[];
  /** Só os que têm resposta — inclusive negativa. É o "o que já sabemos". */
  conhecidos: CampoPerfil[];
  /** Só os que nunca foram respondidos. É a lista do que caberia perguntar. */
  lacunas: CampoPerfil[];
};

const NEGATIVA =
  /^(n[ãa]o|nenhum[a]?|nada|nunca|sem (nada|problema|queixa)|n\/a|-{1,2})[\s.!]*$/i;

/** Classifica um valor bruto. Exportada porque a regra do "não" merece teste. */
export function classificarValor(bruto: string | null | undefined): {
  estado: EstadoCampo;
  valor: string | null;
} {
  const v = (bruto ?? "").trim();
  if (!v) return { estado: "vazio", valor: null };
  if (NEGATIVA.test(v)) return { estado: "negativo", valor: v };
  return { estado: "preenchido", valor: v };
}

/** Onde o texto daquele domínio mora: coluna própria ou dentro do saco jsonb. */
function textoDoDominio(
  linha: Record<string, unknown> | null,
  dominio: string,
): string {
  if (!linha) return "";
  const def = DOMINIOS.find((d) => d.key === dominio);
  if (!def) return "";
  if (def.storage === "toplevel") {
    const direto = linha[def.key] ?? (def.legacyFallback ? linha[def.legacyFallback] : null);
    return typeof direto === "string" ? direto : "";
  }
  const extras = (linha.categorias_extras ?? {}) as Record<string, unknown>;
  const v = extras[def.key];
  return typeof v === "string" ? v : "";
}

function montarDominio(
  dominio: string,
  campos: SubCampo[],
  texto: string,
): DominioPerfil {
  const valores = parsearSubcampos(campos, texto);
  const lista: CampoPerfil[] = campos.map((c) => {
    const { estado, valor } = classificarValor(valores[c.key]);
    return { key: c.key, label: c.label, estado, valor };
  });
  return {
    dominio,
    label: DOMINIOS.find((d) => d.key === dominio)?.label ?? dominio,
    campos: lista,
    conhecidos: lista.filter((c) => c.estado !== "vazio"),
    lacunas: lista.filter((c) => c.estado === "vazio"),
  };
}

export type PerfilConsultavel = {
  membroId: string;
  /** Domínios com subcampos declarados, já parseados. */
  dominios: Map<string, DominioPerfil>;
  /** Este campo já tem resposta (mesmo que negativa)? */
  sabemos: (dominio: string, campo: string) => boolean;
  /** O valor, quando houver. */
  valorDe: (dominio: string, campo: string) => string | null;
  /** O que caberia perguntar naquele domínio, em ordem de declaração. */
  lacunasDe: (dominio: string) => CampoPerfil[];
};

const VAZIO: DominioPerfil = {
  dominio: "",
  label: "",
  campos: [],
  conhecidos: [],
  lacunas: [],
};

/**
 * Carrega o perfil de UMA criança, pronto para consulta.
 *
 * ⚠️ ISOLAMENTO. A leitura filtra por `membro_atipico_id` **e**
 * `family_account_id`. Os dois, sempre: o primeiro sozinho já é um id opaco,
 * mas a regra desta base é que nenhuma família alcance dado de outra, e o
 * segundo filtro é o que torna isso verdade em vez de provável.
 */
export async function carregarPerfilConsultavel(
  supabase: SupabaseClient,
  p: { membroId: string; familyId: string },
): Promise<PerfilConsultavel> {
  let linha: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("*")
      .eq("membro_atipico_id", p.membroId)
      .eq("family_account_id", p.familyId)
      .maybeSingle();
    linha = (data as Record<string, unknown> | null) ?? null;
  } catch {
    // Perfil indisponível não pode derrubar a conversa: sem ele a Ayla
    // pergunta o que perguntaria hoje. O pior caso é o produto de ontem.
    linha = null;
  }

  const dominios = new Map<string, DominioPerfil>();
  for (const def of DOMINIOS) {
    const campos = subcamposDe(def.key);
    if (!campos || campos.length === 0) continue;
    dominios.set(def.key, montarDominio(def.key, campos, textoDoDominio(linha, def.key)));
  }

  const pega = (dominio: string, campo: string) =>
    (dominios.get(dominio) ?? VAZIO).campos.find((c) => c.key === campo) ?? null;

  return {
    membroId: p.membroId,
    dominios,
    sabemos: (dominio, campo) => {
      const c = pega(dominio, campo);
      return c != null && c.estado !== "vazio";
    },
    valorDe: (dominio, campo) => pega(dominio, campo)?.valor ?? null,
    lacunasDe: (dominio) => (dominios.get(dominio) ?? VAZIO).lacunas,
  };
}

/**
 * O bloco "o que já sabemos" de um domínio, em texto — para o prompt ou para
 * um log. Devolve `""` quando não se sabe nada, porque um cabeçalho seguido de
 * nada ensina o modelo a preencher formulário.
 */
export function resumoDoDominio(d: DominioPerfil | undefined): string {
  if (!d || d.conhecidos.length === 0) return "";
  return d.conhecidos.map((c) => `${c.label}: ${c.valor}`).join("\n");
}

/**
 * AS LINHAS DO BLOCO `<o_que_ja_sabemos>` — uma redação só para os dois canais.
 *
 * Nasceu inline em `lib/ia/prompt.ts` (Fase 4A.1, web). Quando o WhatsApp
 * passou a receber o mesmo bloco (10/08/2026), a escolha era copiar quinze
 * linhas ou trazê-las para cá. Copiar significaria duas redações do mesmo
 * conceito divergindo com o tempo — que é exatamente o que este piloto existe
 * para não fazer.
 *
 * A distinção que estas linhas carregam é a razão de o bloco existir: separar
 * **vazio** de **NEGATIVO**. "Não tem sensibilidade a som" é informação; sem
 * a distinção o modelo trata os dois igual e volta a perguntar o que a família
 * já respondeu.
 *
 * Devolve `""` quando não há nada preenchido nem negativo em domínio nenhum —
 * um cabeçalho seguido de nada ensina o modelo a preencher formulário.
 */
export function linhasDoPerfilConsultavel(
  perfil: PerfilConsultavel | null | undefined,
): string {
  if (!perfil) return "";
  const linhas: string[] = [];
  for (const d of perfil.dominios.values()) {
    const preenchidos = d.campos.filter((c) => c.estado === "preenchido");
    const negativos = d.campos.filter((c) => c.estado === "negativo");
    const vazios = d.campos.filter((c) => c.estado === "vazio");
    if (!preenchidos.length && !negativos.length) continue;
    const parte = [
      preenchidos.length ? `sabemos: ${preenchidos.map((c) => c.label).join(", ")}` : null,
      negativos.length ? `NÃO se aplica: ${negativos.map((c) => c.label).join(", ")}` : null,
      vazios.length ? `ainda não sabemos: ${vazios.map((c) => c.label).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    linhas.push(`- ${d.label}: ${parte}`);
  }
  return linhas.join("\n");
}
