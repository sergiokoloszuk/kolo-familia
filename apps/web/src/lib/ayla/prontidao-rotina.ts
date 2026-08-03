import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";

/**
 * A ROTINA DEVE SER GERADA AGORA?
 *
 * Irmão de `prontidao-plano.ts`, e pelo mesmo motivo. O Plano tinha um porteiro
 * explícito desde sempre; a Rotina não tinha nenhum — quem decidia era o próprio
 * modelo que estava gerando, no meio da geração, a partir de uma linha do
 * contrato ("se já dá pra montar, MONTE").
 *
 * O preço disso apareceu em produção (02/08/2026): uma mãe com uma bebê de 18
 * DIAS pediu ajuda pra "organizar as mamadas", e recebeu uma rotina afirmando
 * intervalo entre mamadas ("de 2 em 2 horas, às vezes de 1h30"), duração no
 * peito ("deixa ela esvaziar um lado antes de oferecer o outro") e quando pôr
 * pra dormir. Tudo isso é manejo clínico neonatal, saiu em PDF, e a mãe
 * imprimiu. Nada perguntou se aquilo devia ser gerado.
 *
 * O critério de produto está em `CRITERIO_SUFICIENCIA_ROTINA`, num lugar só e em
 * português, de propósito: é conteúdo pra Karina ler e ajustar sem caçar prompt.
 * Mesma decisão do Plano.
 */

/** O que precisa estar na mesa pra uma rotina sair ÚTIL (e não genérica). */
export const CRITERIO_SUFICIENCIA_ROTINA = `A PERGUNTA CENTRAL É UMA SÓ: com o que eu já sei, consigo gerar uma rotina útil e coerente? Se sim, GERE. Não continue investigando pra enriquecer.

O MÍNIMO pra gerar são DUAS coisas:
1. QUAL PEDAÇO DO DIA — a tarde depois da escola, a manhã até sair, a noite, o dia inteiro, um dia específico.
2. UMA SEQUÊNCIA — o que acontece, na ordem, com as palavras da família ("chega 12h40, almoça, descansa, faz lição, futebol 15h30"). Bagunçada serve: organizar é seu trabalho. Não precisa de horário em tudo; precisa de ordem.

O PONTO DIFÍCIL (onde trava, o que vira briga) ENRIQUECE muito, mas NÃO é requisito. Se você sabe, use — muda a granularidade das etapas. Se não sabe e já tem escopo e sequência, GERE assim mesmo. Segurar uma rotina pra descobrir onde trava é interrogatório.

NÃO é caso de gerar rotina quando:
- a pessoa não pediu organização do dia — pediu ajuda com um comportamento ("ele bate quando tiro o objeto"), com alimentação, com escola. Isso é conversa, e às vezes plano; rotina não resolve.
- é crise acontecendo agora, desabafo ou sofrimento do adulto.
- a família falou de várias crianças e não ficou claro de quem é o dia.`;

/**
 * O LIMITE DE ATUAÇÃO — separado da suficiência de propósito.
 *
 * Suficiência é "tenho dados?". Limite é "isto é meu?". São perguntas
 * diferentes, e uma rotina pode ter todos os dados do mundo e mesmo assim
 * conter algo que não cabe à Kolo decidir.
 *
 * Isto NÃO é um catálogo de regras sobre recém-nascido — é uma distinção, e ela
 * vale pra qualquer idade. Organização é da Ayla; manejo clínico é de quem
 * acompanha a criança.
 */
export const LIMITE_DE_ATUACAO_ROTINA = `ORGANIZAÇÃO é sua. MANEJO CLÍNICO não é.

Você organiza: a sequência do dia, banho, trocas, descanso, sono como rotina, saídas, transições, o que a família registra, a logística de quem faz o quê — e a orientação que o profissional JÁ DEU, usada como a família contou, sem reinterpretar.

Você NÃO decide, pra esta criança: intervalo entre mamadas ou refeições, duração, quantidade, se precisa acordar pra comer, complemento ou fórmula, dose ou horário de remédio, se está mamando/comendo o suficiente, nem nenhum critério clínico de manejo. Isso vale com força redobrada pra bebê nos primeiros meses, onde quase toda pergunta de rotina é, no fundo, uma pergunta clínica.

Quando a rotina DEPENDER de um desses dados, não invente e não desista: pergunte o que o profissional já orientou ("o que a pediatra orientou sobre as mamadas?") e encaixe a resposta dela na rotina como dado relatado. Se ela não souber, monte o resto — o que dá pra organizar já ajuda — e diga com clareza que essa parte fica com a pediatra.`;

export type DesfechoRotina =
  /** Dá pra gerar agora. */
  | "suficiente"
  /** Pedido genérico: a família não disse O QUE quer organizar. NÃO é pergunta
   *  de dado — é hora de oferecer caminhos e deixar ela escolher. */
  | "falta_escopo"
  /** Escopo claro, mas falta UM dado que muda o artefato. */
  | "falta"
  | "nao_e_rotina"
  | "limite_atuacao";

