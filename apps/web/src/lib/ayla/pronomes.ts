/**
 * Pronomes/artigos pra usar nas mensagens da Ayla baseado no gênero do
 * membro atípico. Fonte ÚNICA — qualquer template ou frase gerada que
 * fale "do/da", "ele/ela", "dele/dela" deve passar por aqui.
 *
 * Convenção:
 *  - masculino → "o André", "ele", "dele", "do André"
 *  - feminino  → "a Maria", "ela", "dela", "da Maria"
 *  - neutro/null → omite artigo ("André"), usa "essa criança"/"dessa criança"
 *
 * Pra o caso neutro, em vez de empurrar "dele/dela" ou "ele/ela", a regra
 * é reescrever a frase pra evitar pronome (usar nome direto ou
 * impessoalizar). Quando inevitável, cai pra "essa criança".
 */

export type Genero = "masculino" | "feminino" | "neutro" | null | undefined;

export type Pronomes = {
  /** Artigo solto: "o" / "a" / "" (vazio no neutro). */
  artigo: string;
  /** Possessivo: "dele" / "dela" / "dessa criança". */
  possessivo: string;
  /** Sujeito: "ele" / "ela" / "essa criança". */
  sujeito: string;
  /**
   * Contração "de + artigo + nome": "do André" / "da Maria" / "de Alex".
   * Use com `comNome(p, nome)` em vez de montar à mão.
   */
  preposicaoDe: "do" | "da" | "de";
  /**
   * Contração "com + artigo + nome": "com o André" / "com a Maria" / "com Alex".
   * Use com `comPreposicaoCom(p, nome)`.
   */
  preposicaoCom: "com o" | "com a" | "com";
  /**
   * Marcador semântico — true quando temos gênero definido.
   * Útil pra escolher template alternativo quando faz diferença.
   */
  generoDefinido: boolean;
};

const MASCULINO: Pronomes = {
  artigo: "o",
  possessivo: "dele",
  sujeito: "ele",
  preposicaoDe: "do",
  preposicaoCom: "com o",
  generoDefinido: true,
};

const FEMININO: Pronomes = {
  artigo: "a",
  possessivo: "dela",
  sujeito: "ela",
  preposicaoDe: "da",
  preposicaoCom: "com a",
  generoDefinido: true,
};

const NEUTRO: Pronomes = {
  artigo: "",
  possessivo: "dessa criança",
  sujeito: "essa criança",
  preposicaoDe: "de",
  preposicaoCom: "com",
  generoDefinido: false,
};

export function pronomesPara(genero: Genero): Pronomes {
  if (genero === "masculino") return MASCULINO;
  if (genero === "feminino") return FEMININO;
  return NEUTRO;
}

/**
 * Dados crus do responsável (como vêm de family_profiles).
 *  - papel: 'mae' | 'pai' | 'avo' | 'outro' | null
 *  - papelOutro: grau de parentesco livre quando 'outro' (ou 'avo')
 *  - genero: gênero do responsável, quando informado
 */
export type Cuidador = {
  papel?: string | null;
  papelOutro?: string | null;
  genero?: Genero;
};

/** Como a Ayla deve enxergar o cuidador: vínculo + gênero pra concordância. */
export type CuidadorDescrito = {
  /** "mãe" / "pai" / "avó" / "tia" / "responsável" — o vínculo com a criança. */
  relacao: string;
  /** Gênero do próprio cuidador (pra "bem-vinda/bem-vindo"). */
  genero: Genero;
};

/**
 * Resolve o vínculo + gênero do cuidador a partir do papel cadastrado.
 * Mãe/pai inferem o gênero; "avo"/"outro" usam o detalhe livre + o gênero
 * informado no onboarding. Fonte única — qualquer fala da Ayla que precise
 * tratar o adulto responsável deve passar por aqui.
 */
export function descricaoCuidador(c: Cuidador): CuidadorDescrito {
  const papel = (c.papel ?? "").toLowerCase();
  if (papel === "mae") return { relacao: "mãe", genero: "feminino" };
  if (papel === "pai") return { relacao: "pai", genero: "masculino" };
  // avó/avô são papéis distintos no onboarding — gênero implícito no papel.
  if (papel === "avo") return { relacao: "avó", genero: "feminino" };
  if (papel === "avoh") return { relacao: "avô", genero: "masculino" };
  if (papel === "outro") {
    const grau = c.papelOutro?.trim();
    if (grau) return { relacao: grau, genero: c.genero ?? inferGeneroDePalavra(grau) };
    return { relacao: "responsável", genero: c.genero ?? null };
  }
  return { relacao: "responsável", genero: c.genero ?? null };
}

/**
 * Infere o gênero a partir da palavra de parentesco que a pessoa escreveu
 * ("tia"→feminino, "tio"→masculino, "madrinha"→feminino, "padrasto"→masculino).
 * Heurística por terminação; quando ambíguo (ex.: "responsável", "tutor"), null.
 */
export function inferGeneroDePalavra(palavra: string): Genero {
  const w = palavra.trim().toLowerCase();
  if (!w) return null;
  if (/(a|ã|ó)$/.test(w)) return "feminino"; // tia, madrinha, madrasta, irmã, avó
  if (/(o|ô)$/.test(w)) return "masculino"; // tio, padrinho, padrasto, irmão, avô
  return null;
}

/**
 * "do André" / "da Maria" / "de Alex" — sem espaço sobrando no neutro.
 */
export function comPreposicaoDe(p: Pronomes, nome: string): string {
  return `${p.preposicaoDe} ${nome}`;
}

/**
 * "com o André" / "com a Maria" / "com Alex" — sem espaço sobrando no neutro.
 */
export function comPreposicaoCom(p: Pronomes, nome: string): string {
  return `${p.preposicaoCom} ${nome}`;
}

/**
 * Vars padrão que os templates da Ayla podem usar com {placeholders}.
 * Inclui o próprio nome pra simplificar o chamador.
 */
export function pronomesVars(genero: Genero, nome: string): Record<string, string> {
  const p = pronomesPara(genero);
  return {
    nomeMembro: nome,
    artigoMembro: p.artigo,
    possessivoMembro: p.possessivo,
    sujeitoMembro: p.sujeito,
    deNomeMembro: comPreposicaoDe(p, nome),
    comNomeMembro: comPreposicaoCom(p, nome),
  };
}
