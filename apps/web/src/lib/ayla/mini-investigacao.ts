import type { PerfilConsultavel } from "@/lib/kolo-vivo/consultar";

/**
 * Excecao estreita ao padrao "ajudar + no maximo uma pergunta".
 *
 * A decisao e deterministica e vem DEPOIS da leitura do Perfil. O modelo nao
 * recebe uma lista de campos vazios para escolher: recebe, quando todas as
 * guardas passam, somente as 2-3 perguntas que mudam juntas a orientacao.
 */
export const CHAVES_MINI_INVESTIGACAO = [
  "alimentacao.aceita",
  "alimentacao.reacao_novo",
  "alimentacao.sensorial",
  "regulacao.antes",
  "regulacao.ajuda_piora",
  "regulacao.comunicacao",
  "atividade.compreende",
  "atividade.inicia",
  "atividade.sustenta",
  "comunicacao.forma",
  "comunicacao.mostra",
  "comunicacao.entende",
] as const;

export type ChaveMiniInvestigacao = (typeof CHAVES_MINI_INVESTIGACAO)[number];
export type TemaMiniInvestigacao = "alimentacao" | "regulacao" | "atividade" | "comunicacao";

/**
 * Portao comportamental de 24/09/2026. A/B com modelo real aprovou somente
 * alimentacao e atividade. Regulacao e comunicacao produziram boas respostas,
 * mas nao significativamente melhores que a pergunta unica; por isso ficam no
 * padrao anterior ate nova evidencia, mesmo com o mapa de perguntas mantido.
 */
const TEMAS_APROVADOS = new Set<TemaMiniInvestigacao>(["alimentacao", "atividade"]);

export type MiniInvestigacao =
  | {
      acao: "PERGUNTAR";
      tema: TemaMiniInvestigacao;
      campos: ChaveMiniInvestigacao[];
      perguntas: string[];
      motivo: string;
    }
  | {
      acao: "ORIENTAR";
      tema: TemaMiniInvestigacao;
      campos: ChaveMiniInvestigacao[];
      perguntas: [];
      motivo: string;
    }
  | { acao: "NAO_USAR"; tema: null; campos: []; perguntas: []; motivo: string };

type FalaMini = {
  direcao: string;
  metadata?: Record<string, unknown> | null;
  membro_atipico_id?: string | null;
};

type Pergunta = {
  chave: ChaveMiniInvestigacao;
  texto: string;
  conhecida: (p: PerfilConsultavel) => boolean;
};

const PERGUNTAS: Record<TemaMiniInvestigacao, readonly Pergunta[]> = {
  alimentacao: [
    {
      chave: "alimentacao.aceita",
      texto: "O que já é aceito hoje, sem virar uma batalha?",
      conhecida: (p) => p.sabemos("nutricional", "aceita"),
    },
    {
      chave: "alimentacao.reacao_novo",
      texto: "O que acontece quando aparece um alimento diferente?",
      conhecida: (p) =>
        p.sabemos("nutricional", "rejeita") || p.sabemos("nutricional", "dificuldades"),
    },
    {
      chave: "alimentacao.sensorial",
      texto: "Você percebe alguma textura, cheiro ou consistência que incomoda mais?",
      conhecida: (p) =>
        p.sabemos("nutricional", "texturas_rejeita") ||
        p.sabemos("sensorial", "cheiros") ||
        p.sabemos("sensorial", "texturas"),
    },
  ],
  regulacao: [
    {
      chave: "regulacao.antes",
      texto: "O que geralmente acontece logo antes da explosão?",
      conhecida: (p) => p.sabemos("emocional", "gatilhos"),
    },
    {
      chave: "regulacao.ajuda_piora",
      texto: "O que costuma ajudar — e o que piora — quando a irritação já está muito forte?",
      conhecida: (p) => p.sabemos("emocional", "ajuda") && p.sabemos("emocional", "piora"),
    },
    {
      chave: "regulacao.comunicacao",
      texto: "Nesse momento, ainda consegue falar ou mostrar o que precisa?",
      conhecida: (p) =>
        p.sabemos("comunicacao", "forma") && p.sabemos("comunicacao", "mostra"),
    },
  ],
  atividade: [
    {
      chave: "atividade.compreende",
      texto: "Quando você mostra o que é para fazer, parece que a atividade foi entendida?",
      conhecida: (p) => p.sabemos("aprendizado", "dificulta"),
    },
    {
      chave: "atividade.inicia",
      texto: "A atividade não chega a começar, ou começa quando você ajuda no primeiro passo?",
      conhecida: (p) =>
        p.sabemos("autonomia", "padrao") || p.sabemos("autonomia", "com_apoio"),
    },
    {
      chave: "atividade.sustenta",
      texto: "Quando começa, em que momento para — e o que parece pesar ali?",
      conhecida: (p) => p.sabemos("foco", "sustenta") && p.sabemos("foco", "dispersa"),
    },
  ],
  comunicacao: [
    {
      chave: "comunicacao.forma",
      texto: "Como costuma se comunicar hoje: frases, palavras, gestos ou outro jeito?",
      conhecida: (p) => p.sabemos("comunicacao", "forma"),
    },
    {
      chave: "comunicacao.mostra",
      texto: "Como mostra o que quer quando a palavra não vem?",
      conhecida: (p) => p.sabemos("comunicacao", "mostra"),
    },
    {
      chave: "comunicacao.entende",
      texto: "Como você percebe o que é entendido do que vocês falam?",
      conhecida: (p) => p.sabemos("comunicacao", "entende"),
    },
  ],
};

