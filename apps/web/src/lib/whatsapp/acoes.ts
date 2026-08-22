"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  solicitarCodigo,
  confirmarCodigo,
  estaVerificado,
  MAX_TENTATIVAS,
  MAX_REENVIOS,
  VALIDADE_MIN,
} from "./verificacao";
import { numeroDeOutraConta, concluirVerificacao, MSG_DUPLICADO } from "./porta";

/**
 * AS AÇÕES DA PORTA — o que as três telas chamam.
 *
 * Onboarding tradicional, onboarding conversacional e o card do painel usam
 * ESTAS funções. Não existe segunda implementação: quem quiser confirmar um
 * WhatsApp na Kolo passa por aqui, e daqui por `verificacoes_whatsapp`.
 *
 * A camada é fina de propósito — resolve a família a partir da sessão, aplica
 * a regra de duplicado e delega. A criptografia mora em `verificacao.ts`, as
 * escritas moram em `porta.ts`. Aqui não há decisão de segurança nova.
 */

/** Mesma validação do onboarding (tela-1) e do painel: E.164 brasileiro. */
const telefoneSchema = z
  .string()
  .trim()
  .regex(/^\+55\d{10,11}$/, "Informe o DDD + número, ex: (11) 99999-9999");

export type EstadoWhatsapp = {
  /** Número que a família já tem confirmado na conta, se houver. */
  confirmado: string | null;
  /** Número que está com um código pendente, se houver. */
  pendente: string | null;
  /** Já existe consentimento datado? Família antiga não reconfirma à toa. */
  consentiu: boolean;
};

export type ResultadoPedido =
  | { ok: true }
  | { ok: false; erro: string; motivo: "cooldown"; segundosRestantes: number }
  | { ok: false; erro: string; motivo: "duplicado" | "max_reenvios" | "envio_falhou" | "invalido" | "erro" };

export type ResultadoConfirma =
  | { ok: true }
  | {
      ok: false;
      erro: string;
      motivo:
        | "sem_pedido"
        | "expirado"
        | "max_tentativas"
        | "codigo_errado"
        | "duplicado"
        | "invalido"
        | "erro";
    };

async function familiaDaSessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre de novo.");

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id, whatsapp_e164")
    .eq("user_id", user.id)
    .single();
  if (!family) throw new Error("Conta não encontrada.");
  return { family };
}

/** O que a tela precisa saber para se desenhar sem perguntar de novo. */
export async function estadoWhatsapp(): Promise<EstadoWhatsapp> {
  const { family } = await familiaDaSessao();
  const admin = createServiceRoleClient();

  const { data: pref } = await admin
    .from("ayla_preferences")
    .select("consentimento_em")
    .eq("family_account_id", family.id)
    .maybeSingle();

  const { data: verif } = await admin
    .from("verificacoes_whatsapp")
    .select("telefone_e164, verificado_em")
    .eq("family_account_id", family.id)
    .maybeSingle();

  const numeroDaConta = (family.whatsapp_e164 as string | null) ?? null;
  const verificadoAqui = Boolean(verif?.verificado_em);

  return {
    confirmado: verificadoAqui ? ((verif!.telefone_e164 as string) ?? null) : null,
    pendente: verif && !verif.verificado_em ? ((verif.telefone_e164 as string) ?? null) : numeroDaConta,
    consentiu: Boolean(pref?.consentimento_em),
  };
}

/**
 * Passo 1 — pedir o código.
 *
 * A checagem de duplicado vem ANTES do envio: não faz sentido mandar mensagem
 * para um número que já pertence a outra família, e mandar seria incômodo
 * contra terceiro.
 */
