import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisaoDeLacuna } from "./lacuna-decisiva";

/**
 * O ATALHO OPCIONAL PARA O KOLO VIVO — PEND-203.
 *
 * ── o que esta peça é, e o que ela NÃO é ──────────────────────────────────
 *
 * Ela decide UMA coisa: depois de a Ayla já ter ajudado, vale oferecer um link
 * para a mãe completar UM domínio do Perfil, se ela quiser? Nada mais.
 *
 * ⚠️ NÃO É UM SEGUNDO DECISOR DE LACUNA, e a diferença é estrutural. Quem
 * decide se existe lacuna pertinente ao tema é o Gate B
 * (`escolherLacunaDecisiva`), e quem decide se a pergunta vale a pena AGORA é o
 * Core, pela instrução que já está em `blocoDaLacuna`: *"só pergunte se a
 * resposta mudaria mesmo o que você vai sugerir"*. Este módulo não repete
 * nenhuma dessas duas decisões — ele LÊ o resultado das duas e escolhe entre
 * calar e oferecer um atalho.
 *
 * ── a tabela de verdade, e por que ela é exatamente esta ──────────────────
 *
 * | Gate B      | a Ayla perguntou? | saída          |
 * |-------------|-------------------|----------------|
 * | `NO_ASK`    | —                 | **NENHUMA**    |
 * | `ASK`       | sim               | **NENHUMA**    |
 * | `ASK`       | não               | **CONVIDAR**   |
 *
 * A primeira linha: sem lacuna pertinente ao tema, não há o que oferecer.
 *
 * A segunda é a mais importante, e é a guarda 7 do desenho: **ASK não vira
 * link**. Se a informação era decisiva, a pergunta de uma frase resolve melhor
 * que mandar a mãe para uma tela — e mandar as duas coisas no mesmo turno é o
 * interrogatório que isto existe para evitar.
 *
 * A terceira é o caso que faltava: havia lacuna do tema, a Ayla julgou que não
 * mudava a conduta, ajudou sem perguntar — e conhecer aquele domínio melhoraria
 * as próximas personalizações. É aqui, e só aqui, que o atalho faz sentido.
 *
 * ⚠️ A AJUDA NUNCA DEPENDE DO LINK. O convite é a última linha de uma resposta
 * que já está completa — o mesmo padrão que o pós-trial usa em produção desde
 * 18/08/2026, onde o cooldown governa SÓ O LINK e nunca a resposta. Quem não
 * clica recebeu a orientação inteira.
 */

/**
 * A NATUREZA DO TURNO, do ponto de vista de "cabe oferecer algo aqui?".
 *
 * ⚠️ Não é um classificador novo: são estados que o orquestrador JÁ conhece
 * quando chega neste ponto — `estado-seguranca` diz se é crise, `desabafo.ts`
 * diz se é desabafo puro, `naturezaDoTurno` diz se é continuação curta. Este
 * tipo só dá nome ao que já foi decidido, para a guarda ser legível.
 */
export type NaturezaParaConvite =
  | "crise"
  | "seguranca"
  | "desabafo"
  | "continuacao_curta"
  | "normal";

