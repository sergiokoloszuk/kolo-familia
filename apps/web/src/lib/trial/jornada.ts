import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoTrial } from "./estado";

/**
 * A JORNADA D0–D7 — UM BLOCO DE CONTEXTO, NÃO UM SEGUNDO FLUXO.
 *
 * ⚠️ O QUE ISTO É. Um texto determinístico que entra no system do caminho novo,
 * do mesmo jeito que o retrato da criança e o perfil da casa: informação sobre
 * ONDE a família está e o que ela JÁ VIVEU. O dia oferece uma intenção
 * disponível; quem decide se e quando usá-la é a conversa.
 *
 * ⚠️ O QUE ISTO NÃO É, e cada linha aqui foi uma decisão:
 *   · não é roteiro — a necessidade atual da família sempre vence, e o bloco diz
 *     isso em primeiro lugar, antes de qualquer intenção do dia;
 *   · não é motor — nenhuma chamada de modelo nova, nenhuma decisão de resposta
 *     tomada fora do turno;
 *   · não é estado — nada é gravado, nada é lido fora do que já existe;
 *   · não é pitch — a sequência é EXPERIÊNCIA → PERCEPÇÃO → EVIDÊNCIA →
 *     NECESSIDADE FUTURA → VALOR DA CONTINUIDADE → DECISÃO, e quem nomeia o
 *     valor é a família, não a Ayla.
 *
 * ⚠️ A REGRA QUE MAIS IMPORTA: **evidência é só o que aconteceu**. O bloco leva
 * fatos contáveis (quantos planos, quantas rotinas, o que a família relatou) e
 * proíbe explicitamente transformar sugestão em resultado. Uma Ayla que diga
 * "aquela estratégia funcionou" sem a mãe ter dito isso destrói em uma frase a
 * confiança que sete dias construíram.
 */

/** O que a família de fato viveu — contado, nunca inferido. */
export type EvidenciasJornada = {
  /** Quantas vezes a família escreveu. É a medida de uso real que já existe. */
  mensagensDaFamilia: number;
  /** Média de caracteres por mensagem dela — o sinal de "fala pouco". */
  mediaCaracteres: number;
  /** Planos estratégicos entregues. */
  planos: number;
  /** Rotinas visuais criadas. */
  rotinas: number;
  /**
   * O que a família RELATOU, na ordem em que chegou. Vem de `eventos_membro`,
   * que só é escrito a partir do que ela contou — nunca do que a Ayla sugeriu.
   */
  relatos: string[];
  /** Temas que a conversa já percorreu, pelos registros da própria família. */
  temas: string[];
};

export const EVIDENCIAS_VAZIAS: EvidenciasJornada = {
  mensagensDaFamilia: 0,
  mediaCaracteres: 0,
  planos: 0,
  rotinas: 0,
  relatos: [],
  temas: [],
};

/** Abaixo disto a família responde por monossílabo, e pergunta aberta não rende. */
export const CARACTERES_FALA_POUCO = 40;
/** Menos que isto em sete dias é "quase não usou". */
export const MENSAGENS_USO_BAIXO = 5;

/**
 * A intenção DISPONÍVEL em cada dia. Disponível, não obrigatória.
 *
 * D0–D3 constroem a experiência; D4–D7 fazem a família nomear o valor, na
 * ordem: o que ajudou → o que ainda falta → o que vale continuar acompanhando →
 * e só então a decisão.
 */
export const INTENCAO_DO_DIA: Record<number, string> = {
  0: "Conhecer a criança — quem ela é, o que pesa hoje e o que ela gosta — e já devolver alguma direção concreta nesta conversa. Valor desde o primeiro contato.",
  1: "Ajudar num desafio real e, pela experiência, deixar claro que quanto mais você conhece a criança, mais específica você consegue ser.",
  2: "Ampliar a compreensão para outro tema relevante e começar a conectar o que já se sabe entre os temas.",
  3: "Demonstrar continuidade: retomar algo que já foi contado, perguntar como ficou uma estratégia sugerida, ou voltar a uma dificuldade anterior.",
  4: "Começar o fechamento invertido. Pergunte o que MAIS AJUDOU até aqui, antes de propor qualquer coisa. Quem nomeia o valor é ela.",
  5: "Perguntar em que você poderia ser ainda mais útil daqui para frente. Pode oferecer possibilidades reais (orientação no dia a dia, acompanhar o que funciona, plano, rotina) — como opções, não como venda.",
  6: "Resumir brevemente, e SÓ com evidência real, o que já foi construído; e perguntar o que seria mais importante continuar acompanhando.",
  7: "Só agora conectar: pelo que ela mesma valorizou, o que faria sentido continuar. Então perguntar se ela pensa em continuar com a Kolo depois do teste.",
};

