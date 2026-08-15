import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * MEMÓRIA LONGITUDINAL NO EXPERIMENTAL — 15/08/2026, Fase 1.
 *
 * ⚠️ O ACHADO QUE ORIGINOU ISTO. `eventos_membro` é escrito desde sempre por
 * `eventos.ts` e PROVEI que NINGUÉM o lê para conversar: os únicos leitores são
 * a própria dedup da escrita e `relatorio/gerar.ts`. São 30 eventos reais em
 * produção — incluindo "Progrediu no aprendizado de letras, atingindo a letra
 * G" e uma separação em curso — e a Ayla nunca viu nenhum.
 *
 * ⚠️ POR QUE NÃO EXISTE CORTE FIXO DE 60 DIAS. Um prazo global trata "viagem no
 * fim de semana" e "começou a formar frases" como a mesma coisa. A relevância
 * aqui é por NATUREZA (o tipo do evento) e por ASSUNTO (o que a mãe está
 * falando agora) — e o tempo só entra onde ele de fato significa algo.
 *
 * ⚠️ E NÃO ENTRA CHAMADA DE MODELO. Selecionar memória com LLM colocaria uma
 * segunda chamada no caminho crítico, que é o que esta frente inteira existe
 * para evitar. A seleção é determinística e barata.
 */

export type Evento = {
  data: string | null;
  tipo: string;
  descricao: string;
  created_at?: string;
};

/**
 * MARCO E REGRESSÃO SÃO ESTADO, NÃO NOTÍCIA.
 *
 * "Progrediu até a letra G" descreve onde a criança CHEGOU — continua verdade
 * meses depois e ajuda a Ayla a não subestimá-la. Por isso entram sempre,
 * independentemente de data.
 */
const SEMPRE_RELEVANTES = new Set(["marco", "regressao"]);

/**
 * EVENTOS QUE DESCREVEM UMA SITUAÇÃO EM CURSO.
 *
 * Uma troca de escola ou o início de uma terapia continuam valendo enquanto a
 * adaptação acontece — mas não para sempre. Entram quando recentes OU quando o
 * assunto do turno os traz de volta.
 */
const EM_ANDAMENTO = new Set([
  "mudanca_escola",
  "mudanca_turma",
  "troca_professora",
  "inicio_terapia",
  "medicacao",
  "mudanca_rotina",
]);

/**
 * ⚠️ EVENTOS SENSÍVEIS — só entram quando o ASSUNTO os torna pertinentes.
 *
 * Uma separação em curso pode explicar muita coisa do comportamento de uma
 * criança, e escondê-la da Ayla empobrece a ajuda. Mas mandá-la em TODO turno é
 * outra coisa: numa pergunta sobre a letra G, ela não acrescenta nada e convida
 * o modelo a inventar causalidade sobre a vida da família.
 */
const SENSIVEIS = new Set(["separacao", "perda_familiar"]);

/** Palavras que ligam um assunto a um tipo de evento. Sem IA, de propósito. */
const ASSUNTO_POR_TIPO: Record<string, RegExp> = {
  separacao:
    /\bseparaç|divórcio|divorcio|pai (dele|dela|saiu|foi embora)|mãe (saiu|foi embora)|casa do pai|casa da mãe|grudad|apegad|carente|chorando quando|medo de (me )?perder|inseguran|abandono|ansiedade de separa/i,
  perda_familiar: /\bperd|faleceu|morreu|luto|saudade|morte\b/i,
  mudanca_escola: /\bescola|adaptaç|turma|professor|colég|creche|sala nova/i,
  mudanca_turma: /\bturma|sala|professor|colega/i,
  troca_professora: /\bprofessor|escola|turma|adaptaç/i,
  inicio_terapia: /\bterapia|fono|psicó|psico|to\b|terapeuta|sessão|atendimento/i,
  medicacao: /\bremédio|remedio|medica|dose|receita|psiquiatr|sono|apetite|irritab/i,
  mudanca_rotina: /\brotina|hor[áa]rio|mudou|mudança|adaptaç|transiç/i,
  ferias: /\bférias|viagem|viajar|passeio|final de semana|fim de semana/i,
};

/** Dias desde o evento — pela data informada, ou pelo registro. */
function diasAtras(e: Evento): number | null {
  const iso = e.data ?? e.created_at ?? null;
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function assuntoBate(tipo: string, texto: string): boolean {
  const re = ASSUNTO_POR_TIPO[tipo];
  return re ? re.test(texto) : false;
}

/**
 * QUAIS EVENTOS ENTRAM NESTE TURNO.
 *
 * A regra, por natureza:
 *   · marco/regressão ............ sempre (é estado, não notícia)
 *   · sensível ................... SÓ se o assunto do turno o tornar pertinente
 *   · em andamento ............... se recente (≤120d) OU o assunto trouxer
 *   · o resto (férias, outro) .... só se o assunto trouxer E for recente (≤30d)
 *
 * ⚠️ Quando não há relação confiável, o evento NÃO entra. Preferimos perder um
 * contexto útil a poluir a conversa e convidar o modelo a inventar causa.
 */
export function eventosRelevantes(
  eventos: Evento[],
  textoDoTurno: string,
  limite = 4,
): Evento[] {
  const escolhidos: Evento[] = [];
  for (const e of eventos) {
    const tipo = (e.tipo ?? "outro").trim();
    const dias = diasAtras(e);
    const bate = assuntoBate(tipo, textoDoTurno);

    let entra = false;
    if (SEMPRE_RELEVANTES.has(tipo)) entra = true;
    else if (SENSIVEIS.has(tipo)) entra = bate;
    else if (EM_ANDAMENTO.has(tipo)) entra = bate || dias == null || dias <= 120;
    else entra = bate && (dias == null || dias <= 30);

    if (entra) escolhidos.push(e);
  }
  // Mais recentes primeiro; marcos empatam por data de registro.
  escolhidos.sort((a, b) => String(b.data ?? b.created_at ?? "").localeCompare(String(a.data ?? a.created_at ?? "")));
  return escolhidos.slice(0, limite);
}

export async function lerEventos(
  supabase: SupabaseClient,
  familyId: string,
  membroIds: string[],
): Promise<Evento[]> {
  if (!membroIds.length) return [];
  try {
    const { data } = await supabase
      .from("eventos_membro")
      .select("data, tipo, descricao, created_at, membro_atipico_id")
      .eq("family_account_id", familyId)
      .in("membro_atipico_id", membroIds)
      .order("data", { ascending: false })
      .limit(30);
    return ((data ?? []) as Evento[]).filter((e) => (e.descricao ?? "").trim());
  } catch {
    return [];
  }
}

/**
 * O BLOCO — com a ressalva de causalidade colada nele.
 *
 * ⚠️ A ressalva NÃO é decorativa. Dois fatos existirem ao mesmo tempo não faz
 * um causar o outro, e a Ayla não observou nenhuma das duas coisas. Dizer "ela
 * está assim POR CAUSA da separação" seria afirmar sobre a vida de uma família
 * a partir de uma coincidência de datas.
 */
export function blocoDeEventos(eventos: Evento[]): string {
  if (!eventos.length) return "";
  const linhas = eventos.map((e) => `- ${e.data ?? "(sem data)"}: ${e.descricao}`);
  return `<trajetoria>
${linhas.join("\n")}
Isto é a linha do tempo registrada. Use como contexto quando ajudar a compreender a criança. NÃO afirme que um comportamento é causado por um destes fatos — eles apenas aconteceram, e você não observou nenhum deles.
</trajetoria>`;
}
