import { BIA_HABILIDADES, habilidadesImplicadas, type BiaHabilidade } from "./tipos";
import { parsearSubcampos, subcamposDe } from "@/lib/kolo-vivo/subcampos";
import { MEMBRO_CAMPOS_TOPLEVEL } from "@/lib/kolo-vivo/campos";

/**
 * O QUE ESTA CRIANÇA JÁ DEMONSTROU — PEND-197.
 *
 * ── o que este módulo é ───────────────────────────────────────────────────
 *
 * Uma função PURA que lê o Perfil Vivo e devolve quais das 10 habilidades da
 * PEND-196 a criança **provadamente já tem**. É o insumo de
 * `ContextoBia.habilidadesProvadas`, que existe para a BIA poder VETAR um
 * chunk que pressupõe a ausência de algo que a criança já faz — a criança que
 * conversa não deve receber a escada pré-verbal.
 *
 * ── o que ele NÃO faz, e por que cada proibição existe ────────────────────
 *
 * ⚠️ NÃO INTERPRETA PROSA. Nenhum regex sobre `comunicacao.outras`, nenhuma
 * chamada de modelo, nenhum segundo extrator. Só SELETOR FECHADO: campo cujo
 * valor pertence a uma lista finita declarada em `subcampos.ts`. A razão é a
 * assimetria do erro: um falso positivo aqui **apaga conhecimento** de quem
 * mais precisa dele, em silêncio, e ninguém descobre. Texto livre é escrito
 * pelo modelo a partir da fala da mãe; seletor é escolha entre N valores que o
 * produto declarou. Só o segundo é prova.
 *
 * ⚠️ AUSÊNCIA DE DADO NÃO É AUSÊNCIA DE HABILIDADE. Perfil vazio devolve
 * conjunto vazio, e conjunto vazio significa "não sei", não "a criança não
 * tem". Quem consome (`filtrarDuro` na PEND-196) só veta quando há prova
 * POSITIVA — nunca por falta de informação.
 *
 * ⚠️ NÃO INFERE POR IDADE. Uma criança de 9 anos pode ser não-verbal. Idade
 * aqui não é evidência de nada.
 *
 * ⚠️ NÃO REINTERPRETA HISTÓRICO nem duplica o decisor de lacuna. Lê o estado
 * do artefato, que é o dono dessa informação (§15: um dono para cada decisão).
 */

/**
 * A PONTE: seletor fechado → habilidade que aquele valor PROVA.
 *
 * ⚠️ CADA LINHA É UMA AFIRMAÇÃO CLÍNICA, e a lista é curta de propósito. O que
 * está de fora está de fora por escrito, no bloco seguinte.
 *
 * Só habilidade DIRETA aparece aqui. O resto vem do fecho transitivo da
 * PEND-196 (`BIA_HABILIDADE_IMPLICA`), que não é reimplementado neste arquivo:
 * `frases` já implica `fala_funcional`, `troca_de_turnos` e os degraus abaixo,
 * então provar `frases` basta.
 */
const PROVAS: ReadonlyArray<{
  campo: string;
  subcampo: string;
  /** Valores do seletor que provam. Comparados por igualdade, não por busca. */
  valores: readonly string[];
  prova: BiaHabilidade;
  porque: string;
}> = [
  {
    campo: "comunicacao",
    subcampo: "forma",
    valores: ["Fala frases"],
    prova: "frases",
    porque: "o seletor declara fala em frases; o fecho dá fala_funcional e os degraus abaixo",
  },
  {
    campo: "comunicacao",
    subcampo: "forma",
    valores: ["Fala palavras soltas"],
    prova: "comunicacao_simbolica",
    porque:
      "palavra é símbolo — mas palavra isolada pode ser rótulo, não pedido, então NÃO prova fala_funcional",
  },
  {
    campo: "comunicacao",
    subcampo: "iniciativa",
    valores: ["Mostra o que quer"],
    prova: "gestos_intencionais",
    porque:
      "é literalmente a definição da habilidade — e o campo só aparece quando forma é Não-verbal, que é a população em que isto importa",
  },
  {
    campo: "imitacao",
    subcampo: "padrao",
    valores: ["Imita bastante", "Às vezes"],
    prova: "imitacao",
    porque: "imitar às vezes é imitar; a habilidade existe",
  },
  {
    campo: "socializacao",
    subcampo: "interage",
    valores: ["Com facilidade", "Às vezes"],
    prova: "atencao_social",
    porque: "não se interage com pares sem notar o outro — é o piso da escada",
  },
  {
    campo: "socializacao",
    subcampo: "disposicao",
    valores: ["Busca e curte"],
    prova: "atencao_social",
    porque: "buscar contato social pressupõe notar o outro",
  },
];

