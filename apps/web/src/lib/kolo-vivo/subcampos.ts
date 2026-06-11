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
  /** Quando true, o campo é uma LISTA de itens (bullets). Guardado como
   *  "item1; item2; item3". Ex.: aceita, rejeita, texturas. */
  lista?: boolean;
};

/** Itens de um campo-lista (guardado como "a; b; c" ou em linhas). */
export function splitItens(value: string): string[] {
  return (value ?? "")
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Junta itens em "a; b; c", aparando e removendo duplicados. */
export function joinItens(itens: string[]): string {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const it of itens) {
    const t = (it ?? "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(t);
  }
  return out.join("; ");
}

/**
 * Sub-campos por domínio do Kolo Vivo. Fonte ÚNICA — usada pelo card (UI), pelo
 * extrator de atualizações (IA) e pela gravação. Domínios sem entrada aqui
 * continuam como texto único.
 */
export const SUBCAMPOS_DOMINIO: Record<string, SubCampo[]> = {
  nutricional: [
    {
      key: "seletividade",
      label: "Seletividade alimentar",
      opcoes: ["Alta", "Média", "Baixa"],
      placeholder: "Alta = come poucos alimentos · Média = seletivo, mas aceita variedade · Baixa = come bem",
    },
    { key: "aceita", label: "Aceita bem / preferidos", lista: true, placeholder: "arroz, banana, pão…" },
    { key: "rejeita", label: "Rejeita ou recusa", lista: true, placeholder: "folhas, carne em pedaço…" },
    { key: "texturas_aceita", label: "Texturas que aceita", lista: true, placeholder: "crocante, cremoso…" },
    { key: "texturas_rejeita", label: "Texturas que rejeita", lista: true, placeholder: "pastoso, fibroso…" },
    {
      key: "dificuldades",
      label: "Dificuldades na alimentação",
      placeholder: "Ex: demora muito, distrai fácil, só come no prato dela",
    },
  ],
  sensorial: [
    {
      key: "sensibilidade",
      label: "Sensibilidade sensorial",
      opcoes: ["Alta", "Média", "Baixa"],
      placeholder: "O quanto o sensorial pesa no dia a dia (no geral).",
    },
    { key: "sons", label: "Reação a sons", placeholder: "Ex: cobre os ouvidos com barulho alto; gosta de música baixa" },
    { key: "toques", label: "Reação a toques", placeholder: "Ex: não gosta de abraços; busca pressão profunda (apertado)" },
    { key: "texturas", label: "Texturas (roupas, objetos)", placeholder: "Ex: evita etiquetas; prefere roupas macias" },
    { key: "luz", label: "Luz", placeholder: "Ex: incomoda-se com luzes fortes" },
    { key: "cheiros", label: "Cheiros", placeholder: "Ex: sensível a perfumes" },
    { key: "movimento", label: "Movimento", placeholder: "Ex: precisa balançar; gosta de ventilador girando" },
    { key: "outras", label: "Outras observações sensoriais", placeholder: "Qualquer outra coisa que você percebe" },
  ],
};

/** Domínio tem sub-campos? Devolve a definição ou null. */
export function subcamposDe(campo: string): SubCampo[] | null {
  return SUBCAMPOS_DOMINIO[campo] ?? null;
}

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
