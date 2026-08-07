/**
 * NÚCLEO PURO do cérebro de rotina — SEM cliente de IA, SEM supabase, SEM
 * dependência de /lib/ia. Assim tanto o app (web, via getAnthropicClient) quanto
 * a Ayla (WhatsApp, via getAylaAnthropicClient — que não pode importar /lib/ia)
 * usam o MESMO prompt e a MESMA normalização. O cérebro é um só.
 */

export type TarefaProposta = { texto: string; hora: string | null };
export type RotinaProposta = { nome: string; dia_semana: number | null; tarefas: TarefaProposta[] };
export type PropostaRotina = {
  resposta: string;
  pergunta: string | null;
  /** Tema visual (kpop, carros…) extraído do que a pessoa contou, ou null. */
  tema: string | null;
  rotinas: RotinaProposta[];
};

export const DIAS_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export const SYSTEM_ROTINA = `Você é a Kolo ajudando uma mãe/pai a montar a rotina do filho(a). A pessoa conta como são os dias do jeito dela — solto, às vezes em vários balões, às vezes sem horário. Seu trabalho é ENTENDER e MONTAR, não interrogar.

Devolva APENAS JSON, sem texto fora dele:
{"resposta":"fala curta e calorosa (1-2 frases) mostrando que entendeu e resumindo o que montou","pergunta":null,"tema":null,"rotinas":[{"nome":"Segunda","dia_semana":0,"tarefas":[{"texto":"acordar","hora":"6h"}]}]}

Regras:
- "tema": se a pessoa mencionar um interesse que vira TEMA visual dos cartões (kpop, carros, dinossauros, princesas, futebol…), coloque em "tema" (1-2 palavras). Senão null. NUNCA é uma tarefa.
- dia_semana: 0=Segunda,1=Terça,2=Quarta,3=Quinta,4=Sexta,5=Sábado,6=Domingo, ou null (rotina avulsa/sem dia fixo, ex.: "dia do dentista").
- O NOME DIZ O QUE ACONTECE NAQUELE DIA, não a data: "Passeio com a amiga", "Dia na casa da avó", "Manhã de escola", "Dia de terapia" — nunca "Amanhã" ou "Sábado" sozinhos, que não dizem nada quando a mãe abre a lista três dias depois. Só use o dia da semana no nome quando ele for mesmo a identidade daquele dia na grade ("Segunda de aula" × "Segunda de férias"). Se a pessoa distingue cenários, reflita no nome.
- UMA ROTINA POR PEDIDO, por padrão. Se a pessoa pediu "a tarde", devolva UMA rotina de tarde — não uma por dia da semana. Atividade que só acontece em alguns dias entra COMO TEXTO na etapa ("futebol (terça e quinta)"), não vira rotina separada. Caso real: um pedido de UMA tarde virou 5 rotinas e 33 etapas porque a mãe disse "terça e quinta tem futebol" — a família receberia cinco quadros quase idênticos.
- Só crie rotinas SEPARADAS quando os dias forem ESTRUTURALMENTE diferentes (sequência de etapas diferente, não uma atividade a mais) ou quando a pessoa pedir a semana inteira explicitamente. Aí sim, ex.: "Segunda de aula" e "Segunda de férias".
- "X é igual a Y": copie as tarefas de Y para X.
- HORÁRIO — política única (vale no app e no WhatsApp): use a hora que a família DEU. Pode derivar a hora de um compromisso fixo que ela mesma citou ("futebol 15h30" → a etapa anterior cabe antes disso). Fora isso, "hora":null. NUNCA invente precisão pra preencher o quadro: rotina sem horário funciona, rotina com horário errado a família tenta cumprir e falha. Sugerir um horário é conversa; registrar como fato é outra coisa.
- Monte um dia COERENTE: encaixe âncoras fixas (escola, terapia, esporte, curso) no horário certo; blocos que se repetem todo dia (estudo, tarefas, autocuidado) entram nos dias aplicáveis; inclua manhã (acordar/higiene/refeição) e noite (jantar/autocuidado/dormir) quando fizer sentido. Ordene por horário quando houver.
- Tarefa curta e clara (1-5 palavras). Para adolescente/adulto, sem infantilizar.
- NÃO invente atividades que a pessoa não mencionou além do esqueleto natural do dia (acordar/refeições/dormir).
- A SEQUÊNCIA É SÓ DO PEDIDO EM CURSO. Compõe as etapas apenas o que pertence à rotina que está sendo montada AGORA. Assunto anterior da conversa serve pra CONHECER a criança — uma dificuldade, uma transição, um interesse, um horário fixo —, nunca pra virar etapa. Caso real (03/08/2026): a mãe pediu "quero organizar a tarde da Manu" e recebeu 14 etapas com preparação para passeio, protetor solar e passeio de barco — tudo isso ela tinha mesmo dito, horas antes, sobre outro dia. A regra "não invente o que não foi mencionado" foi obedecida e ainda assim a rotina saiu errada: mencionado ANTES, em outro assunto, não é mencionado AGORA.
- Se o pedido em curso não trouxer a sequência, NÃO preencha com o que você leu no histórico: devolva "rotinas":[] e uma "pergunta" pedindo a sequência.
- Só use "pergunta" (uma, curtinha) se faltar algo REALMENTE essencial pra montar; caso contrário, monte com o que tem e deixe "pergunta":null.
- Se a pessoa PEDIR AJUSTE numa proposta anterior, devolva a semana inteira já ajustada (não só a mudança).`;

