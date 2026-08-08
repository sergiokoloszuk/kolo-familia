import type { SupabaseClient } from "@supabase/supabase-js";
import { assinaturaLiberada, type AcessoAssinatura } from "@/lib/auth/assinatura";
import { sincronizarAssinaturaDoStripe } from "./sync";
import { logEvent } from "@/lib/log";

/**
 * RECONCILIAÇÃO POR DIVERGÊNCIA — Stripe → Kolo.
 *
 * A pergunta que este código faz é uma só:
 *
 *   "existe família que DEVERIA ter acesso segundo o Stripe, e a Kolo não
 *    está concedendo?"
 *
 * O reconciliador anterior perguntava outra coisa: "quem está em `past_due`?".
 * Isso é reagir a um estado específico, não procurar divergência — e deixava
 * invisível justamente a classe do incidente Rochelle, que era `trialing`
 * vencida. Um status errado diferente do previsto não era encontrado por
 * ninguém, e o único detector virava a reclamação da família.
 *
 * A população nova é definida por DUAS condições, nesta ordem, e as duas ANTES
 * de qualquer chamada ao Stripe:
 *
 *   1. tem vínculo com o Stripe (`stripe_customer_id` OU
 *      `stripe_subscription_id`) — filtrado no banco;
 *   2. NÃO tem acesso segundo `assinaturaLiberada`, a fonte única — filtrado em
 *      memória, porque a regra depende de datas (trial, graça, cortesia).
 *
 * Quem tem acesso nunca entra: não há chamada ao Stripe para família correta, e
 * não existe caminho por onde este código rebaixe alguém.
 */

type ClienteAdmin = SupabaseClient;

/** Linha da população, com o que `assinaturaLiberada` precisa para decidir. */
const COLUNAS =
  "family_account_id, status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em, stripe_customer_id, stripe_subscription_id";

export type Corrigida = {
  familyId: string;
  antes: string | null;
  depois: string;
  stripe: string;
};

export type NaoCorrigida = {
  familyId: string;
  statusAnterior: string | null;
  motivo: string;
};

export type ResultadoReconciliacao = {
  /** Linhas com vínculo Stripe avaliadas — o universo antes do filtro de acesso. */
  comVinculo: number;
  /** Famílias que entraram na população (vínculo + sem acesso). */
  candidatas: number;
  /** Divergência real: o Stripe dizia que havia direito e a Kolo não concedia. */
  corrigidas: Corrigida[];
  /** Tinha vínculo e segue sem acesso — mas o Stripe confirma que é correto. */
  verificadasSemAcesso: number;
  /** Não deu para resolver com segurança. Vira alerta operacional. */
  naoCorrigidas: NaoCorrigida[];
  /** Quantas vezes o Stripe foi consultado nesta execução. */
  chamadasStripe: number;
};

type Dependencias = {
  /** Injetável só para teste; em produção é sempre o re-sync de verdade. */
  sincronizar?: typeof sincronizarAssinaturaDoStripe;
  /** Relógio injetável só para teste da janela do pulso. */
  agora?: number;
};

/** Marca, em `eventos_app`, que o alerta operacional foi disparado. */
export const KIND_ALERTA_OPERACIONAL = "reconciliacao_alerta_operacional";
const JANELA_ALERTA_HORAS = 12;

/** Pulso de saúde: prova de que a reconciliação rodou mesmo sem nada a fazer. */
export const KIND_PULSO = "reconciliacao_pulso";
/**
 * 20h, não 24: com o cron de hora em hora, uma janela de 24h "anda" pra frente
 * a cada dia e acaba pulando um dia. 20h garante pelo menos um pulso por dia.
 */
const JANELA_PULSO_HORAS = 20;

/**
 * Janela de deduplicação sobre `eventos_app` — o estado de coordenação vive no
 * banco (§8: ambiente serverless não tem memória entre invocações), sem tabela
 * nova. Na dúvida (erro na leitura), responde "não houve registro recente":
 * para o alerta, emudecer é pior que repetir; para o pulso, um registro a mais
 * não faz mal.
 */