export async function pedirCodigoWhatsapp(input: { telefone: string }): Promise<ResultadoPedido> {
  const parsed = telefoneSchema.safeParse(input.telefone);
  if (!parsed.success) {
    return { ok: false, motivo: "invalido", erro: parsed.error.issues[0]?.message ?? "Número inválido" };
  }
  const telefone = parsed.data;

  try {
    const { family } = await familiaDaSessao();
    const admin = createServiceRoleClient();

    if (await numeroDeOutraConta(admin, { familyId: family.id, telefone, contexto: "verificacao" })) {
      return { ok: false, motivo: "duplicado", erro: MSG_DUPLICADO };
    }

    const r = await solicitarCodigo(admin, { familyId: family.id, telefone });
    if (r.ok) return { ok: true };

    if (r.motivo === "cooldown") {
      return {
        ok: false,
        motivo: "cooldown",
        segundosRestantes: r.segundosRestantes,
        erro: `Aguarde ${r.segundosRestantes}s para pedir outro código.`,
      };
    }
    if (r.motivo === "max_reenvios") {
      return {
        ok: false,
        motivo: "max_reenvios",
        erro: `Você já pediu o código ${MAX_REENVIOS} vezes. Confira se o número está certo e corrija se precisar.`,
      };
    }
    if (r.motivo === "envio_falhou") {
      return {
        ok: false,
        motivo: "envio_falhou",
        erro: "Não consegui enviar o código pra esse número. Confira se está certo e se ele tem WhatsApp.",
      };
    }
    return { ok: false, motivo: "erro", erro: "Não consegui pedir o código agora. Tente de novo." };
  } catch (e) {
    return {
      ok: false,
      motivo: "erro",
      erro: e instanceof Error ? e.message : "Não consegui pedir o código agora.",
    };
  }
}

/**
 * Passo 2 — conferir o código e, só então, gravar.
 *
 * ⚠️ A ORDEM É A REGRA: `confirmarCodigo` primeiro, `concluirVerificacao`
 * depois. Não existe caminho neste arquivo que grave o número ou ligue a Ayla
 * sem o `ok: true` do mecanismo.
 */
export async function confirmarCodigoWhatsapp(input: {
  telefone: string;
  codigo: string;
}): Promise<ResultadoConfirma> {
  const parsed = telefoneSchema.safeParse(input.telefone);
  if (!parsed.success) {
    return { ok: false, motivo: "invalido", erro: "Número inválido." };
  }
  const telefone = parsed.data;
  const codigo = (input.codigo ?? "").replace(/\D/g, "");
  if (codigo.length !== 6) {
    return { ok: false, motivo: "invalido", erro: "Digite os 6 números do código." };
  }

  try {
    const { family } = await familiaDaSessao();
    const admin = createServiceRoleClient();

    const r = await confirmarCodigo(admin, { familyId: family.id, telefone, codigo });
    if (!r.ok) {
      const erro =
        r.motivo === "expirado"
          ? `O código expirou (vale ${VALIDADE_MIN} minutos). Peça um novo.`
          : r.motivo === "max_tentativas"
            ? `Você errou o código ${MAX_TENTATIVAS} vezes. Peça um código novo para tentar de novo.`
            : r.motivo === "sem_pedido"
              ? "Peça um código para este número antes de confirmar."
              : r.motivo === "codigo_errado"
                ? "Código errado. Confira no WhatsApp e tente de novo."
                : "Não consegui confirmar agora. Tente de novo.";
      return { ok: false, motivo: r.motivo, erro };
    }

    const gravou = await concluirVerificacao(admin, { familyId: family.id, telefone });
    if (!gravou.ok) {
      return gravou.motivo === "duplicado"
        ? { ok: false, motivo: "duplicado", erro: MSG_DUPLICADO }
        : { ok: false, motivo: "erro", erro: "Confirmei o código, mas não consegui salvar. Tente de novo." };
    }

    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      motivo: "erro",
      erro: e instanceof Error ? e.message : "Não consegui confirmar agora.",
    };
  }
}

/** Usado pelos gates: este número, desta família, está confirmado? */
export async function whatsappEstaConfirmado(telefone: string): Promise<boolean> {
  try {
    const { family } = await familiaDaSessao();
    const admin = createServiceRoleClient();
    return await estaVerificado(admin, { familyId: family.id, telefone });
  } catch {
    return false;
  }
}
