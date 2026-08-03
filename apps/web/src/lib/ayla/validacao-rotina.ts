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
  // Recompensa/suborno — é lógica de reforço, e o método Kolo não usa.
  [
    "instrucao_insegura",
    /\b(se (ele|ela) (fizer|obedecer|terminar|comer)|como premio|de recompensa|ganha (um|uma) )\b/,
  ],
  // Deixar a criança sozinha em situação de risco.
  [
    "instrucao_insegura",
    /\b(sozinh[oa])\b[^.!?]{0,30}\b(banheira|banho|piscina|rua|fogao)\b/,
  ],
];

/** Uma hora plausível? Aceita "7h", "07:30", "7:30". */
const HORA = /^([01]?\d|2[0-3])\s*[:h]?\s*([0-5]\d)?$/;

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

    // HORÁRIO SEM BASE: só checa quando a família não deu base nenhuma de
    // horário. Se ela contou horários, propor um horário vizinho é justamente
    // o que a Ayla deve fazer (e o FORMATO_WHATSAPP manda fazer).
    const h = (t.hora ?? "").trim();
    if (h && !base) {
      falhas.push({ codigo: "horario_sem_base", trecho: `${h} — ${t.texto.slice(0, 80)}` });
    } else if (h && base && HORA.test(h)) {
      const hh = h.replace(/[^\d]/g, "").slice(0, 2);
      // A família falou de ALGUM horário? Se falou, a Ayla pode propor os
      // vizinhos. Se não falou nenhum e mesmo assim veio hora, é invenção.
      if (!/\d\s*[:h]/.test(base) && !base.includes(hh)) {
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
