import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveTelefoneBR } from "@/lib/telefone";
import { encerrarTrialPorNumeroDeOutraConta } from "@/lib/trial/ledger";
import { logEvent, logServerError } from "@/lib/log";

/**
 * A PORTA DO WHATSAPP — o que acontece em volta da verificação.
 *
 * `verificacao.ts` responde "este número é mesmo desta pessoa?". Este arquivo
 * responde as outras duas perguntas que as três portas faziam cada uma do seu
 * jeito: "este número já é de outra família?" e "o que gravar quando a pessoa
 * confirma?".
 *
 * ── por que existe ────────────────────────────────────────────────────────
 *
 * A checagem de duplicado estava escrita DUAS vezes, quase igual, em
 * `onboarding/actions.ts` (tradicional) e `salvar-conversacional.ts`
 * (conversacional) — mesma regra de negócio, dois donos. O §4 do protocolo
 * manda consolidar antes de acrescentar, e a Fase 2A ia criar um TERCEIRO
 * chamador (o painel). Três cópias da mesma regra divergem; uma não.
 *
 * ── a inversão que esta frente faz ────────────────────────────────────────
 *
 * ⚠️ ANTES, os dois onboardings gravavam `family_accounts.whatsapp_e164`
 * ANTES de qualquer confirmação — e é DESSE campo que a Ayla lê para escrever
 * às famílias. Ou seja: bastava digitar o número de um terceiro para a Ayla
 * passar a mandar mensagem para ele. A gravação agora acontece **só aqui**, e
 * só depois de `confirmarCodigo` ter dado certo.
 */

/** Motivos que a porta devolve. `duplicado` é regra de negócio, não falha. */
export type ResultadoPorta =
  | { ok: true }
  | { ok: false; motivo: "duplicado" | "erro" };

/**
 * O número já pertence a outra família?
 *
 * Compara pela chave normalizada (9º dígito / código de país), não pela
 * string — dois formatos do mesmo telefone precisam colidir. Usa cliente
 * service-role de propósito: a RLS esconderia justamente as outras famílias,
 * que são o que se quer enxergar aqui. O índice único do banco continua sendo
 * o backstop; esta é a proteção que dá mensagem decente para a pessoa.
 *
 * ⚠️ EFEITO COLATERAL PRESERVADO, NÃO INVENTADO: quando há conflito, o teste
 * da conta nova encerra — é a regra "1 número = 1 teste, para sempre", que já
 * valia nos dois onboardings. `contexto` continua vindo de quem chama, para
 * que o evento em `eventos_app` siga dizendo de qual porta veio.
 */
export async function numeroDeOutraConta(
  admin: SupabaseClient,
  params: { familyId: string; telefone: string; contexto: string },
): Promise<boolean> {
  const chave = chaveTelefoneBR(params.telefone);
  if (!chave) return false;

  const { data: outras, error } = await admin
    .from("family_accounts")
    .select("id, whatsapp_e164")
    .not("whatsapp_e164", "is", null)
    .neq("id", params.familyId);

  if (error) {
    // Fail-closed: não sabendo responder, não deixa passar como "livre" — um
    // falso "não é duplicado" mandaria código para o número de outra família.
    await logServerError("whatsapp_duplicado_leitura_falhou", error, {
      family_account_id: params.familyId,
    });
    throw new Error("Não consegui conferir o número agora. Tente de novo.");
  }

  const conflito = (outras ?? []).some(
    (f) => chaveTelefoneBR(f.whatsapp_e164 as string) === chave,
  );
  if (conflito) {
    await encerrarTrialPorNumeroDeOutraConta(admin, {
      familyId: params.familyId,
      contexto: params.contexto,
    });
  }
  return conflito;
}

/** A mensagem única de número duplicado — mesma frase nas três portas. */
export const MSG_DUPLICADO =
  "Esse número de WhatsApp já está em uso por outra conta. Use o número que você usa no WhatsApp, ou fale com o suporte se achar que é um engano.";

/**
 * O que acontece QUANDO A PESSOA CONFIRMA — e só então.
 *
 * Duas escritas, as duas conferidas (§7): o número na conta, e a Ayla ligada
 * com o consentimento datado. Nenhuma delas pode falhar em silêncio, porque
 * juntas são a diferença entre "a Ayla vai falar com você" e "a Ayla não vai".
 *
 * ⚠️ NÃO TOCA ASSINATURA, TESTE NEM STRIPE. Confirmar o WhatsApp não começa,
 * não estende e não encerra teste nenhum — o gatilho `handle_new_user` segue
 * dono disso até a Fase 3 (migração 0082, fora desta frente).
 *
 * Idempotente: rodar duas vezes com o mesmo número deixa o mesmo estado. O
 * `consentimento_em` só é escrito na primeira vez — reconfirmar um número não
 * reescreve a data em que a família disse sim.
 */
export async function concluirVerificacao(
  admin: SupabaseClient,
  params: { familyId: string; telefone: string },
): Promise<ResultadoPorta> {
  const { familyId, telefone } = params;
  try {
    const { error: eNum } = await admin
      .from("family_accounts")
      .update({ whatsapp_e164: telefone })
      .eq("id", familyId);

    if (eNum) {
      // 23505 = índice único `family_accounts_whatsapp_unico` (0038). Chegar
      // aqui é corrida: alguém gravou o mesmo número entre a checagem e agora.
      if (eNum.code === "23505") {
        await encerrarTrialPorNumeroDeOutraConta(admin, {
          familyId,
          contexto: "verificacao/unique",
        });
        return { ok: false, motivo: "duplicado" };
      }
      await logServerError("whatsapp_gravar_numero_falhou", eNum, {
        family_account_id: familyId,
      });
      return { ok: false, motivo: "erro" };
    }

    const { data: pref, error: eLer } = await admin
      .from("ayla_preferences")
      .select("consentimento_em")
      .eq("family_account_id", familyId)
      .maybeSingle();
    if (eLer) {
      await logServerError("whatsapp_ler_preferencias_falhou", eLer, {
        family_account_id: familyId,
      });
      return { ok: false, motivo: "erro" };
    }

    const jaConsentiu = Boolean(pref?.consentimento_em);
    const { error: ePref } = await admin.from("ayla_preferences").upsert(
      {
        family_account_id: familyId,
        desativada: false,
        // Preserva a data original de quem já tinha consentido.
        consentimento_em: jaConsentiu
          ? (pref!.consentimento_em as string)
          : new Date().toISOString(),
      },
      { onConflict: "family_account_id" },
    );
    if (ePref) {
      await logServerError("whatsapp_ativar_ayla_falhou", ePref, {
        family_account_id: familyId,
      });
      return { ok: false, motivo: "erro" };
    }

    await logEvent({
      kind: "whatsapp_confirmado",
      severity: "info",
      persistir: true,
      family_account_id: familyId,
      // Sem o telefone: quem precisa dele lê da conta, com autorização.
      message: jaConsentiu
        ? "WhatsApp confirmado (consentimento já existia)"
        : "WhatsApp confirmado e Ayla ativada",
      payload: { consentimento_novo: !jaConsentiu },
    });
    return { ok: true };
  } catch (e) {
    await logServerError("whatsapp_concluir_excecao", e, {
      family_account_id: familyId,
    });
    return { ok: false, motivo: "erro" };
  }
}