/** Os dias em que a conversa pode cumprir função comercial. */
export const DIAS_DE_FECHAMENTO = new Set([4, 5, 6, 7]);

/**
 * QUAL INTENÇÃO CABE HOJE — ancorada no FIM do teste, não no começo.
 *
 * ⚠️ MEDIDO (15/08/2026): a jornada desenhada tem OITO etapas (D0–D7) e o teste
 * do produto tem SETE dias — ou seja, D0 a D6. Alguma coisa tinha que ceder, e
 * ceder no lugar errado quebraria o método: o fechamento invertido só funciona
 * na ordem (o que ajudou → o que falta → o que vale continuar → decisão), e a
 * decisão precisa cair no ÚLTIMO dia, não sobrar para depois do vencimento.
 *
 * Então os quatro últimos dias carregam as quatro etapas do fechamento, e a
 * compressão acontece no meio — onde a etapa 3 ("retomar algo já contado") é a
 * que menos se perde, porque retomar é também o primeiro trabalho da etapa 4.
 *
 * Num teste mais longo que 7 dias, a etapa 3 volta a existir sozinha: a conta é
 * por dias restantes, não por número mágico.
 */
export function intencaoDoDia(dia: number, diasRestantes: number): number {
  if (diasRestantes <= 1) return 7; // último dia: a decisão
  if (diasRestantes === 2) return 6;
  if (diasRestantes === 3) return 5;
  if (diasRestantes === 4) return 4; // abre o fechamento invertido
  return Math.min(dia, 3);
}

const NL = "\n";

/**
 * As 2–3 alternativas concretas que a Ayla oferece quando a pergunta aberta não
 * rende — derivadas do que a família VIVEU, nunca inventadas.
 *
 * ⚠️ Quanto menos ela fala, mais direção; e nenhuma direção que ela não tenha
 * vivido. Sem evidência nenhuma, a lista sai vazia e o bloco diz para perguntar
 * de outro jeito, em vez de oferecer opções falsas.
 */
export function alternativasConcretas(ev: EvidenciasJornada): string[] {
  const opcoes: string[] = [];
  if (ev.temas.length > 0) opcoes.push(`entender melhor o que acontece (${ev.temas[0]})`);
  if (ev.planos > 0) opcoes.push("ter ideias práticas para testar");
  if (ev.rotinas > 0) opcoes.push("organizar o dia com apoio visual");
  if (ev.relatos.length > 0) opcoes.push("adaptar as estratégias ao jeito dela");
  return opcoes.slice(0, 3);
}

/**
 * O bloco, pronto para o system. Devolve "" quando não há jornada a conduzir —
 * e "" é o comportamento de antes deste módulo existir.
 */
