/** Vínculo é relato da pessoa, não inferência do nome nem mudança cadastral. */
export type Vinculo = "mae" | "pai" | "tia" | "tio" | "avo" | "cuidadora" | "cuidador";
export type VinculoDito = Vinculo | "nao_informado";

export type VinculoRelatado = { tipo: VinculoDito; informada_em: string };

const ROTULOS: Record<Vinculo, string> = {
  mae: "mãe", pai: "pai", tia: "tia", tio: "tio", avo: "avó ou avô",
  cuidadora: "cuidadora", cuidador: "cuidador",
};

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
}

export function vinculoDitoSobreMembro(
  texto: string,
  nome: string | null,
  unicaPessoaCadastrada: boolean,
): VinculoDito | null {
  const frase = normalizar(texto);
  const primeiroNome = normalizar(nome ?? "").trim().split(" ")[0];
  if (!primeiroNome || primeiroNome.length < 3) return null;
  const nomeEscapado = primeiroNome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nomeNoTexto = new RegExp(`(?:^|[^a-z0-9])${nomeEscapado}(?:[^a-z0-9]|$)`).test(frase);
  if (!unicaPessoaCadastrada && !nomeNoTexto) return null;
  // "Não sou mãe" não é declaração positiva de maternidade. A negação é
  // retirada antes de procurar a afirmação que vem depois dela.
  const positiva = frase.replace(/\bnao sou (?:a |o )?(?:mae|pai|tia|tio|avo|cuidadora?|responsavel)\b/g, "");
  const palavras: Array<[string, Vinculo]> = [
    ["mae", "mae"], ["pai", "pai"], ["tia", "tia"], ["tio", "tio"],
    ["avo", "avo"], ["cuidadora", "cuidadora"], ["cuidador", "cuidador"],
  ];
  for (const [palavra, vinculo] of palavras) {
    const declaracao = new RegExp(`\\bsou (?:a |o )?${palavra}\\b`);
    if (unicaPessoaCadastrada && declaracao.test(positiva)) return vinculo;
    if (new RegExp(`\\bsou (?:a |o )?${palavra} d[ao] ${nomeEscapado}\\b`).test(positiva)) return vinculo;
    // "Não sou mãe da Lia, sou tia dela" mantém o alvo pela correção na
    // mesma frase. A menção solta de Lia junto de "sou tia da Bia" NÃO basta.
    const correcao = new RegExp(`\\bnao sou (?:a |o )?(?:mae|pai) d[ao] ${nomeEscapado}\\b[^.!?]{0,60}\\bsou (?:a |o )?${palavra} del[ae]\\b`);
    if (correcao.test(frase)) return vinculo;
  }
  // Uma negação isolada revoga a anotação anterior, sem inventar o novo papel.
  if (unicaPessoaCadastrada && /\bnao sou (?:a |o )?(?:mae|pai|tia|tio|avo|cuidadora?)\b/.test(frase)) return "nao_informado";
  if (new RegExp(`\\bnao sou (?:a |o )?(?:mae|pai|tia|tio|avo|cuidadora?) d[ao] ${nomeEscapado}\\b`).test(frase)) return "nao_informado";
  // "Minha filha/sobrinha" não revela se quem escreve é mãe/pai/tia/tio.
  // Esse vínculo fica sem rótulo até a pessoa afirmá-lo explicitamente.
  return null;
}

export function vinculoRelatadoValido(metadata: Record<string, unknown> | null | undefined): VinculoRelatado | null {
  const r = metadata?.vinculo_reportado;
  if (!r || typeof r !== "object") return null;
  const v = r as Partial<VinculoRelatado>;
  if (!v.tipo || (v.tipo !== "nao_informado" && !Object.hasOwn(ROTULOS, v.tipo)) || !v.informada_em || Number.isNaN(Date.parse(v.informada_em))) return null;
  return v as VinculoRelatado;
}

export function rotuloVinculo(vinculo: Vinculo): string {
  return ROTULOS[vinculo];
}
