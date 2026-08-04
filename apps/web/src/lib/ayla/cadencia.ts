import type { SupabaseClient } from "@supabase/supabase-js";
import { segurancaAberta } from "./estado-seguranca";
import type { AylaTipoProativa } from "./types";

/**
 * CADÊNCIA DAS PROATIVAS — uma família não recebe duas mensagens espontâneas
 * coladas.
 *
 * O CASO REAL (01/08/2026): 08:00 chegou uma sugestão espontânea; 08:01, uma
 * cobrança de acompanhamento do plano. Duas mensagens da Ayla em um minuto,
 * sem a mãe ter escrito nada.
 *
 * A causa não era o relógio, era a AUSÊNCIA DE DONO DA CADÊNCIA. O `vercel.json`
 * agenda cinco tipos no mesmo minuto (`0 11,15,18,22` UTC = 08:00 em Brasília,
 * exatamente o horário observado), e cada cron tinha a SUA idempotência —
 * "rotina já enviada hoje", "fim de semana já enviado hoje", "idempotência 24h".
 * Cada um pergunta apenas "eu já mandei o MEU tipo?". Dois tipos diferentes
 * respondem "não" e os dois enviam. Escalonar os horários reduziria a colisão
 * sem resolver o problema: ninguém era responsável pelo conjunto.
 *
 * A trava vive no ponto por onde TODA proativa passa (`enviarEPersistir`), e
 * nunca toca em resposta à família: ela só olha `category === "proativa"`.
 * Mensagem da mãe sempre é respondida — essa é a regra que não se negocia.
 *
 * CONCORRÊNCIA. Dois crons disparam em paralelo, então "consultar e depois
 * enviar" não basta: os dois consultam antes de qualquer um registrar. Por isso
 * o fluxo é RESERVA → CONFERE → ENVIA, usando o `status: 'enfileirada'` que o
 * schema de `ayla_send_log` já prevê desde a 0001 e nunca foi usado:
 *
 *   1. cada candidato INSERE a própria reserva ('enfileirada');
 *   2. depois LÊ a janela e compara com as reservas alheias;
 *   3. vence a mais antiga (desempate por id, que é total e estável);
 *   4. quem perde apaga a própria reserva e desiste — sem enviar.
 *
 * Como todos comparam o mesmo critério, exatamente um sobrevive. Se o outro
 * inserir depois da minha leitura, ele me vê (sou mais antigo) e desiste.
 *
 * SEM MIGRAÇÃO: usa tabela, colunas e status que já existem.
 */

/**
 * Janela de silêncio entre duas proativas para a mesma família.
 *
 * 3 horas, e o número vem dos crons: eles rodam às 11, 15, 18 e 22 UTC (08:00,
 * 12:00, 15:00 e 19:00 em Brasília), com 3 a 4 horas entre eles. Uma janela de
 * 3h deixa CADA horário entregar uma mensagem — mata a sobreposição sem matar
 * a cadência do dia. Mais que isso começaria a comer horários inteiros.
 */
export const JANELA_CADENCIA_MS = 3 * 60 * 60 * 1000;

/**
 * Os tipos que NÃO esperam, porque para eles o silêncio é pior que a
 * sobreposição — e porque não têm um "próximo horário" equivalente:
 *
 * - `boas_vindas`: a primeira mensagem da relação. Atrasar é começar errado.
 * - `trial_d0` / `trial_d3`: presos ao ciclo de vida da assinatura; adiar muda
 *   o sentido da mensagem.
 * - `crianca_especifica`: a Ayla está sem saber de quem a família fala; segurar
 *   isso trava a conversa inteira.
 * - `campanha_operacional`: aviso de serviço (queda, mudança), não conversa.
 * - `dass21_resultado_severo`: devolutiva de um instrumento de saúde mental com
 *   sinais intensos. Não se enfileira.
 *
 * Todo o resto — incluindo `plano_seguimento` e `recuperacao_plano`, que são
 * justamente a metade do caso real — respeita a janela. Acompanhamento é útil;
 * acompanhamento um minuto depois de outra mensagem é chateação.
 */
export const PROATIVAS_ISENTAS: ReadonlySet<string> = new Set<AylaTipoProativa>([
  "boas_vindas",
  "trial_d0",
  "trial_d3",
  "crianca_especifica",
  "campanha_operacional",
  "dass21_resultado_severo",
]);