export type EntradaDoConvite = {
  /**
   * ⚠️ O GATILHO PRINCIPAL — E ISSO MUDOU NO GATE 2, POR MEDIÇÃO.
   *
   * O desenho original tinha como caminho principal "o Gate B achou lacuna e a
   * Ayla decidiu não perguntar". Os 12 turnos reais do Gate 2C mostraram que
   * esse estado ocorreu **0 vezes**: nos 6 turnos com `ASK`, a Ayla perguntou
   * em todos. Já `pediu_para_contar` veio `true` em **2 de 12** — e nesses dois
   * a Ayla respondeu *"pode me contar aqui mesmo na conversa"*, aceitando
   * receber uma informação por vez pelo WhatsApp.
   *
   * Então o gatilho é o pedido explícito da mãe, e o mecanismo do Gate B fica
   * como caminho SECUNDÁRIO.
   */
  pediuParaContar: boolean;
  /** A decisão do Gate B — hoje só alimenta o caminho secundário. */
  decisaoLacuna: Pick<DecisaoDeLacuna, "decisao" | "escolhida" | "candidatasChaves"> | null;
  /**
   * O que o envelope do Core devolveu em `campo_investigado`. Não-nulo = a Ayla
   * perguntou algo NESTE turno, e aí o convite está proibido: pergunta + link
   * no mesmo balão é o interrogatório com formulário anexo.
   */
  campoInvestigado: string | null;
  /**
   * ⚠️ PERGUNTA ANTERIOR AINDA SEM RESPOSTA — `EstadoDoTurno.perguntaPendente`.
   *
   * Fonte reusada, não inventada: `apurarEstadoDoTurno` já a apura com
   * `perguntaAberta`. Sem esta guarda, a Ayla pergunta "ele aponta ou mostra o
   * que quer?", a mãe ainda não respondeu, e o turno seguinte já traz um link —
   * duas demandas abertas ao mesmo tempo.
   */
  perguntaAberta: boolean;
  /** `segurancaAberta().aberta` — crise/segurança em curso. */
  segurancaAberta: boolean;
  /** `natureza_emocional` do decisor. `null` = "não sei", e bloqueia. */
  naturezaEmocional: "neutra" | "desabafo" | null;
  /** `naturezaDoTurno` — `simples`/`continuacao` são conversa curta. */
  naturezaDoTurno: string | null;
  cooldownLiberado: boolean;
  dominiosJaEstruturados: readonly string[];
  /** Tema do turno, quando houver — orienta o domínio do destino. */
  temaDoTurno?: string | null;
};

export type SaidaDoConvite = {
  acao: "NENHUMA" | "CONVIDAR";
  /** O domínio a oferecer. `null` = genérico (`/kolo-vivo`). */
  dominio: string | null;
  /** Por que — para o rastro e para a auditoria, nunca para o prompt. */
  motivo: string;
  /**
   * QUAL DOS DOIS CAMINHOS gerou o convite — PEND-203 Gate 2.
   *
   * ⚠️ SEPARADO NO RASTRO DE PROPÓSITO. O Gate 2C mediu que um dos caminhos
   * ocorre e o outro não; sem distinguir os dois na telemetria, daqui a um mês
   * ninguém consegue dizer qual deles gerou valor real — e a decisão de manter
   * ou remover o secundário vira palpite.
   */
  origem: "pedido_explicito" | "lacuna_nao_perguntada" | null;
};

/** Domínios do Perfil Vivo que o convite pode oferecer. */
const DOMINIOS_OFERECIVEIS: readonly string[] = [
  "comunicacao",
  "sensorial",
  "socializacao",
  "emocional",
  "sono",
  "nutricional",
  "rotina",
  "foco",
  "motor",
  "autonomia",
  "aprendizado",
  "imitacao",
  "escola",
  "tela_midia",
];

/**
 * A DECISÃO — função pura, auditável, sem modelo e sem consulta.
 *
 * ⚠️ A ORDEM DOS BLOQUEADORES VEM ANTES DE TUDO, inclusive do pedido explícito
 * da mãe. Quem está em crise não recebe atalho de cadastro nem se pedir, e a
 * dor de quem desabafa não é oportunidade de preencher campo.
 *
 * Devolve sempre um `motivo`, inclusive (e principalmente) quando a resposta é
 * NENHUMA: um convite que não saiu sem motivo registrado é indistinguível de
 * um bug.
 */