const RISCO_OU_URGENCIA =
  /\b(agora|neste momento|nesse momento|se machuc|machucar algu[eé]m|sangr|engasg|sem respirar|desmai|fugiu|sumiu|veneno|overdose)\b/i;
const SINAL_DE_QUE_A_ORIENTACAO_COMUM_NAO_BASTA =
  /\b(j[aá] tentei|j[aá] fiz|tentamos|n[aã]o funcion|nada (ajuda|muda|resolve)|continua igual|orienta[cç][aã]o gen[eé]rica|antes de tentar mais uma coisa|n[aã]o sei onde trava)\b/i;

function temaDoTurno(temas: readonly string[], relato: string): TemaMiniInvestigacao | null {
  const t = new Set(temas);
  if (
    (t.has("nutricional") || t.has("alimentacao")) &&
    /\b(comida|comer|come|alimenta\w*|alimento|seletiv\w*|recusa)\b/i.test(relato)
  ) return "alimentacao";
  if (
    (t.has("emocional") || t.has("regulacao")) &&
    /\b(crise|desregul|explode|explodir|irritad|nervos|grita|chora|birra)\b/i.test(relato)
  ) return "regulacao";
  if (
    (t.has("foco") || t.has("aprendizado") || t.has("autonomia")) &&
    /\b(atividade|tarefa|li[cç][aã]o|dever|exerc[ií]cio|estudar)\b/i.test(relato)
  ) return "atividade";
  if (
    t.has("comunicacao") &&
    /\b(comunica|falar|fala|pedir|express|entend)\b/i.test(relato)
  ) return "comunicacao";
  return null;
}

function miniAnterior(
  falas: readonly FalaMini[],
  membroId: string,
): { tema: TemaMiniInvestigacao; campos: ChaveMiniInvestigacao[] } | null {
  for (let i = falas.length - 1; i >= 0; i--) {
    const fala = falas[i];
    if (fala.direcao !== "outbound") continue;
    if ((fala.membro_atipico_id ?? membroId) !== membroId) continue;
    const meta = fala.metadata as {
      mini_investigacao_tema?: unknown;
      mini_investigacao_campos?: unknown;
    } | null;
    if (!Array.isArray(meta?.mini_investigacao_campos)) continue;
    const campos = meta.mini_investigacao_campos.filter(
      (c): c is ChaveMiniInvestigacao =>
        typeof c === "string" && CHAVES_MINI_INVESTIGACAO.includes(c as ChaveMiniInvestigacao),
    );
    const tema = meta.mini_investigacao_tema;
    if (!PERGUNTAS[tema as TemaMiniInvestigacao] || campos.length < 2) continue;
    const respondeu = falas.slice(i + 1).some((f) => f.direcao === "inbound");
    const aylaRespondeuDepois = falas.slice(i + 1).some((f) => f.direcao === "outbound");
    if (respondeu && !aylaRespondeuDepois) {
      return { tema: tema as TemaMiniInvestigacao, campos };
    }
    return null;
  }
  return null;
}

