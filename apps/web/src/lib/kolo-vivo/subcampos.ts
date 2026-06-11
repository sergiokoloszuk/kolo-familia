/**
 * Sub-campos estruturados de um domínio do Kolo Vivo.
 *
 * Para não reescrever o backend (que guarda UM texto por domínio), os
 * sub-campos são serializados no mesmo texto, com rótulos:
 *
 *   Aceita bem: arroz, banana
 *   Rejeita: folhas, carne em pedaço
 *   Texturas & padrões: prefere seco/crocante
 *
 * Assim a IA passa a ver cada dimensão separada, o armazenamento, o contexto e
 * a auto-incorporação continuam iguais, e qualquer domínio pode ganhar campos
 * só declarando-os em DOMINIOS.
 */

export type SubCampo = {
  key: string;
  label: string;
  placeholder?: string;
  /** Quando presente, o campo vira um seletor (chips) em vez de texto livre.
   *  Ex.: Seletividade alimentar → ["Alta", "Média", "Baixa"]. */
  opcoes?: string[];
};

export function serializarSubcampos(
  campos: SubCampo[],
  valores: Record<string, string>,
): string {
  return campos
    .map((c) => {
      const v = (valores[c.key] ?? "").trim();
      return v ? `${c.label}: ${v}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Quebra o texto rotulado de volta nos sub-campos. Texto sem rótulo (legado,
 * digitado livre) cai no último campo, pra não se perder.
 */
export function parsearSubcampos(
  campos: SubCampo[],
  texto: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!texto?.trim()) return out;

  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const buf: Record<string, string[]> = {};
  const legado: string[] = [];
  let atual: string | null = null;

  for (const linha of linhas) {
    const match = campos.find((c) =>
      linha.toLowerCase().startsWith(`${c.label.toLowerCase()}:`),
    );
    if (match) {
      atual = match.key;
      const resto = linha.slice(match.label.length + 1).trim();
      buf[atual] = resto ? [resto] : [];
    } else if (atual) {
      (buf[atual] ??= []).push(linha);
    } else {
      legado.push(linha);
    }
  }

  for (const c of campos) {
    if (buf[c.key]) out[c.key] = buf[c.key].join("\n").trim();
  }

  const textoLegado = legado.join("\n").trim();
  if (textoLegado && campos.length > 0) {
    const ultimo = campos[campos.length - 1].key;
    out[ultimo] = [textoLegado, out[ultimo] ?? ""].filter(Boolean).join("\n").trim();
  }
  return out;
}