export function proativaIsentaDeCadencia(tipo: string): boolean {
  return PROATIVAS_ISENTAS.has(tipo);
}

export type Reserva =
  | { ok: true; reservaId: string }
  | { ok: false; motivo: string };

type LinhaReserva = { id: string; created_at: string; template_key: string };

/**
 * Uma reserva é "mais antiga" que a outra pelo par (created_at, id). O id entra
 * como desempate porque dois inserts no mesmo milissegundo são plausíveis — sem
 * ele, ambos poderiam se achar perdedores e ninguém enviaria.
 */
function maisAntiga(a: LinhaReserva, b: LinhaReserva): boolean {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at;
  return a.id < b.id;
}

/**
 * Tenta reservar o direito de enviar uma proativa agora.
 *
 * `{ ok: true }` → pode enviar, e a reserva já é a linha de log deste envio
 * (quem chama a atualiza no fim).
 * `{ ok: false }` → outra proativa ocupou a janela; NÃO envie.
 *
 * Falha de infraestrutura devolve `ok: true`: uma trava de cadência não pode
 * silenciar a Ayla se o banco piscar. O risco de mandar duas é menor que o de
 * não mandar nenhuma.
 */
export async function reservarEnvioProativo(
  supabase: SupabaseClient,
  params: {
    familyAccountId: string;
    tipo: string;
    agora?: Date;
    janelaMs?: number;
  },
): Promise<Reserva> {
  const agora = params.agora ?? new Date();
  const janela = params.janelaMs ?? JANELA_CADENCIA_MS;

  // ── SEGURANÇA ABERTA SILENCIA A PROATIVA ───────────────────────────────
  // Uma criança em risco, a mãe tentando falar com o psiquiatra — e a Ayla
  // chegando com "que tal montar a rotina da semana?". O bloqueio do fluxo
  // reativo não alcançava os crons, que entram por aqui.
  //
  // SUPRIME o envio; não encerra nem apaga o estado. E vale pra TODOS os
  // tipos, inclusive os isentos de cadência: a isenção existe pra que uma
  // boas-vindas não seja engolida por uma rotina, não pra furar uma crise.
  try {
    const cri = await segurancaAberta(supabase, params.familyAccountId, agora);
    if (cri.aberta) {
      console.warn(
        `[ayla:cadencia] proativa "${params.tipo}" SUPRIMIDA — segurança aberta desde ${cri.desde}`,
      );
      return { ok: false, motivo: "seguranca_aberta" };
    }
  } catch {
    // Falha na consulta não pode travar toda proativa do produto.
  }

  try {
    const { data: minha, error } = await supabase
      .from("ayla_send_log")
      .insert({
        family_account_id: params.familyAccountId,
        template_key: params.tipo,
        status: "enfileirada",
        payload: { cadencia: { reservadoEm: agora.toISOString() } },
      })
      .select("id, created_at, template_key")
      .single();

    if (error || !minha) return { ok: true, reservaId: "" };

    const desde = new Date(agora.getTime() - janela).toISOString();
    const { data: naJanela } = await supabase
      .from("ayla_send_log")
      .select("id, created_at, template_key")
      .eq("family_account_id", params.familyAccountId)
      .gte("created_at", desde)
      .in("status", ["enfileirada", "enviada"]);

    const concorrentes = (naJanela ?? []).filter(
      (l) =>
        (l as LinhaReserva).id !== (minha as LinhaReserva).id &&
        !proativaIsentaDeCadencia((l as LinhaReserva).template_key),
    ) as LinhaReserva[];

    const perdi = concorrentes.some((outra) =>
      maisAntiga(outra, minha as LinhaReserva),
    );

    if (perdi) {
      // Some com a própria reserva: ela não virou envio, e deixá-la para trás
      // bloquearia a janela seguinte por uma mensagem que nunca existiu.
      await supabase
        .from("ayla_send_log")
        .delete()
        .eq("id", (minha as LinhaReserva).id);
      return { ok: false, motivo: "cadencia: outra proativa na janela" };
    }

    return { ok: true, reservaId: (minha as LinhaReserva).id };
  } catch {
    return { ok: true, reservaId: "" };
  }
}
