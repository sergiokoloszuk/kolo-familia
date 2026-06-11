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
  /** Campo CONDICIONAL: só aparece se outro campo (geralmente o seletor
   *  inicial) estiver com um dos valores. Ex.: perguntas de fala só se "Como
   *  se comunica" = "Fala frases"/"Fala palavras soltas". */
  mostrarSe?: { campo: string; valores: string[] };
};

/** Filtra os campos que devem aparecer dado o estado atual (condicionais). */
export function camposVisiveis(
  campos: SubCampo[],
  valores: Record<string, string>,
): SubCampo[] {
  return campos.filter((c) => {
    if (!c.mostrarSe) return true;
    const v = (valores[c.mostrarSe.campo] ?? "").trim();
    return c.mostrarSe.valores.includes(v);
  });
}

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
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  sensorial: [
    {
      key: "perfil",
      label: "Perfil sensorial",
      opcoes: ["Hipersensível", "Hipossensível", "Misto"],
      placeholder:
        "Hiper = sente demais e evita · Hipo = sente de menos e busca estímulo · Misto = varia por canal",
    },
    { key: "sons", label: "Reação a sons", placeholder: "Ex: cobre os ouvidos com barulho alto; gosta de música baixa" },
    { key: "toques", label: "Reação a toques", placeholder: "Ex: não gosta de abraços; busca pressão profunda (apertado)" },
    { key: "texturas", label: "Texturas (roupas, objetos)", placeholder: "Ex: evita etiquetas; prefere roupas macias" },
    { key: "luz", label: "Luz", placeholder: "Ex: incomoda-se com luzes fortes" },
    { key: "cheiros", label: "Cheiros", placeholder: "Ex: sensível a perfumes" },
    { key: "movimento", label: "Movimento", placeholder: "Ex: precisa balançar; gosta de ventilador girando" },
    { key: "outras", label: "Outras observações sensoriais", placeholder: "Qualquer outra coisa que você percebe" },
  ],
  comunicacao: [
    // Começa pela forma — e o resto se adapta a ela.
    {
      key: "forma",
      label: "Como se comunica",
      opcoes: ["Fala frases", "Fala palavras soltas", "Não-verbal"],
    },
    {
      key: "mostra",
      label: "Como mostra o que quer",
      placeholder: "aponta, leva pela mão até o objeto, gestos, imagens/CAA, fala",
    },
    {
      key: "entende",
      label: "Como demonstra que entende",
      placeholder: "segue pedidos simples, reage ao nome, precisa de apoio visual, entende mais do que fala",
      mostrarSe: { campo: "forma", valores: ["Fala frases", "Fala palavras soltas"] },
    },
    // Tem alguma fala:
    {
      key: "vocabulario",
      label: "Vocabulário e fala",
      placeholder: "quantas palavras; combina frases; troca/omite letras; gagueira",
      mostrarSe: { campo: "forma", valores: ["Fala frases", "Fala palavras soltas"] },
    },
    {
      key: "ecolalia",
      label: "Ecolalia / repetições",
      placeholder: "repete falas, perguntas ou frases de desenho?",
      mostrarSe: { campo: "forma", valores: ["Fala frases", "Fala palavras soltas"] },
    },
    // Fala fluente:
    {
      key: "conversa",
      label: "Conversa e argumentação",
      placeholder: "mantém o vai-e-vem? resolve problema/negocia/argumenta falando? ou fala bem mas trava nisso? frustra quando não é entendida?",
      mostrarSe: { campo: "forma", valores: ["Fala frases"] },
    },
    // Não-verbal:
    {
      key: "contexto",
      label: "Entende o contexto",
      placeholder: "entende a situação / o que vai acontecer pela rotina e pistas, mesmo sem palavras?",
      mostrarSe: { campo: "forma", valores: ["Não-verbal"] },
    },
    {
      key: "le_labios",
      label: "Lê lábios / pistas visuais",
      placeholder: "presta atenção no rosto e na boca? precisa te ver pra entender?",
      mostrarSe: { campo: "forma", valores: ["Não-verbal"] },
    },
    {
      key: "iniciativa",
      label: "Mostra o que quer ou espera?",
      opcoes: ["Mostra o que quer", "Espera oferecerem", "Varia"],
      mostrarSe: { campo: "forma", valores: ["Não-verbal"] },
    },
    // Não-verbal (ou palavras soltas):
    {
      key: "contato",
      label: "Contato visual e gestos",
      placeholder: "olha quando é chamada? aponta pra mostrar? usa gestos?",
      mostrarSe: { campo: "forma", valores: ["Não-verbal", "Fala palavras soltas"] },
    },
    {
      key: "caa",
      label: "Comunicação alternativa (CAA)",
      placeholder: "usa pranchas, PECS, app de comunicação?",
      mostrarSe: { campo: "forma", valores: ["Não-verbal", "Fala palavras soltas"] },
    },
    {
      key: "outras",
      label: "Outras observações",
      placeholder: "o que ajuda (frases curtas, apoio visual, dar tempo) e qualquer outra coisa que você percebe",
    },
  ],
  socializacao: [
    {
      key: "disposicao",
      label: "Como é socializar pra ele(a)",
      opcoes: ["Busca e curte", "Curte em doses", "Custa / cansa", "Evita"],
    },
    {
      key: "interage",
      label: "Interage com outras pessoas (pares)",
      opcoes: ["Com facilidade", "Às vezes", "Raramente"],
    },
    {
      key: "com_quem",
      label: "Com quem flui melhor",
      opcoes: ["Adultos", "Pares (mesma idade)", "Mais novos", "Indiferente"],
    },
    {
      key: "divide",
      label: "Divide e espera a vez",
      opcoes: ["Sim", "Às vezes", "Custa"],
    },
    {
      key: "sozinho",
      label: "Sozinho ou acompanhado",
      placeholder: "prefere ficar só (por quanto tempo) ou busca companhia?",
    },
    {
      key: "iniciativa",
      label: "Iniciativa e reciprocidade",
      placeholder: "inicia ou espera/responde? interage junto ou fica lado a lado? mantém o vai-e-vem?",
    },
    {
      key: "vinculos",
      label: "Vínculos e conflitos",
      placeholder: "tem amizades/pessoas de referência? como lida com dividir, perder, conflito?",
    },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
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
