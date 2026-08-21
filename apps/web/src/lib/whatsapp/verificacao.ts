import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarTexto } from "@/lib/ayla/whatsappSender";
import { logEvent, logServerError } from "@/lib/log";

/**
 * VERIFICAÇÃO DO WHATSAPP — UM MECANISMO SÓ, PARA AS TRÊS PORTAS.
 *
 * ── de onde isto vem ──────────────────────────────────────────────────────
 *
 * O fluxo de código por WhatsApp **já existia** em `painel/ativar-actions.ts`,
 * escondido atrás do nome "ativação". Ele gerava 6 dígitos, mandava pela Z-API
 * para o número informado e conferia — com a intuição certa escrita no próprio
 * comentário: *"se o número for de terceiro, o código vai pra ELE e o
 * brincalhão não consegue confirmar"*.
 *
 * O que faltava não era o mecanismo; era o que fica em volta dele:
 *
 *   · **limite de tentativas** — 6 dígitos sem limite é um milhão de palpites;
 *   · **teto de reenvios e cooldown** — cada clique era uma mensagem na Z-API,
 *     e mandar código repetido para número alheio é incômodo contra terceiro;
 *   · **estado que sobrevive ao navegador** — o cookie zerava qualquer
 *     contagem quando a pessoa trocava de aparelho;
 *   · **um segredo que não fosse público** — ver a nota de SEGREDO abaixo.
 *
 * ── por que o estado saiu do cookie ───────────────────────────────────────
 *
 * A decisão registrada era "cookie como transporte, tabela como estado". Ao
 * implementar, o cookie ficou sem função: a família já vem da sessão, e o
 * desafio inteiro (hash, telefone, validade, tentativas, reenvios) precisa
 * viver no banco justamente para os limites valerem entre dispositivos. Manter
 * os dois seria duas fontes para a mesma verdade — o erro que a frente de
 * preços custou caro para desfazer. `verificacoes_whatsapp` (0080) é a fonte.
 */

/** 6 dígitos — o mesmo formato que o `/signup` já usa para o e-mail. */
const DIGITOS = 6;
/** Tempo de sair do navegador, abrir o WhatsApp e voltar. */
export const VALIDADE_MIN = 10;
/** 1 em 200 mil por palpite; 5 erros é digitação, não ataque. */
export const MAX_TENTATIVAS = 5;
/** Acima disso o problema é o número, e o caminho certo é corrigi-lo. */
export const MAX_REENVIOS = 3;
/** Evita rajada na Z-API e o duplo clique. */
export const COOLDOWN_REENVIO_SEG = 60;

export type ResultadoSolicitacao =
  | { ok: true }
  | { ok: false; motivo: "cooldown"; segundosRestantes: number }
  | { ok: false; motivo: "max_reenvios" | "envio_falhou" | "erro" };

export type ResultadoConfirmacao =
  | { ok: true }
  | { ok: false; motivo: "sem_pedido" | "expirado" | "max_tentativas" | "codigo_errado" | "erro" };