async function registroRecente(
  admin: ClienteAdmin,
  kind: string,
  janelaHoras: number,
  agora: number,
): Promise<boolean> {
  const desde = new Date(agora - janelaHoras * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("eventos_app")
    .select("id")
    .eq("kind", kind)
    .gte("created_at", desde)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

/**
 * ANTI-SPAM do alerta operacional. A divergência que o reconciliador não
 * consegue resolver **persiste** entre execuções — e o cron roda de hora em
 * hora. Sem esta trava, uma única família travada mandaria 24 mensagens por
 * dia, indefinidamente, e a pessoa aprenderia a ignorar o alerta justamente
 * quando ele estivesse certo.
 */
export async function alertaOperacionalRecente(
  admin: ClienteAdmin,
  agora: number = Date.now(),
): Promise<boolean> {
  return registroRecente(admin, KIND_ALERTA_OPERACIONAL, JANELA_ALERTA_HORAS, agora);
}

/** Já houve pulso na janela? Se sim, a execução limpa não registra de novo. */
export async function pulsoRecente(
  admin: ClienteAdmin,
  agora: number = Date.now(),
): Promise<boolean> {
  return registroRecente(admin, KIND_PULSO, JANELA_PULSO_HORAS, agora);
}

export async function reconciliarDivergencias(
  admin: ClienteAdmin,
  deps: Dependencias = {},
): Promise<ResultadoReconciliacao> {
  const sincronizar = deps.sincronizar ?? sincronizarAssinaturaDoStripe;
  const agora = deps.agora ?? Date.now();

  // Filtro 1 (no banco): só quem tem vínculo com o Stripe. Sem isto, a varredura
  // leria todas as famílias — e nenhuma delas pode ser resolvida sem vínculo.
  const { data, error } = await admin
    .from("subscription_accesses")
    .select(COLUNAS)
    .or("stripe_customer_id.not.is.null,stripe_subscription_id.not.is.null");

  // A leitura da população precisa ser conferida: antes, um SELECT que falhasse
  // deixava `data` indefinido, o laço não rodava e a resposta era "0 problemas"
  // — indistinguível de "está tudo certo". O reconciliador podia estar morto há
  // semanas com o mesmo sinal de saúde.
  if (error) {
    await logEvent({
      kind: "reconciliacao_divergencia",
      severity: "error",
      message: `falha ao ler a população de reconciliação: ${error.message}`,
      payload: { resultado: "erro_leitura" },
    });
    throw new Error(`reconciliação: falha ao ler a população — ${error.message}`);
  }

  // Filtro 2 (em memória): sem acesso pela FONTE ÚNICA. Não se reimplementa a
  // regra aqui — trial, graça de dunning e cortesia já vivem em `assinaturaLiberada`.
  const candidatas = (data ?? []).filter(
    (linha) => !assinaturaLiberada(linha as unknown as AcessoAssinatura),
  );

  const resultado: ResultadoReconciliacao = {
    comVinculo: (data ?? []).length,
    candidatas: candidatas.length,
    corrigidas: [],
    verificadasSemAcesso: 0,
    naoCorrigidas: [],
    chamadasStripe: 0,
  };

  await logEvent({
    kind: "reconciliacao_divergencia",
    severity: "info",
    message: `reconciliação iniciada: ${candidatas.length} candidata(s)`,
    payload: { resultado: "inicio", candidatas: candidatas.length, com_vinculo: (data ?? []).length },
  });

  for (const linha of candidatas) {
    const familyId = (linha as { family_account_id: string }).family_account_id;
    const statusAnterior = ((linha as { status?: string | null }).status ?? null) as string | null;

    try {
      resultado.chamadasStripe += 1;
      const r = await sincronizar(admin, familyId);

      if (!r.ok) {
        resultado.naoCorrigidas.push({ familyId, statusAnterior, motivo: r.error });
        await logEvent({
          kind: "reconciliacao_divergencia",
          severity: "error",
          message: "não foi possível reconciliar esta família",
          family_account_id: familyId,
          payload: { resultado: "nao_corrigida", status_anterior: statusAnterior, erro: r.error },
        });
        continue;
      }

      // A pergunta certa não é "mudou o status?", é "agora tem acesso?". Um
      // `trialing` gravado sobre um trial vencido muda o status e não libera
      // nada — o reconciliador antigo contaria isso como conserto.
      const { data: depoisDoSync } = await admin
        .from("subscription_accesses")
        .select(COLUNAS)
        .eq("family_account_id", familyId)
        .maybeSingle();
      const liberada = assinaturaLiberada(depoisDoSync as unknown as AcessoAssinatura);

      if (liberada) {
        resultado.corrigidas.push({
          familyId,
          antes: r.antes,
          depois: r.depois,
          stripe: r.stripeStatus,
        });
        await logEvent({
          kind: "reconciliacao_divergencia",
          severity: "warn", // persiste: divergência real corrigida
          message: "divergência corrigida — o Stripe confirmava o direito e a Kolo não concedia",
          family_account_id: familyId,
          payload: {
            resultado: "corrigida",
            status_anterior: r.antes,
            status_final: r.depois,
            stripe_status: r.stripeStatus,
            mudou: r.mudou,
          },
        });
      } else {
        // O Stripe confirma que não há direito. Bloqueio correto: registra a
        // verificação e NÃO gera alerta de correção.
        resultado.verificadasSemAcesso += 1;
        await logEvent({
          kind: "reconciliacao_divergencia",
          severity: "info",
          message: "sem acesso e o Stripe confirma — bloqueio correto",
          family_account_id: familyId,
          payload: {
            resultado: "verificada_sem_acesso",
            status_anterior: r.antes,
            status_final: r.depois,
            stripe_status: r.stripeStatus,
          },
        });
      }
    } catch (e) {
      // Uma família não derruba as outras — mas também não desaparece num
      // `catch {}` vazio, que era o comportamento anterior.
      const motivo = e instanceof Error ? e.message : "erro desconhecido";
      resultado.naoCorrigidas.push({ familyId, statusAnterior, motivo });
      await logEvent({
        kind: "reconciliacao_divergencia",
        severity: "error",
        message: "erro ao reconciliar esta família",
        family_account_id: familyId,
        payload: { resultado: "nao_corrigida", status_anterior: statusAnterior, erro: motivo },
      });
    }
  }

  const numeros = {
    com_vinculo: resultado.comVinculo,
    candidatas: resultado.candidatas,
    corrigidas: resultado.corrigidas.length,
    verificadas_sem_acesso: resultado.verificadasSemAcesso,
    nao_corrigidas: resultado.naoCorrigidas.length,
    chamadas_stripe: resultado.chamadasStripe,
  };
  const houveOQueContar =
    resultado.corrigidas.length > 0 || resultado.naoCorrigidas.length > 0;

  await logEvent({
    kind: "reconciliacao_divergencia",
    // Divergência e falha persistem NA HORA. Execução limpa fica em stdout —
    // quem prova que ela aconteceu é o pulso, logo abaixo.
    severity: houveOQueContar ? "warn" : "info",
    message: `reconciliação concluída: ${resultado.corrigidas.length} corrigida(s), ${resultado.naoCorrigidas.length} não corrigida(s)`,
    payload: { resultado: "resumo", ...numeros },
  });

  // PULSO DE SAÚDE. Sem ele, uma execução limpa não deixa rastro nenhum — e,
  // de fora, "rodou e estava tudo certo" fica indistinguível de "não rodou".
  // Persistir as 24 execuções do dia seria o outro extremo: ruído que ninguém
  // lê. Um por janela resolve os dois — sinal sem ruído.
  //
  // Quando houve o que contar, o próprio resumo acima já persistiu e prova a
  // execução; o pulso não repete a informação.
  if (!houveOQueContar && !(await pulsoRecente(admin, agora))) {
    await logEvent({
      kind: KIND_PULSO,
      severity: "warn", // `warn` é o piso que persiste em eventos_app
      message: "reconciliação viva — executou e não havia divergência",
      payload: { resultado: "pulso", ...numeros },
    });
  }

  return resultado;
}