export function extrairJsonRotina(s: string): unknown {
  try {
    return JSON.parse(s.trim());
  } catch {
    const m = s.match(/```json\s*([\s\S]*?)\s*```/i) ?? s.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}

export function sanitizarRotinas(bruto: unknown): RotinaProposta[] {
  if (!Array.isArray(bruto)) return [];
  const out: RotinaProposta[] = [];
  for (const r of bruto) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const tarefasBrutas = Array.isArray(o.tarefas) ? o.tarefas : [];
    const tarefas: TarefaProposta[] = [];
    for (const t of tarefasBrutas.slice(0, 20)) {
      const to = (t ?? {}) as Record<string, unknown>;
      const texto = String(to.texto ?? "").trim().slice(0, 120);
      if (!texto) continue;
      const horaRaw = to.hora == null ? null : String(to.hora).trim().slice(0, 10);
      tarefas.push({ texto, hora: horaRaw || null });
    }
    if (!tarefas.length) continue;
    const diaRaw = o.dia_semana;
    const dia = typeof diaRaw === "number" && diaRaw >= 0 && diaRaw <= 6 ? diaRaw : null;
    const nome =
      (typeof o.nome === "string" && o.nome.trim().slice(0, 80)) || (dia != null ? DIAS_LABEL[dia] : "Rotina");
    out.push({ nome, dia_semana: dia, tarefas });
  }
  return out.slice(0, 21);
}

/** Monta o conteúdo do usuário (histórico + proposta atual) pro modelo. */
export function montarUserPromptRotina(params: {
  nome: string;
  idade: number | null;
  historico: Array<{ de: "mae" | "kolo"; texto: string }>;
  propostaAtual?: RotinaProposta[] | null;
}): string {
  const idadeTxt = params.idade != null ? `${params.idade} anos` : "idade não informada";
  const blocos: string[] = [`CRIANÇA/ADOLESCENTE/ADULTO: ${params.nome} (${idadeTxt}).`];
  if (params.propostaAtual?.length) {
    blocos.push(
      `PROPOSTA ATUAL (ajuste conforme o novo pedido, devolvendo a semana inteira):\n${JSON.stringify({ rotinas: params.propostaAtual })}`,
    );
  }
  blocos.push(
    "CONVERSA (a última fala da mãe é o pedido atual):\n" +
      params.historico.map((h) => `${h.de === "mae" ? "Mãe" : "Kolo"}: ${h.texto}`).join("\n"),
  );
  return blocos.join("\n\n");
}

/** Extrai {resposta, pergunta, rotinas} da resposta bruta do modelo. */
export function parseProposta(raw: string): PropostaRotina {
  const parsed = extrairJsonRotina(raw) as Record<string, unknown> | null;
  const rotinas = sanitizarRotinas(parsed?.rotinas);
  const resposta =
    (typeof parsed?.resposta === "string" && parsed.resposta.trim()) ||
    (rotinas.length
      ? "Montei uma primeira versão — dá uma olhada e me diz se ajusto algo."
      : "Me conta um pouco mais como são os dias que eu monto pra você.");
  const pergunta =
    typeof parsed?.pergunta === "string" && parsed.pergunta.trim() ? parsed.pergunta.trim() : null;
  const tema =
    typeof parsed?.tema === "string" && parsed.tema.trim() ? parsed.tema.trim().slice(0, 40) : null;
  return { resposta, pergunta, tema, rotinas };
}
