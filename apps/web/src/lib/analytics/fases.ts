/**
 * A FASE DA JORNADA — régua única.
 *
 * Até 31/07/2026 a mesma pergunta ("essa família está ativada?") tinha TRÊS
 * respostas diferentes no mesmo produto:
 *
 *   funil da jornada    onboarding + (uso OU plano OU conversa com a Ayla)
 *   drill-down e CRM    onboarding + uso  — plano e Ayla NÃO contavam
 *   card de "Ativação"  só ter atividade  — onboarding não contava
 *
 * O mesmo lead contava como ativado num painel e não no outro, e ninguém
 * percebeu porque nenhuma régua estava visível. A agência perguntou o que
 * significava "ativado" e a resposta honesta era "depende de onde você olha".
 *
 * DUAS RESPONSABILIDADES SEPARADAS, e é isso que impede a divergência voltar:
 *
 *   COLETAR os sinais  — varia por chamador; o drill-down tem menos dados à
 *                        mão que o funil, e tudo bem.
 *   DECIDIR a fase     — `classificarFase`, e mais ninguém.
 *
 * Antes, cada consumidor fazia as duas, e as réguas divergiram sem que
 * ninguém tivesse ESCOLHIDO que divergissem.
 */

export type Fase =
  | "cadastrou"
  | "ativou_teste"
  | "ativado"
  | "engajado"
  | "em_risco"
  | "oportunidade"
  | "convertido"
  | "expirado";

/**
 * Rótulo e DEFINIÇÃO de cada fase.
 *
 * `definicao` é obrigatória no tipo de propósito: é o que aparece na tela
 * junto do número. A causa da bagunça não foi um nome ruim — foi definição
 * invisível. Aqui, esquecer de escrever a régua é erro de compilação, não um
 * card mudo que alguém descobre seis meses depois.
 *
 * Escrita para a Karina e para a agência lerem, não para descrever a fórmula.
 */
export const FASE_INFO: Record<Fase, { label: string; definicao: string }> = {
  cadastrou: {
    label: "Cadastrou",
    definicao: "Criou a conta e ainda não fez nada.",
  },
  ativou_teste: {
    // Era "Ativou o teste". Estava ao lado de "Ativado" e as duas começavam
    // igual — foi assim que os conceitos se embaralharam.
    label: "Começou a usar",
    definicao: "Entrou e mexeu em alguma coisa, mas ainda não terminou o cadastro.",
  },
  ativado: {
    label: "Ativado",
    definicao:
      "Terminou o cadastro e chegou ao valor: usou algo, recebeu um plano ou conversou com a Ayla.",
  },
  engajado: {
    label: "Engajado",
    definicao: "Voltou — usou duas vezes ou mais, ou recebeu um plano e conversou com a Ayla.",
  },
  em_risco: {
    label: "Em risco",
    definicao: "Já tinha usado e parou — mais de 24h sem aparecer.",
  },
  oportunidade: {
    label: "Oportunidade",
    definicao: "Reta final do teste (dia 6 ou 7), já usou e ainda não assinou.",
  },
  convertido: {
    label: "Converteu",
    definicao: "Assinou e virou cliente — o teste terminou em conversão. 🎉",
  },
  expirado: {
    label: "Expirou sem assinar",
    definicao: "O teste acabou, ou a assinatura foi cancelada/pausada.",
  },
};

/** Ordem da jornada — para listas e abas. */
export const FASE_ORDEM: readonly Fase[] = [
  "cadastrou",
  "ativou_teste",
  "ativado",
  "engajado",
  "oportunidade",
  "em_risco",
  "expirado",
  "convertido",
] as const;

/**
 * Os fatos brutos sobre uma família. Nenhum deles é uma decisão — decidir é
 * trabalho de `classificarFase`.
 */
export type SinaisDaFamilia = {
  concluiuOnboarding: boolean;
  /**
   * Eventos de USO (tela visitada e afins não contam) nos últimos 90 dias.
   *
   * A janela está no NOME de propósito: quem lia `usos: 0` entendia "nunca
   * usou", quando pode ser "nada nos últimos 90 dias" — conclusão errada
   * sobre lead antigo.
   */
  usosUltimos90d: number;
  /** Qualquer evento, inclusive os que não contam como uso. */
  temAtividade: boolean;
  temPlano: boolean;
  falouComAyla: boolean;
  /** `null` quando nunca houve atividade — não é o mesmo que "parada há 0h". */
  horasSemAtividade: number | null;
  statusAssinatura: string | null;
  trialVencido: boolean;
  /** 1 a 7. */
  diaDoTrial: number;
};

/**
 * CHEGOU AO VALOR?
 *
 * Conversa com a Ayla CONTA (decisão de produto, Sérgio, 31/07/2026). A régua
 * antiga do drill-down exigia uso no app e ignorava o WhatsApp — ou seja,
 * media o produto pelo canal secundário. Uma mãe que terminou o cadastro e
 * fala com a Ayla todo dia está ativada, mesmo que nunca abra a web.
 */
export function recebeuValor(s: SinaisDaFamilia): boolean {
  return s.usosUltimos90d >= 1 || s.temPlano || s.falouComAyla;
}

export function estaAtivado(s: SinaisDaFamilia): boolean {
  return s.concluiuOnboarding && recebeuValor(s);
}

export function estaEngajado(s: SinaisDaFamilia): boolean {
  return s.usosUltimos90d >= 2 || (s.temPlano && s.falouComAyla);
}

/**
 * A fase atual. Estado ÚNICO e por prioridade: quem converteu não é "engajado
 * também", e quem está em risco não aparece como ativado.
 *
 * Pura de propósito — nada de banco, nada de relógio implícito. É o que
 * permite a tabela de casos em `fases.test.ts` ser o documento executável da
 * régua: quando a Karina quiser mudar a definição, muda a tabela.
 */
export function classificarFase(s: SinaisDaFamilia): Fase {
  if (s.statusAssinatura === "active") return "convertido";
  if (s.trialVencido || s.statusAssinatura === "canceled" || s.statusAssinatura === "paused") {
    return "expirado";
  }
  if (s.statusAssinatura !== "trialing") return "cadastrou";

  const usou = s.usosUltimos90d >= 1;
  const parada = s.horasSemAtividade != null && s.horasSemAtividade > 24;

  if (s.diaDoTrial >= 6 && usou) return "oportunidade";
  if (parada && usou) return "em_risco";
  if (estaEngajado(s)) return "engajado";
  if (estaAtivado(s)) return "ativado";
  if (s.temAtividade) return "ativou_teste";
  return "cadastrou";
}
