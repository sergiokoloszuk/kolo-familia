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
  /** A decisão do Gate B deste turno. `null` = gate não rodou. */
  decisaoLacuna: Pick<DecisaoDeLacuna, "decisao" | "escolhida" | "candidatasChaves"> | null;
  /**
   * O que o envelope do Core devolveu em `campo_investigado`.
   *
   * ⚠️ ESTE É O SINAL QUE DISTINGUE AS DUAS ÚLTIMAS LINHAS DA TABELA. Não-nulo
   * significa "a Ayla perguntou algo neste turno" — e aí o convite está
   * proibido. É sinal que já existe e já é gravado; nada de novo é inferido.
   */
  campoInvestigado: string | null;
  natureza: NaturezaParaConvite;
  /** Houve convite de perfil no turno imediatamente anterior? */
  conviteNoTurnoAnterior: boolean;
  /** A reserva/cooldown liberou? Decidido por `reservarConviteDePerfil`. */
  cooldownLiberado: boolean;
  /**
   * Domínios cujo campo relevante JÁ está estruturado.
   *
   * ⚠️ Guarda 3. O Gate B já exclui campo respondido da disputa, então na
   * prática isto é cinto e suspensório — e é de propósito: o dia em que o gate
   * mudar de critério, esta lista continua impedindo o convite por algo que a
   * família já respondeu.
   */
  dominiosJaEstruturados: readonly string[];
  /**
   * A mãe demonstrou querer contar tudo de uma vez?
   *
   * ⚠️ A ÚNICA CONDIÇÃO QUE PULA O COOLDOWN, e não pula nenhuma outra. Quando
   * ela diz "quero te contar tudo pra você conhecer ele", responder com dez
   * perguntas no WhatsApp é pior que abrir a tela onde ela preenche no ritmo
   * dela. O pedido é dela; o cooldown existe para proteger de convite NÃO
   * pedido.
   */
  pediuParaContar: boolean;
};

export type SaidaDoConvite = {
  acao: "NENHUMA" | "CONVIDAR";
  /** O domínio a oferecer. `null` quando a ação é NENHUMA. */
  dominio: string | null;
  /** Por que — para o rastro e para a auditoria, nunca para o prompt. */
  motivo: string;
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
 * Devolve sempre um `motivo`, inclusive (e principalmente) quando a resposta é
 * NENHUMA: um convite que não saiu sem motivo registrado é indistinguível de um
 * bug.
 */
export function decidirConviteDePerfil(e: EntradaDoConvite): SaidaDoConvite {
  const nao = (motivo: string): SaidaDoConvite => ({ acao: "NENHUMA", dominio: null, motivo });

  // ── 1. os momentos em que não se oferece nada, ponto ────────────────────
  //
  // ⚠️ A ORDEM É DELIBERADA: estas guardas vêm ANTES de tudo, inclusive do
  // pedido explícito da mãe. Quem está em crise não recebe atalho de cadastro
  // nem se pedir — a precedência de segurança sobre o resto é a mesma regra
  // que o pós-trial respeita no orquestrador.
  if (e.natureza === "crise") return nao("crise aguda");
  if (e.natureza === "seguranca") return nao("situação de segurança");
  if (e.natureza === "desabafo") return nao("desabafo — a dor da mãe não é oportunidade de cadastro");

  // ── 2. o pedido explícito da mãe ────────────────────────────────────────
  if (e.pediuParaContar) {
    const alvo = primeiroDominioOferecivel(e);
    // Mesmo aqui: se não há domínio pertinente, não se inventa um.
    return alvo
      ? { acao: "CONVIDAR", dominio: alvo, motivo: "a mãe pediu para contar" }
      : nao("a mãe pediu, mas nenhum domínio pertinente está em aberto");
  }

  // ── 3. continuação curta — ela está no meio de um assunto ───────────────
  if (e.natureza === "continuacao_curta") {
    return nao("continuação curta — a conversa está em pé, não se interrompe com link");
  }

  // ── 4. o Gate B e o envelope, que são os dois donos da decisão ──────────
  if (!e.decisaoLacuna) return nao("Gate B não rodou neste turno");
  if (e.decisaoLacuna.decisao === "NO_ASK") {
    return nao("nenhuma lacuna pertinente ao tema — não há o que oferecer");
  }
  if (e.campoInvestigado) {
    // GUARDA 7, e a mais fácil de esquecer: a Ayla já perguntou. Uma pergunta
    // curta resolve melhor do que uma tela, e as duas juntas viram
    // interrogatório.
    return nao("a Ayla perguntou neste turno — ASK não vira link");
  }

  // ── 5. as guardas de ritmo ──────────────────────────────────────────────
  if (e.conviteNoTurnoAnterior) return nao("houve convite no turno anterior");
  if (!e.cooldownLiberado) return nao("cooldown do convite ativo");

  const alvo = primeiroDominioOferecivel(e);
  if (!alvo) return nao("nenhum domínio oferecível em aberto");

  return { acao: "CONVIDAR", dominio: alvo, motivo: "lacuna do tema não era decisiva agora" };
}

/**
 * O domínio a oferecer — UM, e derivado do que o Gate B já considerou.
 *
 * ⚠️ NÃO ESCOLHE POR CONTA PRÓPRIA. A fonte é `escolhida` (a lacuna que o gate
 * elegeu) e, na falta dela, a primeira de `candidatasChaves`, que é a ordem que
 * o gate já calculou com as regras da pós. Inventar uma ordem aqui seria a
 * segunda inteligência que este módulo existe para não ter.
 */
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
export function destinoDoConvite(dominio: string): string {
  if (!DOMINIOS_OFERECIVEIS.includes(dominio)) return "/kolo-vivo";
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
  dominio: string;
  nome: string | null;
  link: string;
  /** Só para variar de forma reproduzível. */
  turnoId?: string | null;
}): string | null {
  const lista = FRASES[params.dominio];
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