export function decidirConviteDePerfil(e: EntradaDoConvite): SaidaDoConvite {
  const nao = (motivo: string): SaidaDoConvite => ({
    acao: "NENHUMA",
    dominio: null,
    motivo,
    origem: null,
  });

  // ── 1. BLOQUEADORES ABSOLUTOS ───────────────────────────────────────────
  if (e.segurancaAberta) return nao("segurança/crise aberta");
  if (e.naturezaEmocional === "desabafo") {
    return nao("desabafo — a dor da mãe não é oportunidade de cadastro");
  }
  /**
   * ⚠️ `null` BLOQUEIA, E É O PONTO MAIS FÁCIL DE ERRAR. `null` significa que o
   * decisor não classificou — modelo omitiu o campo, devolveu valor fora do
   * vocabulário, ou o turno veio pelo fluxo da Rotina, em que ele não roda.
   * Tratar "não sei" como "neutra" transformaria silêncio em permissão, e o
   * primeiro convite indevido sairia exatamente no turno em que a telemetria
   * falhou.
   */
  if (e.naturezaEmocional === null) return nao("natureza emocional desconhecida");
  if (e.campoInvestigado) {
    return nao("a Ayla perguntou neste turno — pergunta e link não vão juntos");
  }
  if (e.perguntaAberta) return nao("há pergunta anterior aguardando resposta");

  // ── 2. CAMINHO PRINCIPAL — o pedido explícito da mãe ────────────────────
  if (e.pediuParaContar) {
    /**
     * ⚠️ FURA O COOLDOWN, E SÓ ELE. Se ela está pedindo AGORA uma forma de
     * adiantar, responder "você já recebeu um link esta semana" é absurdo. O
     * cooldown existe para proteger de convite NÃO pedido; este é pedido.
     *
     * O que ele NÃO fura: crise, segurança, desabafo e pergunta aberta — todos
     * acima, e todos antes dele de propósito.
     */
    return {
      acao: "CONVIDAR",
      dominio: dominioDoPedido(e),
      motivo: "a mãe pediu para adiantar informações",
      origem: "pedido_explicito",
    };
  }

  // ── 3. as guardas de ritmo, que valem só para o caminho espontâneo ──────
  if (e.naturezaDoTurno === "simples" || e.naturezaDoTurno === "continuacao") {
    return nao("conversa curta — não se interrompe com link");
  }
  if (!e.cooldownLiberado) return nao("cooldown do convite ativo");

  // ── 4. CAMINHO SECUNDÁRIO — a lacuna que o Gate B viu e não foi perguntada
  //
  // ⚠️ MEDIDO EM 0 DE 12 TURNOS REAIS (Gate 2C). Fica porque é correto e
  // barato, não porque se espera volume dele. A arquitetura NÃO foi otimizada
  // para este caso, e a telemetria o separa para que daqui a um mês se possa
  // decidir mantê-lo ou removê-lo com número na mão.
  if (!e.decisaoLacuna) return nao("Gate B não rodou neste turno");
  if (e.decisaoLacuna.decisao === "NO_ASK") {
    return nao("nenhuma lacuna pertinente ao tema, e a mãe não pediu");
  }
  const alvo = primeiroDominioOferecivel(e);
  if (!alvo) return nao("nenhum domínio oferecível em aberto");
  return {
    acao: "CONVIDAR",
    dominio: alvo,
    motivo: "lacuna do tema não era decisiva agora",
    origem: "lacuna_nao_perguntada",
  };
}

/**
 * O DOMÍNIO QUANDO O PEDIDO É EXPLÍCITO.
 *
 * ⚠️ GENÉRICO É O PADRÃO, e isso é deliberado. "Quero te contar tudo sobre ele"
 * não aponta domínio nenhum — mandar essa mãe para uma única seção seria
 * estreitar o que ela ofereceu. Só quando o tema do turno é claramente um
 * domínio do Perfil o destino se especializa.
 */
function dominioDoPedido(e: EntradaDoConvite): string | null {
  const tema = (e.temaDoTurno ?? "").trim();
  if (tema && DOMINIOS_OFERECIVEIS.includes(tema) && !e.dominiosJaEstruturados.includes(tema)) {
    return tema;
  }
  return null;
}

