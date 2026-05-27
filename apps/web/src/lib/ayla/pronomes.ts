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
