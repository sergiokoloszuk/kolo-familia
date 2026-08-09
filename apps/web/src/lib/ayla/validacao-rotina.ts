/**
 * O PORTÃO DA ROTINA — o que não pode ser publicado.
 *
 * Roda DEPOIS da montagem e ANTES de gravar, gerar PDF e mandar link. É a
 * segunda linha de defesa da rotina, e ela não existia: até 03/08/2026 o texto
 * que o condutor produzia ia direto pro banco e pro PDF, sem ninguém olhar.
 *
 * POR QUE NÃO REUSA O PISO DA CONVERSA. Uma resposta de conversa pode ser
 * regenerada e, no pior caso, substituída por um piso que ainda é uma resposta
 * de verdade. Uma rotina não: ela vira linhas numa tabela, cartões ilustrados e
 * um PDF que a família imprime e cola na parede. Não existe "piso" de rotina —
 * ou ela está boa, ou não se publica. O comportamento em falha é a Ayla
 * CONVERSAR (organizar o que dá, devolver a parte clínica a quem acompanha),
 * nunca publicar uma versão degradada.
 *
 * E é deliberadamente DETERMINÍSTICO: são tarefas curtas, escritas por um
 * modelo, num formato conhecido. Regex aqui é честно — não precisa de outra
 * chamada de modelo pra ver que "mamar de 3 em 3 horas" tem um intervalo dentro.
 */

export type FalhaRotina = {
  codigo: "manejo_clinico" | "horario_sem_base" | "instrucao_insegura";
  trecho: string;
};

/** Normaliza pra casar sem depender de acento nem de caixa. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * MANEJO CLÍNICO dentro de uma tarefa.
 *
 * O alvo é o ATO de decidir manejo, não a palavra "mamar". "Mamar" numa
 * sequência é organização legítima e passa; "mamar de 3 em 3 horas" decide
 * intervalo, e não passa.
 */
const MANEJO: ReadonlyArray<[FalhaRotina["codigo"], RegExp]> = [
  // Intervalo/frequência de alimentação: "de 2 em 2 horas", "a cada 3 horas".
  [
    "manejo_clinico",
    /\b(mamar|mamada|mamadas|amamentar|peito|mama|formula|leite|refeicao|comer)\b[^.!?]{0,60}\b(de \d+ em \d+|a cada \d+|\d+ *\/ *\d+|\d+ em \d+)\b/,
  ],
  [
    "manejo_clinico",
    /\b(de \d+ em \d+|a cada \d+)\s*(h|hora|horas|min|minutos)\b[^.!?]{0,60}\b(mamar|mamada|amamentar|peito|leite|formula)\b/,
  ],
  // Duração no peito / quantidade.
  [
    "manejo_clinico",
    /\b(esvaziar|esvazie|drenar)\b[^.!?]{0,40}\b(peito|seio|mama)\b/,
  ],
  [
    "manejo_clinico",
    /\b(peito|seio|mama|mamadeira)\b[^.!?]{0,40}\b(por|durante|uns?|cerca de)\s*\d+\s*(min|minutos|h|horas)\b/,
  ],
  [
    "manejo_clinico",
    /\b(\d+\s*(ml|mililitros|onças?)|quantos ml)\b/,
  ],
  // Acordar pra comer / não deixar dormir — decisão clínica clássica.
  [
    "manejo_clinico",
    /\b(acordar?|acorde|despertar|nao deixe? dormir)\b[^.!?]{0,50}\b(pra|para)\b[^.!?]{0,20}\b(mamar|comer|mamada|amamentar)\b/,
  ],
  // Complemento/fórmula como decisão.
  [
    "manejo_clinico",
    /\b(complement(ar|o)|oferecer formula|introduzir formula|dar formula|desmamar)\b/,
  ],
  // Medicação: dose, horário, ajuste.
  [
    "manejo_clinico",
    /\b(remedio|medicamento|medicacao|comprimido|gotas?|dose|mg|ml)\b[^.!?]{0,40}\b(dar|tomar|administrar|aumentar|diminuir|ajustar|antes de|depois de)\b/,
  ],
  [
    "manejo_clinico",
    /\b(dar|tomar|administrar)\b[^.!?]{0,30}\b(remedio|medicamento|medicacao|dose|gotas?)\b/,
  ],
];