export type ProntidaoRotina = {
  desfecho: DesfechoRotina;
  /** Preenchido quando desfecho = "falta": a ÚNICA pergunta que muda a rotina. */
  pergunta: string | null;
  /** Preenchido quando desfecho = "limite_atuacao": o que é da pediatra. */
  parteClinica: string | null;
  /** Por que — vai pro log, ajuda a calibrar o critério. */
  motivo: string;
};

const SEGURO = (motivo: string): ProntidaoRotina => ({
  desfecho: "falta",
  pergunta: null,
  parteClinica: null,
  motivo,
});

const SYSTEM = `Você decide se a Ayla já pode MONTAR uma rotina visual pra uma família, ou se falta algo.

${CRITERIO_SUFICIENCIA_ROTINA}

${LIMITE_DE_ATUACAO_ROTINA}

Responda APENAS JSON, sem texto fora dele:
{"desfecho":"suficiente"|"falta_escopo"|"falta"|"nao_e_rotina"|"limite_atuacao","pergunta":"...","parteClinica":"...","motivo":"..."}

- "suficiente": dá pra montar algo útil agora. pergunta=null.
- "falta_escopo": ela pediu rotina mas não disse O QUE quer organizar ("preciso de uma rotina", "tá tudo bagunçado", "quero organizar ele", "vi que vocês fazem rotina"). NÃO é falta de dado — é falta de rumo. pergunta=null: quem oferece os caminhos é a Ayla, do jeito dela.
- "falta": o escopo está claro, mas falta UM dado que muda o artefato. Escreva em "pergunta" a pergunta curta e direta que você faria — UMA SÓ, do jeito que uma pessoa perguntaria.
- "nao_e_rotina": o pedido não é de organizar o dia. Explique em "motivo" o que ela realmente quer.
- "limite_atuacao": a rotina pedida depende de decisão clínica que não é da Kolo. Escreva em "parteClinica" QUAL parte é do profissional (ex.: "frequência e duração das mamadas"). Isso NÃO impede organizar o resto.
- motivo: uma frase curta, pra log.

NUNCA PERGUNTE O QUE VOCÊ JÁ TEM. Idade, nome e qual criança estão no contexto — perguntar isso queima a confiança da família ("eu já não te falei?"). Antes de escrever qualquer pergunta, releia O QUE JÁ SABEMOS e a conversa: se a resposta está lá, você não precisa dela. E UMA pergunta por vez: nunca junte duas ("qual a idade e qual parte do dia?").

Na dúvida entre "suficiente" e "falta", escolha SUFICIENTE quando você já tiver escopo + sequência: uma primeira rotina que a família ajusta vale mais que mais um turno de perguntas.
Na dúvida entre "falta" e "limite_atuacao", escolha "limite_atuacao": é mais seguro devolver a decisão clínica a quem acompanha a criança.`;

/**
 * Roda ANTES de qualquer montagem. Uma chamada no modelo leve — o mesmo custo
 * que o Plano já paga, e pelo mesmo motivo.
 *
 * Em qualquer falha devolve "falta" sem pergunta: o condutor segue conversando
 * normalmente, que é o comportamento inócuo. Nunca "suficiente" por acidente.
 */
export async function avaliarProntidaoParaRotina(params: {
  /** A mensagem de agora. */
  mensagem: string;
  /** A conversa recente, já formatada (quem disse o quê). */
  conversa: string;
  /** O que já se sabe da criança — perfil, rotina existente, desafios. */
  contexto?: string;
  /** Idade em meses, quando conhecida. Bebê pequeno pesa no limite de atuação. */
  idadeMeses?: number | null;
}): Promise<ProntidaoRotina> {
  try {
    const client = getAylaAnthropicClient();
    const user = [
      params.idadeMeses != null && params.idadeMeses <= 12
        ? `ATENÇÃO — a criança tem ${params.idadeMeses} ${params.idadeMeses === 1 ? "mês" : "meses"} de vida. Nessa idade quase toda pergunta de rotina é, no fundo, clínica.`
        : "",
      params.contexto ? `O QUE JÁ SABEMOS:\n${params.contexto}` : "",
      `CONVERSA RECENTE:\n${params.conversa.slice(0, 4000)}`,
      `MENSAGEM DE AGORA:\n"${params.mensagem.slice(0, 1000)}"`,
      "Decisão:",
    ]
      .filter(Boolean)
      .join("\n\n");

    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return SEGURO("prontidão sem JSON");

    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const d = String(o.desfecho ?? "").trim();
    const desfecho: DesfechoRotina =
      d === "suficiente" || d === "falta_escopo" || d === "nao_e_rotina" || d === "limite_atuacao"
        ? d
        : "falta";

    const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const pergunta = texto(o.pergunta);

    // "falta" sem pergunta não serve pra nada — o condutor não saberia o que
    // perguntar. Sem ela, deixa a conversa seguir normal.
    return {
      desfecho,
      pergunta: desfecho === "falta" ? pergunta : null,
      parteClinica: desfecho === "limite_atuacao" ? texto(o.parteClinica) : null,
      motivo: texto(o.motivo) ?? "-",
    };
  } catch (e) {
    console.warn(
      "[ayla:prontidao-rotina] falhou:",
      e instanceof Error ? e.message : e,
    );
    return SEGURO("erro na avaliação");
  }
}
