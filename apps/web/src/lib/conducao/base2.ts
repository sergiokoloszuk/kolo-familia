import { BASE2, type EstadoConversa, type SecaoBase2 } from "./base2-conteudo";

export type { EstadoConversa, SecaoBase2 };

/**
 * BASE 2 · PERGUNTAS E ORIENTAÇÕES POR TEMA — consulta seletiva.
 *
 * A base responde a **uma** pergunta: *"o que preciso compreender nesta
 * situação antes de orientar?"*. Ela não escolhe atividade nem brincadeira —
 * isso é da BASE 3.
 *
 * O problema que isto resolve: o material aprovado soma ~84 mil caracteres e
 * praticamente não chegava ao modelo. Mandar arquivo inteiro custaria ~21 mil
 * tokens por turno, o que é inviável; então o que se recupera é **seção**, e
 * só a pertinente.
 *
 * ⚠️ ZERO I/O E ZERO CHAMADA DE MODELO. O conteúdo vem de um módulo gerado em
 * build (`base2-conteudo.ts`), e a seleção é determinística. Foi requisito
 * explícito: a BASE 2 enriquece a conversa **sem** criar uma chamada de IA a
 * mais.
 *
 * ⚠️ NÃO INVENTA IDADE. O material é agnóstico de faixa etária por desenho —
 * ele descreve mecanismos. Onde ele já distingue (a seção `IDADE`, por
 * exemplo), a distinção é preservada como o texto que é. Nada de faixa nova.
 */

export type PedidoBase2 = {
  /** Nome do arquivo/skill: aprendizado, foco, autonomia… */
  tema: string;
  /** "leitura", "escrita", "matematica" — quando a conversa já revelou. */
  subtema?: string | null;
  /** O momento da conversa. Sem isto, vem tudo do tema — quase nunca é o que se quer. */
  estado?: EstadoConversa;
  /** Teto de seções. 3 é o padrão: o bloco precisa caber ao lado do resto. */
  limite?: number;
};

/** Temas que a BASE 2 cobre hoje. Fora desta lista, ela não tem material. */
export const TEMAS_BASE2: readonly string[] = [...new Set(BASE2.map((s) => s.tema))].sort();

export function temMaterial(tema: string): boolean {
  return TEMAS_BASE2.includes(tema);
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Peso de uma seção para o pedido. Determinístico e explicável — quem ler o
 * rastro depois consegue reconstruir por que aquela seção entrou.
 *
 * A ordem importa: **subtema bate primeiro**. É o que faz "dificuldade de
 * leitura" chegar ao `LEITURA — MAPA DE RACIOCÍNIO` em vez de à missão do
 * arquivo, que é genérica e sempre casaria.
 */
function pontuar(s: SecaoBase2, p: PedidoBase2): number {
  let n = 0;
  if (p.subtema && s.subtema && norm(s.subtema) === norm(p.subtema)) n += 100;
  else if (p.subtema && norm(s.titulo).includes(norm(p.subtema))) n += 60;
  // Subtema pedido e seção de OUTRO subtema: penaliza, senão o mapa de
  // matemática apareceria numa conversa de leitura só por ser do mesmo tema.
  else if (p.subtema && s.subtema) n -= 50;

  if (p.estado && s.estado === p.estado) n += 30;
  else if (p.estado && s.estado === "contexto") n += 5;
  else if (p.estado) n -= 20;

  // Desempate estável: nível 1 antes de nível 2, e a ordem do arquivo depois.
  if (s.nivel === 1) n += 1;
  return n;
}

/**
 * As seções pertinentes, já ordenadas. Devolve `[]` quando o tema não existe —
 * e **isso é informação**, não erro: significa que a Kolo ainda não tem
 * material de condução para aquele assunto.
 */
export function secoesDe(p: PedidoBase2): SecaoBase2[] {
  const doTema = BASE2.filter((s) => s.tema === p.tema);
  if (doTema.length === 0) return [];
  const comPeso = doTema
    .map((s, i) => ({ s, peso: pontuar(s, p), i }))
    .filter((x) => x.peso > 0)
    .sort((a, b) => b.peso - a.peso || a.i - b.i);
  return comPeso.slice(0, p.limite ?? 3).map((x) => x.s);
}

/** Uma seção específica pelo id estável (`aprendizado/leitura-mapa-de-raciocinio`). */
export function secaoPorId(id: string): SecaoBase2 | null {
  return BASE2.find((s) => s.id === id) ?? null;
}

/**
 * O bloco para o prompt. Traz o título verdadeiro do material — é ele que diz
 * ao modelo que aquilo é mapa de raciocínio e não sugestão pronta.
 *
 * Campo vazio não vira linha, e lista vazia não vira bloco: um cabeçalho
 * seguido de nada ensina o modelo a preencher formulário.
 */
export function blocoBase2(secoes: readonly SecaoBase2[]): string {
  if (secoes.length === 0) return "";
  const itens = secoes.map((s) => `## ${s.titulo}\n${s.conteudo}`).join("\n\n");
  return `<conducao_kolo>
Isto é material de CONDUÇÃO da Kolo — serve pra você COMPREENDER a situação e escolher a próxima pergunta. Não é roteiro, não se cita e não se copia.

- Use pra DIFERENCIAR o que parece igual e decidir o que ainda falta saber.
- Escolha no máximo uma ou duas coisas pra perguntar. O material é largo de propósito; a conversa não é.
- Se o que a família já contou responde uma diferenciação, ela está resolvida — não pergunte de novo.

${itens}
</conducao_kolo>`;
}