export function blocoDaJornada(
  estado: EstadoTrial,
  ev: EvidenciasJornada = EVIDENCIAS_VAZIAS,
): string {
  // ⚠️ UM DONO PARA A DECISÃO. Assinante, cortesia, staff, teste não iniciado e
  // estado desconhecido não têm jornada — e é `lerEstadoTrial` quem diz isso,
  // não uma segunda regra aqui.
  if (!estado.emConducaoComercial) return "";
  if (estado.fase !== "trial" && estado.fase !== "trial_encerrado") return "";

  const dia = estado.fase === "trial_encerrado" ? 7 : Math.min(estado.dia ?? 0, 7);
  const intencao = intencaoDoDia(dia, estado.diasRestantes ?? 0);
  const linhas: string[] = [];

  // A PRECEDÊNCIA VEM PRIMEIRO, e vem sempre. Se ela chegar em crise, com um
  // desabafo ou com um pedido concreto, isto aqui não existe neste turno.
  linhas.push(
    "A NECESSIDADE DE AGORA MANDA. Se a família trouxe uma dificuldade, um desabafo, uma dúvida ou um pedido concreto, atenda isso e ignore a intenção do dia — ela espera. Nunca interrompa o que a família precisa para cumprir uma etapa.",
  );
  linhas.push(
    estado.fase === "trial_encerrado"
      ? "Momento: o período de teste terminou."
      : `Dia ${dia} de ${dia + (estado.diasRestantes ?? 0)} do período de teste.`,
  );
  linhas.push(`Intenção disponível hoje: ${INTENCAO_DO_DIA[intencao] ?? INTENCAO_DO_DIA[7]}`);

  // O QUE ACONTECEU DE VERDADE — e nada além disso.
  const fatos: string[] = [];
  fatos.push(`mensagens da família até aqui: ${ev.mensagensDaFamilia}`);
  if (ev.planos > 0) fatos.push(`planos entregues: ${ev.planos}`);
  if (ev.rotinas > 0) fatos.push(`rotinas criadas: ${ev.rotinas}`);
  if (ev.temas.length) fatos.push(`temas já conversados: ${ev.temas.slice(0, 4).join(", ")}`);
  if (ev.relatos.length)
    fatos.push(`o que a família relatou: ${ev.relatos.slice(0, 4).join(" · ")}`);
  linhas.push(`O que de fato aconteceu — ${fatos.join(" · ")}.`);

  linhas.push(
    "EVIDÊNCIA É SÓ ISSO. Não diga que algo funcionou se a família não disse. Não trate sugestão sua como resultado, nem suposição como progresso. Se não houver evidência de um ganho, não invente um — pergunte.",
  );

  if (ev.mensagensDaFamilia > 0 && ev.mensagensDaFamilia < MENSAGENS_USO_BAIXO) {
    linhas.push(
      "Esta família usou pouco. Não cobre e não lamente o pouco uso: ofereça uma ajuda concreta agora, que é o que ainda dá para viver no tempo que resta.",
    );
  }

  if (ev.mensagensDaFamilia > 0 && ev.mediaCaracteres > 0 && ev.mediaCaracteres < CARACTERES_FALA_POUCO) {
    const alt = alternativasConcretas(ev);
    linhas.push(
      alt.length >= 2
        ? `Esta família responde curto. Pergunta aberta não vai render: ofereça alternativas concretas do que ela JÁ VIVEU e deixe ela escolher — ${alt.join(" / ")}. Uma escolha dela já é evidência.`
        : "Esta família responde curto, e ainda não há experiência suficiente para oferecer alternativas. Faça uma pergunta simples e concreta sobre o dia a dia, não uma pergunta aberta sobre valor.",
    );
  }

  if (DIAS_DE_FECHAMENTO.has(intencao)) {
    linhas.push(
      "No fechamento, quem fala primeiro é ela. Não apresente razões para assinar: ajude a família a nomear o que mudou. Se ela disser SIM, pare de convencer e resolva o próximo passo. Se disser NÃO SEI, entenda a objeção real. Se disser NÃO, respeite — e só pergunte o motivo se houver abertura. Nada de pressão, nada de urgência fabricada.",
    );
  }

  return `<jornada>${NL}${linhas.join(NL)}${NL}</jornada>`;
}

/**
 * AS EVIDÊNCIAS — de tabelas que já existem, sem nenhuma escrita.
 *
 * ⚠️ `eventos_membro` é a fonte dos relatos porque ela só é escrita a partir do
 * que a FAMÍLIA contou. Usar as sugestões da Ayla como evidência de progresso
 * seria exatamente o "inventar evolução" que esta missão proíbe.
 *
 * Falha silenciosa e vazia: sem evidência, o bloco simplesmente não afirma
 * nada. Um enriquecimento não pode derrubar um turno.
 */