const INSEGURO: ReadonlyArray<[FalhaRotina["codigo"], RegExp]> = [
  // Materiais e situações que o PISO já proíbe — aqui viram bloqueio de
  // publicação, porque numa rotina isso fica pendurado na parede.
  [
    "instrucao_insegura",
    /\b(faca|tesoura|agulha|isqueiro|fosforo|fogao aceso|panela quente|ferro de passar|tomada|produto de limpeza|alvejante|remedio ao alcance)\b/,
  ],
  // SUBORNO — coisa dada em troca de OBEDECER. Não é "toda menção a ganhar".
  //
  // O padrão anterior era largo demais e barrava justamente o que a Kolo quer
  // produzir. Medido em 09/08/2026, ele bloqueava "cada conta resolvida ganha
  // uma peça da nave", "cada palavra encontrada ganha um fóssil" e "se ele
  // terminar antes, sobra tempo pra brincar" — uma mecânica de brincadeira,
  // uma missão lúdica e uma consequência natural. Três falsos positivos para
  // dois bloqueios legítimos.
  //
  // A diferença não está na palavra "ganha": está no que se compra. Objeto
  // trocado por obediência é suborno; a peça da nave que aparece dentro da
  // própria brincadeira é a brincadeira.
  [
    "instrucao_insegura",
    /(como premio por|de recompensa por|em troca de (obed|bom comportamento)|se (ele|ela) (obedecer|se comportar|ficar quietin)|ganha \w+ se (ele|ela))/,
  ],
  // Deixar a criança sozinha em situação de risco.
  [
    "instrucao_insegura",
    /\b(sozinh[oa])\b[^.!?]{0,30}\b(banheira|banho|piscina|rua|fogao)\b/,
  ],
];

/** Uma hora plausível? Aceita "7h", "07:30", "7:30". */
const HORA = /^([01]?\d|2[0-3])\s*[:h]?\s*([0-5]\d)?$/;

const POR_EXTENSO: Record<string, number> = {
  uma: 1, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8,
  nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
  // Dezenas — "meio dia e QUARENTA" era o caso real que escapava.
  trinta: 30, quarenta: 40, cinquenta: 50, "cinquenta e cinco": 55,
  "vinte e cinco": 25, "trinta e cinco": 35, "quarenta e cinco": 45,
};

/**
 * TODAS AS HORAS QUE A FAMÍLIA MENCIONOU, em minutos desde a meia-noite.
 *
 * Existe porque a primeira versão só procurava dígitos, e barrou uma rotina
 * inteira que estava CERTA: a mãe escreveu "ele chega meio dia e quarenta" e
 * "terça e quinta tem futebol as 3 e meia", o gerador normalizou pra 12h40 e
 * 15h30, e o validador chamou os dois de horário inventado. Punia justamente
 * quem se explicou bem.
 *
 * Mães escrevem hora como falam. Quem tem que entender é o código.
 */