export function decidirMiniInvestigacao(params: {
  perfil: PerfilConsultavel;
  temas: readonly string[];
  relato: string;
  falas: readonly FalaMini[];
  membroId: string;
}): MiniInvestigacao {
  const anterior = miniAnterior(params.falas, params.membroId);
  if (anterior) {
    return {
      acao: "ORIENTAR",
      tema: anterior.tema,
      campos: anterior.campos,
      perguntas: [],
      motivo: "a família respondeu à mini-investigação anterior; este turno deve orientar",
    };
  }

  if (process.env.AYLA_MINI_INVESTIGACAO === "off") {
    return { acao: "NAO_USAR", tema: null, campos: [], perguntas: [], motivo: "flag desligada" };
  }
  if (RISCO_OU_URGENCIA.test(params.relato)) {
    return { acao: "NAO_USAR", tema: null, campos: [], perguntas: [], motivo: "risco ou urgencia" };
  }
  if (!SINAL_DE_QUE_A_ORIENTACAO_COMUM_NAO_BASTA.test(params.relato)) {
    return {
      acao: "NAO_USAR",
      tema: null,
      campos: [],
      perguntas: [],
      motivo: "a familia ainda pode receber uma primeira orientacao util sem bateria",
    };
  }

  const tema = temaDoTurno(params.temas, params.relato);
  if (!tema) {
    return { acao: "NAO_USAR", tema: null, campos: [], perguntas: [], motivo: "fora dos quatro temas ou pedido especifico" };
  }
  if (!TEMAS_APROVADOS.has(tema)) {
    return {
      acao: "NAO_USAR",
      tema: null,
      campos: [],
      perguntas: [],
      motivo: `A/B nao demonstrou ganho significativo em ${tema}`,
    };
  }

  const faltantes = PERGUNTAS[tema].filter((q) => !q.conhecida(params.perfil)).slice(0, 3);
  if (faltantes.length < 2) {
    return {
      acao: "NAO_USAR",
      tema: null,
      campos: [],
      perguntas: [],
      motivo: "menos de duas informações decisivas faltantes",
    };
  }

  return {
    acao: "PERGUNTAR",
    tema,
    campos: faltantes.map((q) => q.chave),
    perguntas: faltantes.map((q) => q.texto),
    motivo: `${faltantes.length} respostas juntas separam estratégias diferentes`,
  };
}

export function blocoMiniInvestigacao(d: MiniInvestigacao): string {
  if (d.acao === "NAO_USAR") return "";
  if (d.acao === "ORIENTAR") {
    const especial =
      d.tema === "regulacao"
        ? "Diferencie prevenção, auge da crise, recuperação e aprendizagem posterior; não ensine durante o auge."
        : d.tema === "atividade"
          ? "Distinga se a barreira é compreender, iniciar, sustentar, sobrecarga ou pré-requisito ausente."
          : d.tema === "alimentacao"
            ? "Use o que ela aceita como ponte e diferencie recusa, desconforto sensorial e dificuldade de manejo."
            : "Reconheça como comunicação funcional tudo que a criança já usa e parta desse nível.";
    return `<mini_investigacao_resposta>
A família respondeu às poucas perguntas do turno anterior. Agora é OBRIGATÓRIO ajudar: cruze as respostas com os fatos do Perfil e do histórico, cite naturalmente o que for decisivo para esta criança, sintetize UMA hipótese em linguagem simples, escolha UMA ação concreta, dê UMA frase pronta para o adulto usar e diga o que observar para decidir o próximo passo. ${especial}
Entregue valor suficiente, mas sem virar relatório nem despejar todos os caminhos considerados.
Não faça outra bateria. Não repita perguntas. O conhecimento fica por trás; a conversa fica na frente.
</mini_investigacao_resposta>`;
  }
  const ajudaAgora =
    d.tema === "alimentacao"
      ? "Antes das perguntas, ajude agora em uma frase: mantenha um alimento seguro e não force a prova enquanto entendem o que pesa."
      : d.tema === "regulacao"
        ? "Antes das perguntas, ajude agora em uma frase: no auge, priorize segurança, reduza estímulos e use poucas palavras."
        : d.tema === "atividade"
          ? "Antes das perguntas, ajude agora em uma frase: na próxima tentativa, mostre somente o primeiro passo e não insista se houver travamento."
          : "Antes das perguntas, ajude agora em uma frase: reconheça e atenda o gesto, olhar, som ou tentativa que a criança já usa; não exija uma fala melhor para responder.";
  return `<mini_investigacao>
Esta é uma EXCEÇÃO ao padrão de uma pergunta: sem estas ${d.perguntas.length} informações, a orientação seria genérica ou poderia escolher a estratégia errada.
${ajudaAgora}
Comece de forma humana, dizendo que quer entender só ${d.perguntas.length === 2 ? "duas" : "três"} coisas para adaptar melhor e que a família pode responder tudo junto, inclusive por áudio. Depois faça exatamente estas perguntas, curtas e numeradas:
${d.perguntas.map((p, i) => `${i + 1}. ${p}`).join("\n")}
Não acrescente pergunta. Não transforme em formulário. A ajuda imediata acima não substitui a próxima resposta: depois das respostas da família, entregue a orientação concreta e personalizada.
</mini_investigacao>`;
}