function primeiroDominioOferecivel(e: EntradaDoConvite): string | null {
  const daEscolhida = e.decisaoLacuna?.escolhida?.dominio ?? null;
  const daCandidata = (e.decisaoLacuna?.candidatasChaves ?? [])
    .map((c) => c.split(".")[0])
    .find((d) => d);
  const brutos = [daEscolhida, daCandidata].filter((d): d is string => Boolean(d));
  for (const d of brutos) {
    if (!DOMINIOS_OFERECIVEIS.includes(d)) continue;
    if (e.dominiosJaEstruturados.includes(d)) continue;
    return d;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * O DESTINO — sempre o Kolo Vivo oficial, nunca uma tela paralela.
 *
 * ⚠️ CAMINHO INTERNO, SEMPRE. `gerarMagicLink` já recusa destino que não
 * comece com `/` (cai em `/estrategias`), mas a validação vive aqui também:
 * quem lê este módulo tem de ver que um domínio vindo de fora não consegue
 * virar host externo. `//evil.com` é caminho relativo de protocolo e seria um
 * jeito de sair do app — por isso a checagem é de vocabulário fechado, não de
 * formato.
 */
export function destinoDoConvite(dominio: string | null): string {
  // ⚠️ `null` É O DESTINO GENÉRICO, e é o caso mais comum: "quero te contar
  // tudo sobre ele" não aponta domínio nenhum.
  if (!dominio || !DOMINIOS_OFERECIVEIS.includes(dominio)) return "/kolo-vivo";
  return `/kolo-vivo?dominio=${dominio}`;
}

/**
 * A VOZ DO CONVITE.
 *
 * ⚠️ POR QUE UMA FAMÍLIA DE FRASES, E NÃO UMA. A mesma frase repetida toda
 * semana vira ruído de sistema, e a Ayla deixa de soar como alguém que quer
 * conhecer a criança. São poucas, por domínio, e escolhidas de forma
 * DETERMINÍSTICA a partir do id do turno — varia entre turnos, e a mesma
 * medição reproduz o mesmo texto.
 *
 * ⚠️ O LÉXICO É PROIBITIVO DE PROPÓSITO. Nada de "complete seu perfil",
 * "faltam informações", "cadastro incompleto" ou "preciso coletar dados". A
 * mãe precisa ler *"ela quer conhecer melhor meu filho"*, não *"estou
 * preenchendo banco de dados"*. Há teste amarrando essa lista.
 *
 * ⚠️ E NÃO HÁ SUSPENSE. Nenhuma formulação diz "tenho uma estratégia, mas
 * primeiro responda" — a orientação já foi entregue acima quando esta frase
 * aparece.
 */
const FRASES: Record<string, readonly string[]> = {
  comunicacao: [
    "Se quiser, posso conhecer um pouquinho melhor como {nome} se comunica — isso me ajuda a deixar as próximas ideias mais do jeitinho dele",
    "Se você quiser me contar como {nome} costuma se expressar, consigo personalizar melhor o que sugiro daqui pra frente",
  ],
  sensorial: [
    "Se quiser, dá para me contar o que costuma incomodar {nome} nos sentidos — barulho, textura, luz. Isso muda bastante as estratégias",
    "Se fizer sentido, me conte um pouco do lado sensorial de {nome}; ajuda a eu acertar mais de primeira",
  ],
  socializacao: [
    "Se quiser, posso conhecer melhor como {nome} se aproxima e brinca com outras pessoas — aí consigo personalizar as próximas ideias",
    "Se você quiser me contar como é a convivência de {nome} com outras crianças, isso me ajuda bastante",
  ],
  emocional: [
    "Se quiser, me conte um pouco mais sobre o que costuma desregular {nome} e o que ajuda a passar",
    "Se fizer sentido, dá para me contar como {nome} costuma reagir nos momentos difíceis — isso muda o que eu sugiro",
  ],
  sono: [
    "Se quiser, me conte um pouco mais sobre o sono de {nome} — como adormece, como é a noite",
    "Se ajudar, dá para me contar como andam as noites de {nome}",
  ],
  nutricional: [
    "Se quiser, me conte um pouco mais sobre como {nome} come — o que aceita, o que recusa",
    "Se fizer sentido, dá para me contar como é a relação de {nome} com a comida",
  ],
  rotina: [
    "Se quiser, me conte como a rotina de {nome} costuma funcionar e o que ajuda nas mudanças",
    "Se ajudar, dá para me contar como {nome} lida com mudanças de plano",
  ],
  foco: [
    "Se quiser, me conte um pouco sobre a atenção de {nome} — o que prende, o que dispersa",
    "Se fizer sentido, dá para me contar como é o foco de {nome} nas atividades",
  ],
  motor: [
    "Se quiser, me conte um pouco sobre o corpo e as mãos de {nome} — o que flui, o que custa",
    "Se ajudar, dá para me contar como {nome} está indo na parte motora",
  ],
  autonomia: [
    "Se quiser, me conte o que {nome} já faz sozinho e onde ainda precisa de você",
    "Se fizer sentido, dá para me contar como está a autonomia de {nome} no dia a dia",
  ],
  aprendizado: [
    "Se quiser, me conte como {nome} aprende melhor — vendo, ouvindo, fazendo",
    "Se ajudar, dá para me contar como {nome} está aprendendo e o que facilita pra ele",
  ],
  imitacao: [
    "Se quiser, me conte se {nome} costuma imitar o que vocês fazem — isso abre muitas estratégias",
    "Se fizer sentido, dá para me contar como {nome} aprende olhando e copiando",
  ],
  escola: [
    "Se quiser, me conte como está a escola de {nome} — o que funciona e o que trava",
    "Se ajudar, dá para me contar como {nome} está na escola",
  ],
  tela_midia: [
    "Se quiser, me conte como é a relação de {nome} com as telas",
    "Se fizer sentido, dá para me contar como {nome} reage na hora de desligar a tela",
  ],
};

/**
 * AS FRASES DO PEDIDO EXPLÍCITO — sem domínio, porque ela ofereceu tudo.
 *
 * ⚠️ NENHUMA DELAS CRIA SUSPENSE nem cobra: a orientação já foi entregue acima
 * quando isto aparece. E nenhuma diz "complete seu cadastro" — a mãe precisa
 * ler "ela quer conhecer melhor meu filho".
 */
const FRASES_GENERICAS: readonly string[] = [
  "Se quiser adiantar, você pode me contar mais sobre {nome} por aqui — isso me ajuda a deixar as próximas orientações ainda mais do jeitinho dele",
  "Se quiser, dá para completar algumas informações de {nome} por aqui. Assim eu conheço melhor o jeito dele e personalizo mais as próximas sugestões",
  "Se quiser adiantar, você pode preencher por aqui o que quiser sobre {nome} — e eu já uso isso nas próximas conversas",
];

/** Palavras que nunca podem aparecer num convite. Há teste lendo esta lista. */
export const LEXICO_PROIBIDO: readonly string[] = [
  "complete seu perfil",
  "completar seu perfil",
  "faltam informações",
  "cadastro incompleto",
  "preencher o cadastro",
  "preciso coletar",
  "coletar dados",
  "formulário",
  "obrigatório",
];

/**
 * Monta a frase do convite. `link` entra no fim, sempre.
 *
 * ⚠️ SEM NOME RESOLVIDO, A FRASE AINDA FUNCIONA. `{nome}` cai para "ele(a)" em
 * vez de sair literal — um turno sem criança resolvida não deve produzir
 * "como {nome} se comunica".
 */
export function fraseDoConvite(params: {
  dominio: string | null;
  nome: string | null;
  link: string;
  /** Só para variar de forma reproduzível. */
  turnoId?: string | null;
}): string | null {
  // ⚠️ SEM DOMÍNIO, A FRASE É GENÉRICA — e ela existe de propósito: é a do
  // pedido explícito, que é o caminho principal desde o Gate 2.
  const lista = params.dominio ? FRASES[params.dominio] : FRASES_GENERICAS;
  if (!lista?.length || !params.link) return null;
  const i = indiceEstavel(params.turnoId ?? "", lista.length);
  const nome = (params.nome ?? "").trim() || "ele(a)";
  return `${lista[i].replace(/\{nome\}/g, nome)}: ${params.link}`;
}

/** Índice reproduzível a partir de uma string — sem `Math.random`. */
function indiceEstavel(chave: string, tamanho: number): number {
  if (tamanho <= 1) return 0;
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) % 100003;
  return h % tamanho;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * A JANELA DO CONVITE — 7 dias.
 *
 * ⚠️ O NÚMERO NÃO É ARBITRÁRIO, e vem dos mecanismos que já existem. O convite
 * de assinatura usa 12h (`JANELA_NUDGE_MS`) porque é comercial e urgente: o
 * acesso da família acabou hoje. Uma lacuna de Perfil não tem urgência nenhuma
 * — ela vale igual amanhã ou no mês que vem —, e o custo de errar é oposto:
 * repetir convite de cadastro é o que transforma a Ayla em formulário.
 *
 * Sete dias é a janela mais larga entre as que o produto já usa, e é o teto de
 * `acessos_app` (o token do magic-link vale 7 dias). Alinhar as duas coisas
 * significa que nunca há dois tokens de Perfil válidos ao mesmo tempo.
 */
const JANELA_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

/** Janela da rajada — a mesma do convite de assinatura, e pelo mesmo motivo. */
const JANELA_RAJADA_MS = 2 * 60 * 1000;

/** O tipo que o cooldown procura em `ayla_messages`. */
export const TIPO_CONVITE_PERFIL = "perfil_nudge";
const RESERVA_CONVITE_PERFIL = "perfil_nudge_reserva";

/**
 * PODE OFERECER O ATALHO AGORA?
 *
 * ⚠️ RESERVAR PRIMEIRO, DEPOIS CONFERIR — o padrão de `reservarEnvioProativo`
 * e `reservarConviteAssinatura`, e por que ele é obrigatório aqui: em ambiente
 * serverless cada invocação é um processo novo, e numa rajada de quatro
 * mensagens as quatro leituras acontecem antes da primeira escrita. Sem
 * reserva, a família receberia quatro convites em seis segundos — que é
 * literalmente o que aconteceu com o convite de assinatura em 23/07/2026.
 *
 * ⚠️ A RESERVA OLHA A RAJADA (2 min), O COOLDOWN OLHA O ENVIO (7 dias). Se a
 * reserva também olhasse 7 dias, uma reserva órfã — o envio falhou depois dela
 * — calaria o convite por uma semana por algo que nunca chegou.
 *
 * ⚠️ A FUNÇÃO DE ASSINATURA NÃO SERVE DIRETO: ela procura
 * `assinatura_nudge`/`trial_d0` e compete pela mesma reserva, então um convite
 * de Perfil bloquearia um convite de assinatura e vice-versa. Reusa-se o
 * PADRÃO, não a função — §4.
 */
export async function reservarConviteDePerfil(
  supabase: SupabaseClient,
  familyId: string,
): Promise<boolean> {
  const agora = Date.now();
  try {
    const { data: enviados } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .eq("tipo", TIPO_CONVITE_PERFIL)
      .gte("created_at", new Date(agora - JANELA_CONVITE_MS).toISOString())
      .limit(1);
    if ((enviados?.length ?? 0) > 0) return false;

    const { data: minha, error } = await supabase
      .from("ayla_send_log")
      .insert({
        family_account_id: familyId,
        template_key: RESERVA_CONVITE_PERFIL,
        status: "enfileirada",
        payload: { reservadoEm: new Date(agora).toISOString() },
      })
      .select("id, created_at")
      .single();
    // ⚠️ FALHA DA RESERVA NÃO CONVIDA. Sem saber se alguém chegou antes, o
    // silêncio é o resultado seguro: um convite a menos não custa nada.
    if (error || !minha) return false;

    const { data: concorrentes } = await supabase
      .from("ayla_send_log")
      .select("id, created_at")
      .eq("family_account_id", familyId)
      .eq("template_key", RESERVA_CONVITE_PERFIL)
      .gte("created_at", new Date(agora - JANELA_RAJADA_MS).toISOString())
      .order("created_at", { ascending: true })
      .limit(5);
    const primeira = concorrentes?.[0];
    return !primeira || primeira.id === minha.id;
  } catch {
    return false;
  }
}