/** sha256 do código. O código em texto puro não é persistido em lugar nenhum. */
export function hashCodigo(codigo: string): string {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

/** 6 dígitos com gerador criptográfico — nunca um pseudoaleatório comum. */
export function gerarCodigo(): string {
  return String(crypto.randomInt(0, 10 ** DIGITOS)).padStart(DIGITOS, "0");
}

/**
 * A mensagem. Curta, sem marketing, sem link — só o que a pessoa precisa para
 * confirmar. Marketing aqui treinaria a família a ignorar mensagem de código.
 */
export function textoDoCodigo(codigo: string): string {
  return (
    `Seu código de confirmação da Kolo é: ${codigo}\n\n` +
    `Use este código para confirmar seu WhatsApp. ` +
    `Ele expira em ${VALIDADE_MIN} minutos.`
  );
}

type AdminClient = SupabaseClient;

type Linha = {
  telefone_e164: string;
  expira_em: string;
  tentativas: number;
  reenvios: number;
  verificado_em: string | null;
  updated_at: string;
};

async function lerLinha(admin: AdminClient, familyId: string): Promise<Linha | null> {
  const { data } = await admin
    .from("verificacoes_whatsapp")
    .select("telefone_e164, expira_em, tentativas, reenvios, verificado_em, updated_at")
    .eq("family_account_id", familyId)
    .maybeSingle();
  return (data as Linha | null) ?? null;
}

/**
 * Pede um código para ESTE número.
 *
 * ⚠️ O CÓDIGO NUNCA SAI DAQUI. Não vai no retorno, não vai em log, não vai em
 * evento. O único lugar onde ele existe em texto puro é a mensagem que a Z-API
 * entrega ao telefone da pessoa.
 *
 * Reenviar ATUALIZA a linha (índice único por família, 0080): gera código novo,
 * invalida o anterior e zera as tentativas. Nunca cria uma segunda verificação
 * viva — é o que impede que retry ou duplo clique gerem estados paralelos.
 */
export async function solicitarCodigo(
  admin: AdminClient,
  params: { familyId: string; telefone: string },
): Promise<ResultadoSolicitacao> {
  const { familyId, telefone } = params;
  try {
    const atual = await lerLinha(admin, familyId);

    // Cooldown e teto valem para o MESMO número. Trocar de número é recomeçar:
    // quem digitou errado não pode ficar presa pelo limite do número errado.
    const mesmoNumero = atual?.telefone_e164 === telefone;
    if (atual && mesmoNumero) {
      const desdeUltimo = (Date.now() - new Date(atual.updated_at).getTime()) / 1000;
      if (desdeUltimo < COOLDOWN_REENVIO_SEG) {
        return {
          ok: false,
          motivo: "cooldown",
          segundosRestantes: Math.ceil(COOLDOWN_REENVIO_SEG - desdeUltimo),
        };
      }
      if (atual.reenvios >= MAX_REENVIOS) {
        return { ok: false, motivo: "max_reenvios" };
      }
    }

    const codigo = gerarCodigo();
    const expira = new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString();
    const reenvios = atual && mesmoNumero ? atual.reenvios + 1 : 0;

    // ⚠️ MANDA ANTES DE GRAVAR. Se a Z-API falhar, a pessoa não fica com um
    // desafio vivo que ela nunca recebeu — e o contador de reenvios não é
    // consumido por uma mensagem que não saiu. Fail-closed do lado certo.
    try {
      await enviarTexto({ phoneE164: telefone, texto: textoDoCodigo(codigo) });
    } catch (e) {
      // O erro da Z-API pode trazer o payload; nunca o repasse cru.
      await logServerError("otp_envio_falhou", new Error("Z-API recusou o envio"), {
        family_account_id: familyId,
      });
      void e;
      return { ok: false, motivo: "envio_falhou" };
    }

    const { error } = await admin.from("verificacoes_whatsapp").upsert(
      {
        family_account_id: familyId,
        telefone_e164: telefone,
        codigo_hash: hashCodigo(codigo),
        expira_em: expira,
        tentativas: 0,
        reenvios,
        verificado_em: null,
      },
      { onConflict: "family_account_id" },
    );
    if (error) {
      await logServerError("otp_gravar_falhou", error, { family_account_id: familyId });
      return { ok: false, motivo: "erro" };
    }

    await logEvent({
      kind: "otp_solicitado",
      severity: "info",
      persistir: true,
      family_account_id: familyId,
      message: `código solicitado · reenvio ${reenvios}`,
      // Sem telefone e sem código: nem um nem outro precisam estar aqui.
      payload: { reenvios, expira_em: expira },
    });
    return { ok: true };
  } catch (e) {
    await logServerError("otp_solicitar_excecao", e, { family_account_id: familyId });
    return { ok: false, motivo: "erro" };
  }
}

/**
 * Confere o código para ESTE número.
 *
 * ⚠️ O TELEFONE FAZ PARTE DA CONFERÊNCIA. Um código pedido para um número não
 * confirma outro — nem quando a pessoa troca o campo entre pedir e confirmar.
 * É a mesma amarração que faz "corrigir o número" invalidar o anterior.
 */
export async function confirmarCodigo(
  admin: AdminClient,
  params: { familyId: string; telefone: string; codigo: string },
): Promise<ResultadoConfirmacao> {
  const { familyId, telefone } = params;
  const codigo = (params.codigo ?? "").replace(/\D/g, "");
  try {
    const atual = await lerLinha(admin, familyId);
    if (!atual || atual.telefone_e164 !== telefone) {
      return { ok: false, motivo: "sem_pedido" };
    }
    if (new Date(atual.expira_em).getTime() <= Date.now()) {
      return { ok: false, motivo: "expirado" };
    }
    if (atual.tentativas >= MAX_TENTATIVAS) {
      return { ok: false, motivo: "max_tentativas" };
    }

    const { data: linha } = await admin
      .from("verificacoes_whatsapp")
      .select("codigo_hash")
      .eq("family_account_id", familyId)
      .maybeSingle();
    const esperado = (linha?.codigo_hash as string | undefined) ?? "";
    const recebido = codigo.length === DIGITOS ? hashCodigo(codigo) : "";

    // Comparação em tempo constante. Os dois lados são sha256 em hex, então o
    // comprimento é sempre igual quando o formato está certo.
    const confere =
      esperado.length > 0 &&
      recebido.length === esperado.length &&
      crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));

    if (!confere) {
      // ⚠️ A TENTATIVA É CONTADA ANTES DE QUALQUER OUTRA COISA. Se a escrita do
      // contador falhar, a resposta continua sendo "errado" — nunca "certo".
      await admin
        .from("verificacoes_whatsapp")
        .update({ tentativas: atual.tentativas + 1 })
        .eq("family_account_id", familyId);
      await logEvent({
        kind: "otp_falhou",
        severity: "warn",
        family_account_id: familyId,
        message: `código incorreto · tentativa ${atual.tentativas + 1}/${MAX_TENTATIVAS}`,
      });
      return { ok: false, motivo: "codigo_errado" };
    }

    const agora = new Date().toISOString();
    const { data, error } = await admin
      .from("verificacoes_whatsapp")
      .update({ verificado_em: agora })
      .eq("family_account_id", familyId)
      .eq("telefone_e164", telefone)
      .select("family_account_id");
    if (error || !data || data.length === 0) {
      await logServerError(
        "otp_marcar_verificado_falhou",
        error ?? new Error("update sem efeito"),
        { family_account_id: familyId },
      );
      return { ok: false, motivo: "erro" };
    }

    await logEvent({
      kind: "otp_verificado",
      severity: "info",
      persistir: true,
      family_account_id: familyId,
      message: "WhatsApp confirmado",
      payload: { em: agora },
    });
    return { ok: true };
  } catch (e) {
    await logServerError("otp_confirmar_excecao", e, { family_account_id: familyId });
    return { ok: false, motivo: "erro" };
  }
}

/** O número ATUAL da família está confirmado? É o que a 0081 também pergunta. */
export async function estaVerificado(
  admin: AdminClient,
  params: { familyId: string; telefone: string },
): Promise<boolean> {
  const atual = await lerLinha(admin, params.familyId);
  return Boolean(
    atual && atual.verificado_em && atual.telefone_e164 === params.telefone,
  );
}