export function horasMencionadas(texto: string): number[] {
  const t = norm(texto);
  const achados: number[] = [];
  const pm = (h: number, tarde: boolean) => (tarde && h < 12 ? h + 12 : h);

  // 12h40 · 15:30 · 8h · 07:05
  for (const m of t.matchAll(/\b([01]?\d|2[0-3])\s*[:h]\s*([0-5]\d)?\b/g)) {
    achados.push(Number(m[1]) * 60 + Number(m[2] ?? 0));
  }
  // meio-dia / meia-noite (com ou sem "e quarenta")
  for (const m of t.matchAll(/\bmeio ?dia(\s*e\s*(\w+))?/g)) {
    achados.push(12 * 60 + minutosDe(m[2]));
  }
  for (const m of t.matchAll(/\bmeia ?noite(\s*e\s*(\w+))?/g)) {
    achados.push(minutosDe(m[2]));
  }
  // "as 3 e meia", "sete da manhã", "oito e quinze", "por volta das seis"
  const NUM = "(\\d{1,2}|" + Object.keys(POR_EXTENSO).join("|") + ")";
  const re = new RegExp(
    `\\b(?:as|às|pras|pra|por volta d[ae]s?|umas|la pelas)?\\s*${NUM}` +
      `(?:\\s*e\\s*(\\w+))?\\s*(?:d[ao]\\s*(manha|tarde|noite))?\\b`,
    "g",
  );
  for (const m of t.matchAll(re)) {
    const h = /^\d+$/.test(m[1]) ? Number(m[1]) : POR_EXTENSO[m[1]];
    if (h == null || h > 23) continue;
    const periodo = m[3];
    // Sem período e sem "e X", um número solto é ruído ("3 vezes", "2 filhos").
    if (!periodo && !m[2]) continue;
    const mm = minutosDe(m[2]);
    if (periodo) {
      achados.push(pm(h, periodo === "tarde" || periodo === "noite") * 60 + mm);
    } else if (h <= 12) {
      // Relógio de 12 horas sem período: "as 3 e meia" pode ser 3h30 ou 15h30, e
      // a família não disse. Como isto é um VALIDADOR (não um parser), as duas
      // leituras viram âncora — barrar por ambiguidade puniria quem falou
      // normal. Quem decide qual é a certa é o gerador, com o resto do dia.
      achados.push(h * 60 + mm, (h + 12) * 60 + mm);
    } else {
      achados.push(h * 60 + mm);
    }
  }
  return [...new Set(achados)].sort((a, b) => a - b);
}

function minutosDe(palavra: string | undefined): number {
  if (!palavra) return 0;
  const p = norm(palavra);
  if (p === "meia") return 30;
  if (/^\d{1,2}$/.test(p)) return Number(p) <= 59 ? Number(p) : 0;
  const n = POR_EXTENSO[p];
  return n != null && n <= 59 ? n : 0;
}

/** "14h15" → minutos. null quando não é hora. */
function emMinutos(hora: string): number | null {
  const m = norm(hora).match(/^([01]?\d|2[0-3])\s*[:h]?\s*([0-5]\d)?$/);
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : null;
}

export type TarefaParaValidar = { texto: string; hora?: string | null };

/**
 * Valida as tarefas de uma rotina antes de publicar.
 *
 * `baseDeHorarios` é o que a família de fato contou (a conversa + a rotina que
 * já existe). Um horário que não aparece em lugar nenhum foi inventado — e
 * horário inventado numa rotina impressa é pior que ausência de horário, porque
 * a família tenta cumprir.
 */
export function validarRotina(params: {
  tarefas: readonly TarefaParaValidar[];
  baseDeHorarios?: string;
}): { ok: boolean; falhas: FalhaRotina[] } {
  const falhas: FalhaRotina[] = [];
  const base = norm(params.baseDeHorarios ?? "");

  for (const t of params.tarefas) {
    const n = norm(t.texto ?? "");
    if (!n) continue;

    for (const [codigo, re] of [...MANEJO, ...INSEGURO]) {
      if (re.test(n)) {
        falhas.push({ codigo, trecho: t.texto.slice(0, 120) });
        break; // um achado por tarefa basta pra barrar
      }
    }

    // HORÁRIO SEM BASE — a política de produto, não uma regra de sintaxe:
    //   fornecido pela família        → passa
    //   derivável entre duas âncoras  → passa (é o que a Ayla deve fazer)
    //   fora disso                    → inventado, barra
    const h = (t.hora ?? "").trim();
    const min = h ? emMinutos(h) : null;
    if (h && min != null) {
      const ancoras = horasMencionadas(params.baseDeHorarios ?? "");
      const bate = ancoras.some((a) => Math.abs(a - min) <= 5);
      // Entre a primeira e a última âncora, a Ayla está encaixando etapas num
      // intervalo que a própria família delimitou. Fora dele, inventou.
      const dentro =
        ancoras.length >= 2 && min >= ancoras[0] && min <= ancoras[ancoras.length - 1];
      if (!bate && !dentro) {
        falhas.push({ codigo: "horario_sem_base", trecho: `${h} — ${t.texto.slice(0, 80)}` });
      }
    }
  }

  return { ok: falhas.length === 0, falhas };
}

/** Resumo legível pro log — nunca vai pra família. */
export function resumirFalhas(falhas: readonly FalhaRotina[]): string {
  return falhas.map((f) => `${f.codigo}:"${f.trecho}"`).join(" | ");
}