export async function lerEvidenciasJornada(
  supabase: SupabaseClient,
  familyId: string,
): Promise<EvidenciasJornada> {
  try {
    const [{ data: msgs }, { data: planos }, { data: rotinas }, { data: eventos }] =
      await Promise.all([
        supabase
          .from("ayla_messages")
          .select("texto")
          .eq("family_account_id", familyId)
          .eq("direcao", "inbound")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase.from("planos").select("id, titulo").eq("family_account_id", familyId).limit(20),
        supabase.from("rotinas").select("id").eq("family_account_id", familyId).limit(20),
        supabase
          .from("eventos_membro")
          .select("descricao, tipo")
          .eq("family_account_id", familyId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    const textos = ((msgs ?? []) as Array<{ texto: string | null }>)
      .map((m) => (m.texto ?? "").trim())
      .filter(Boolean);
    const soma = textos.reduce((a, t) => a + t.length, 0);

    const listaPlanos = (planos ?? []) as Array<{ titulo: string | null }>;
    const listaEventos = (eventos ?? []) as Array<{ descricao: string | null; tipo: string | null }>;

    return {
      mensagensDaFamilia: textos.length,
      mediaCaracteres: textos.length ? Math.round(soma / textos.length) : 0,
      planos: listaPlanos.length,
      rotinas: ((rotinas ?? []) as unknown[]).length,
      relatos: listaEventos
        .map((e) => (e.descricao ?? "").trim())
        .filter(Boolean)
        .slice(0, 4),
      temas: listaPlanos
        .map((p) => (p.titulo ?? "").trim())
        .filter(Boolean)
        .slice(0, 4),
    };
  } catch (e) {
    console.warn("[trial:jornada] evidências indisponíveis:", e instanceof Error ? e.message : e);
    return EVIDENCIAS_VAZIAS;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PÓS-TRIAL — ONDA 1, 18/08/2026
// ══════════════════════════════════════════════════════════════════════════

/**
 * O NÍVEL DE LINGUAGEM da conversa pós-Trial, decidido pela EVIDÊNCIA.
 *
 * ⚠️ Os cortes saem da distribuição real, não de um número redondo. MEDI nas 135
 * crianças ativas: 52 delas têm exatamente UM fato — que é o mínimo que o
 * onboarding deixa, e não é conhecer a criança. Por isso `C` vai até 1 inclusive,
 * e não só até zero: o lado conservador é não alegar conhecimento.
 *
 *   A (≥5 fatos, 37 crianças) .. pode demonstrar continuidade
 *   B (2–4 fatos, 42 crianças) .. já começou a conhecer, sem exagerar
 *   C (≤1 fato,  56 crianças) .. NÃO alega conhecer a criança
 */
export type NivelEvidencia = "A" | "B" | "C";

export function nivelDeEvidencia(fatos: number): NivelEvidencia {
  if (fatos >= 5) return "A";
  if (fatos >= 2) return "B";
  return "C";
}

/**
 * O BLOCO DO MODO PÓS-TRIAL.
 *
 * ⚠️ O QUE ESTE BLOCO **NÃO** É: o mecanismo de segurança. Desligar as Boas
 * Práticas e encolher o contexto reduz produtores — não impede o modelo de
 * orientar com o conhecimento próprio dele. O portão real é comportamental, e
 * se prova por execução adversarial, não por leitura deste texto.
 *
 * ⚠️ RÓTULO NUNCA VIRA CONTEÚDO. Saber que existe informação sobre o sono não
 * autoriza dizer o que ela diz. "Tenho informações sobre o sono do João" é
 * verdade e vende continuidade; "sei que ele acorda três vezes por noite" é uma
 * afirmação sobre um conteúdo que este modo não recebeu — e afirmar o que não se
 * tem é exatamente o que destrói a confiança que a família ainda tem.
 */
export function blocoPosTrial(params: {
  nomeCrianca: string | null;
  rotulos: readonly string[];
  fatos: number;
}): string {
  const nivel = nivelDeEvidencia(params.fatos);
  const nome = (params.nomeCrianca ?? "").trim();
  const dela = nome ? ` de ${nome}` : " da criança";
  const linhas: string[] = [];

  linhas.push(
    "MOMENTO: o período de teste desta família TERMINOU. A conversa continua, mas o objetivo dela mudou.",
  );

  linhas.push(
    "VOCÊ PODE: explicar o que é a Kolo e como ela funciona; mostrar recursos (retrato da criança que cresce, rotina visual, plano estratégico, registro do que ajuda e do que não ajuda, acompanhamento ao longo do tempo); explicar o valor da continuidade; responder dúvidas sobre planos e acesso; acolher brevemente o que a família trouxer; entender objeções; perguntar o que faltou; e conduzir para o link de assinatura.",
  );

  linhas.push(
    "VOCÊ NÃO PODE, em nenhuma hipótese: dar orientação individual nova sobre um desafio da criança; listar estratégias, passos, técnicas ou frases para a família usar; investigar o desafio com perguntas para depois orientar; montar plano, rotina, sequência ou qualquer material. Isso vale mesmo que você saiba a resposta, mesmo que o pedido seja urgente, mesmo que seja 'só uma coisinha', e mesmo que a família insista.",
  );

  linhas.push(
    "QUANDO A FAMÍLIA TRAZ UM DESAFIO: reconheça em uma ou duas frases, com verdade e sem frieza. Depois mostre COMO a Kolo trabalharia essa situação — que você consideraria o que já sabe da criança, entenderia o que acontece naquele momento específico, ajudaria a testar um caminho e registraria o que funcionasse para não recomeçar do zero. Então ofereça o acesso. NÃO diga o que fazer.",
  );

  // ── O QUE PODE SER AFIRMADO, E SÓ ISSO ────────────────────────────────
  if (nivel === "C") {
    linhas.push(
      `EVIDÊNCIA: você NÃO conhece esta criança. Não diga que conhece, não diga que aprendeu nada${nome ? ` sobre ${nome}` : ""}, não invente vínculo, evolução ou conversa que não houve. Venda o que a Kolo PODERIA construir com vocês, no futuro — nunca o que já teria construído.`,
    );
  } else {
    const lista = params.rotulos.join(", ");
    const abre =
      nivel === "A"
        ? `EVIDÊNCIA: você já tem informação registrada${dela} nestes assuntos, e só nestes: ${lista}.`
        : `EVIDÊNCIA: você começou a conhecer${dela} em poucos assuntos, e só nestes: ${lista}. Reconheça que ainda é pouco — não exagere o que sabe.`;
    linhas.push(
      `${abre} ⚠️ ESTES SÃO OS ASSUNTOS, NÃO O CONTEÚDO. Você pode dizer que TEM informação sobre eles; você NÃO recebeu o que essa informação diz, então não afirme nada sobre o que a criança faz, aceita, sente ou precisa. Dizer "tenho registrado sobre o sono dele" é correto; dizer "sei que ele acorda de madrugada" é inventar. Nunca cite assunto fora desta lista.`,
    );
  }

  linhas.push(
    "OBJEÇÕES — uma pergunta por vez, nunca um questionário. Se disser que está caro, fale de preço e valor, sem desviar para a criança. Se disser que usou pouco, explique concretamente o que teria vivido. Se disser que as respostas foram genéricas, NÃO se defenda: agradeça, colha o que faltou e explique que você fica mais específica conforme conhece a criança. Se disser que não entendeu a Kolo, explique bem, com exemplos. Se disser que quer assinar, PARE de argumentar e entregue o link. Se disser que não quer, respeite; se ainda não souber o motivo, faça UMA pergunta simples e encerre.",
  );

  linhas.push(
    "TOM: você é a mesma Ayla. Nada de vendedora, urgência fabricada, insistência ou culpa por ter usado pouco. Se a família estiver em sofrimento agora, acolha primeiro — a conversa comercial espera.",
  );

  return `<pos_trial>${NL}${linhas.join(NL)}${NL}</pos_trial>`;
}

/** Quantas horas uma abordagem comercial reativa cala a proativa equivalente. */
export const JANELA_CONVIVENCIA_HORAS = 20;

/**
 * A REGRA DE CONVIVÊNCIA COM AS PROATIVAS.
 *
 * O pior resultado possível desta frente seria a família conversar sobre
 * continuar no D6 e receber, minutos depois, uma automática perguntando quase a
 * mesma coisa. As proativas ficam — o que não pode é repetirem a abordagem que
 * a conversa acabou de fazer.
 *
 * ⚠️ SEM ESTADO NOVO. O sinal é o que o próprio turno já grava em
 * `ayla_send_log.payload.meta.jornada_fechamento` — a mesma linha de auditoria
 * que existe desde sempre. Nenhuma tabela, nenhuma coluna, nenhum segundo
 * estado comercial.
 */
export async function fechamentoReativoRecente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date = new Date(),
): Promise<boolean> {
  try {
    const desde = new Date(agora.getTime() - JANELA_CONVIVENCIA_HORAS * 3600_000).toISOString();
    const { data } = await supabase
      .from("ayla_send_log")
      .select("payload, created_at")
      .eq("family_account_id", familyId)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(20);
    return ((data ?? []) as Array<{ payload: unknown }>).some((l) => {
      const meta = (l.payload as { meta?: { jornada_fechamento?: boolean } } | null)?.meta;
      return meta?.jornada_fechamento === true;
    });
  } catch {
    // ⚠️ Falha aqui NÃO silencia a proativa. O risco de calar a única mensagem
    // que uma família silenciosa receberia é maior que o de uma repetição.
    return false;
  }
}