/**
 * O QUE FICOU DE FORA, E POR QUÊ — a parte mais importante deste arquivo.
 *
 * `conversa_reciproca` — o campo que descreveria isso é
 * `comunicacao.conversa`, e ele é TEXTO LIVRE. Foi exatamente ele que, escrito
 * como "Conversa bem", o Gate B não conseguiu enxergar (PEND-192). Ler prosa
 * aqui repetiria o erro de origem com sinal invertido.
 *
 * `leitura_escrita` — **não existe campo estruturado nenhum** no Perfil Vivo
 * para alfabetização. `aprendizado` só tem `modo` (Vendo/Ouvindo/Fazendo/
 * Repetindo), que é canal de aprendizagem, não competência de leitura. É
 * lacuna de SCHEMA, não de extração, e nenhuma esperteza de leitura resolve.
 *
 * `atencao_compartilhada` e `troca_de_turnos` — sem seletor próprio. Chegam
 * pelo fecho quando algo acima é provado, e é o suficiente: são degraus
 * intermediários.
 *
 * `socializacao.divide` = "Sim" — CANDIDATO DESCARTADO. Dividir e esperar a
 * vez parece provar `troca_de_turnos`, e a tentação é grande porque aumentaria
 * a cobertura. Mas dividir brinquedo e sustentar alternância proto-conversacional
 * são construtos diferentes; aceitar isso vetaria justamente o conteúdo que
 * ENSINA troca de turnos para uma criança que talvez não a tenha. Errar para
 * menos custa uma recuperação a mais; errar para mais apaga o que ela precisa.
 *
 * `comunicacao.caa` — provaria `comunicacao_simbolica`, e é texto livre. Fica
 * de fora pela mesma regra. Vale como pedido de schema: CAA merece seletor.
 */
export const HABILIDADES_SEM_FONTE_ESTRUTURADA: readonly BiaHabilidade[] = [
  "conversa_reciproca",
  "leitura_escrita",
];

export type PerfilParaHabilidades = Readonly<Record<string, string>>;

/**
 * Extrai o mapa `campo → texto` de uma linha de `perfil_vivo_membro`.
 *
 * Separado do produtor de propósito: aqui mora o conhecimento da FORMA da
 * linha (coluna de topo × `categorias_extras`); lá mora a regra clínica. Puro
 * também — recebe o objeto, não o banco.
 */
export function textoPorCampoDaLinha(
  row: Record<string, unknown> | null | undefined,
): PerfilParaHabilidades {
  const out: Record<string, string> = {};
  if (!row) return out;
  for (const campo of MEMBRO_CAMPOS_TOPLEVEL) {
    const sec = row[campo] as { texto?: string } | undefined;
    const t = sec?.texto?.trim();
    if (t) out[campo] = t;
  }
  const extras = (row.categorias_extras as Record<string, unknown>) ?? {};
  for (const [campo, v] of Object.entries(extras)) {
    const t = (v as { texto?: string } | undefined)?.texto?.trim();
    if (t) out[campo] = t;
  }
  return out;
}

export type HabilidadesDoPerfil = {
  /** Provadas por um seletor fechado, diretamente. */
  diretas: Set<BiaHabilidade>;
  /** `diretas` mais o fecho transitivo da PEND-196. É o que a BIA consome. */
  todas: Set<BiaHabilidade>;
  /** Rastro de auditoria: qual campo provou o quê. Sem valor de família. */
  evidencias: Array<{ campo: string; subcampo: string; valor: string; prova: BiaHabilidade }>;
};

/**
 * O PRODUTOR. Determinístico, sem IO, sem modelo, sem escrita.
 *
 * ⚠️ SEPARA `diretas` DE `todas`, e isso não é detalhe de teste: sem a
 * separação não há como distinguir "o Perfil afirma que ela fala em frases" de
 * "concluímos que ela tem atenção social porque fala em frases". Quando uma
 * cobertura parecer boa demais, é esta distinção que mostra se ela vem de dado
 * ou de dedução.
 */
export function habilidadesProvadasDoPerfil(
  perfil: PerfilParaHabilidades,
): HabilidadesDoPerfil {
  const diretas = new Set<BiaHabilidade>();
  const evidencias: HabilidadesDoPerfil["evidencias"] = [];

  for (const p of PROVAS) {
    const texto = (perfil[p.campo] ?? "").trim();
    if (!texto) continue;
    const subs = subcamposDe(p.campo);
    if (!subs) continue;
    const valores = parsearSubcampos(subs, texto);
    const valor = (valores[p.subcampo] ?? "").trim();
    if (!valor) continue;
    // ⚠️ IGUALDADE, NÃO `includes`. "Não-verbal" contém "verbal"; buscar
    // substring aqui provaria fala para quem não fala. E valor fora do
    // seletor — porque a mãe editou à mão, ou porque o enum mudou — não
    // prova nada e não quebra nada.
    if (!p.valores.includes(valor)) continue;
    diretas.add(p.prova);
    evidencias.push({ campo: p.campo, subcampo: p.subcampo, valor, prova: p.prova });
  }

  return { diretas, todas: habilidadesImplicadas([...diretas]), evidencias };
}

/** Conveniência para quem tem a linha crua do banco. */
export function habilidadesProvadasDaLinha(
  row: Record<string, unknown> | null | undefined,
): HabilidadesDoPerfil {
  return habilidadesProvadasDoPerfil(textoPorCampoDaLinha(row));
}

/** As habilidades que ALGUM seletor de hoje consegue provar diretamente. */
export const HABILIDADES_COM_PROVA_DIRETA: readonly BiaHabilidade[] = [
  ...new Set(PROVAS.map((p) => p.prova)),
];

/** Só para documentação e bancada — a tabela de provas, legível. */
export const TABELA_DE_PROVAS = PROVAS;

/** Sanidade do vocabulário: toda prova aponta para habilidade que existe. */
export function provasSaoDoVocabulario(): boolean {
  return PROVAS.every((p) => (BIA_HABILIDADES as readonly string[]).includes(p.prova));
}
