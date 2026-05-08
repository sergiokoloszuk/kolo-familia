/**
 * DASS-21 — instrumento clínico auto-aplicável (PRD §7.15.3).
 *
 * Itens em PT-BR validados (Vignola & Tucci, 2014). Escala 0-3:
 *   0 = Não se aplicou de maneira alguma
 *   1 = Aplicou-se em algum grau ou por pouco tempo
 *   2 = Aplicou-se em um grau considerável ou por uma boa parte do tempo
 *   3 = Aplicou-se muito ou na maioria do tempo
 *
 * 7 itens por dimensão. Score = soma dos 7. Faixas validadas para
 * o DASS-21 raw (sem multiplicar por 2, como é prática mais recente
 * em PT-BR).
 *
 * IMPORTANTE: este é um termômetro, não um diagnóstico. Quem
 * diagnostica é profissional de saúde. PRD §7.15.3.
 */

export type DASS21Item = {
  numero: number; // 1-21
  texto: string;
  dimensao: "depressao" | "ansiedade" | "estresse";
};

export const DASS21_ITEMS: DASS21Item[] = [
  { numero: 1, dimensao: "estresse", texto: "Achei difícil me acalmar." },
  { numero: 2, dimensao: "ansiedade", texto: "Senti minha boca seca." },
  { numero: 3, dimensao: "depressao", texto: "Não consegui vivenciar nenhum sentimento positivo." },
  { numero: 4, dimensao: "ansiedade", texto: "Tive dificuldade em respirar (ex: respiração ofegante, falta de ar)." },
  { numero: 5, dimensao: "depressao", texto: "Achei difícil ter iniciativa para fazer as coisas." },
  { numero: 6, dimensao: "estresse", texto: "Tive a tendência de reagir em demasia às situações." },
  { numero: 7, dimensao: "ansiedade", texto: "Senti tremores (por exemplo, nas mãos)." },
  { numero: 8, dimensao: "estresse", texto: "Senti que estava sempre nervoso." },
  { numero: 9, dimensao: "ansiedade", texto: "Preocupei-me com situações em que eu pudesse entrar em pânico." },
  { numero: 10, dimensao: "depressao", texto: "Senti que não tinha nada a desejar." },
  { numero: 11, dimensao: "estresse", texto: "Senti-me agitado." },
  { numero: 12, dimensao: "estresse", texto: "Achei difícil relaxar." },
  { numero: 13, dimensao: "depressao", texto: "Senti-me depressivo e sem ânimo." },
  { numero: 14, dimensao: "estresse", texto: "Fui intolerante com as coisas que me impediam de continuar o que estava fazendo." },
  { numero: 15, dimensao: "ansiedade", texto: "Senti que estava prestes a entrar em pânico." },
  { numero: 16, dimensao: "depressao", texto: "Não consegui me entusiasmar com nada." },
  { numero: 17, dimensao: "depressao", texto: "Senti que eu não tinha valor como pessoa." },
  { numero: 18, dimensao: "estresse", texto: "Senti que eu estava um tanto sensível." },
  { numero: 19, dimensao: "ansiedade", texto: "Sabia da batida do meu coração mesmo sem ter feito esforço físico." },
  { numero: 20, dimensao: "ansiedade", texto: "Senti medo sem motivo." },
  { numero: 21, dimensao: "depressao", texto: "Senti que a vida não tinha sentido." },
];

export const DASS21_ESCALA = [
  { valor: 0, label: "Não se aplicou de maneira alguma" },
  { valor: 1, label: "Aplicou-se em algum grau ou por pouco tempo" },
  { valor: 2, label: "Aplicou-se em um grau considerável ou por uma boa parte do tempo" },
  { valor: 3, label: "Aplicou-se muito ou na maioria do tempo" },
] as const;

export type DASS21Faixa =
  | "normal"
  | "leve"
  | "moderada"
  | "severa"
  | "extremamente_severa";

export type DASS21Resultado = {
  scores: { depressao: number; ansiedade: number; estresse: number };
  faixas: { depressao: DASS21Faixa; ansiedade: DASS21Faixa; estresse: DASS21Faixa };
  algumaSevera: boolean;
  algumaModeradaOuPior: boolean;
};

/**
 * Calcula scores e faixas. Espera array de 21 valores 0-3 na ordem
 * do item (índice 0 = item 1).
 */
export function calcularDASS21(respostas: number[]): DASS21Resultado {
  if (respostas.length !== 21) {
    throw new Error("DASS-21 espera exatamente 21 respostas.");
  }

  let dep = 0;
  let ans = 0;
  let est = 0;

  for (const item of DASS21_ITEMS) {
    const v = respostas[item.numero - 1];
    if (typeof v !== "number" || v < 0 || v > 3) {
      throw new Error(`Resposta inválida no item ${item.numero}: ${v}`);
    }
    if (item.dimensao === "depressao") dep += v;
    else if (item.dimensao === "ansiedade") ans += v;
    else est += v;
  }

  const faixas = {
    depressao: faixaDepressao(dep),
    ansiedade: faixaAnsiedade(ans),
    estresse: faixaEstresse(est),
  };

  const algumaSevera =
    isSeveraOuPior(faixas.depressao) ||
    isSeveraOuPior(faixas.ansiedade) ||
    isSeveraOuPior(faixas.estresse);
  const algumaModeradaOuPior =
    isModeradaOuPior(faixas.depressao) ||
    isModeradaOuPior(faixas.ansiedade) ||
    isModeradaOuPior(faixas.estresse);

  return {
    scores: { depressao: dep, ansiedade: ans, estresse: est },
    faixas,
    algumaSevera,
    algumaModeradaOuPior,
  };
}

function faixaDepressao(s: number): DASS21Faixa {
  if (s <= 4) return "normal";
  if (s <= 6) return "leve";
  if (s <= 10) return "moderada";
  if (s <= 13) return "severa";
  return "extremamente_severa";
}

function faixaAnsiedade(s: number): DASS21Faixa {
  if (s <= 3) return "normal";
  if (s <= 5) return "leve";
  if (s <= 7) return "moderada";
  if (s <= 9) return "severa";
  return "extremamente_severa";
}

function faixaEstresse(s: number): DASS21Faixa {
  if (s <= 7) return "normal";
  if (s <= 9) return "leve";
  if (s <= 12) return "moderada";
  if (s <= 16) return "severa";
  return "extremamente_severa";
}

function isSeveraOuPior(f: DASS21Faixa): boolean {
  return f === "severa" || f === "extremamente_severa";
}

function isModeradaOuPior(f: DASS21Faixa): boolean {
  return f === "moderada" || isSeveraOuPior(f);
}

export const FAIXA_LABEL: Record<DASS21Faixa, string> = {
  normal: "Normal",
  leve: "Leve",
  moderada: "Moderada",
  severa: "Severa",
  extremamente_severa: "Extremamente severa",
};

export const FAIXA_INTERPRETACAO: Record<DASS21Faixa, string> = {
  normal: "Esta dimensão está dentro do esperado.",
  leve: "Sinais leves apareceram esta semana — vale ficar atenta.",
  moderada:
    "Sinais com mais intensidade que o usual. Vale conversar com profissional de saúde mental.",
  severa:
    "Sinais fortes esta semana. Recomendamos buscar profissional de saúde mental — o termômetro indica que vale apoio agora.",
  extremamente_severa:
    "Sinais muito intensos. Buscar profissional de saúde mental é importante. Em emergência: CVV 188 (24h, gratuito).",
};
