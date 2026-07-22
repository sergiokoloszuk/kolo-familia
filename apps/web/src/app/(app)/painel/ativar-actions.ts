"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import crypto from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enviarTexto } from "@/lib/ayla/whatsappSender";

// Mesma validação do onboarding (tela-1): E.164 brasileiro.
const schema = z.object({
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\+55\d{10,11}$/, "Informe o DDD + número, ex: (11) 99999-9999"),
});

export type AtivarResultado = { ok: true } | { ok: false; erro: string };

const COOKIE = "kolo_ativacao";
const TTL_MS = 10 * 60 * 1000; // 10 min

function segredo(): string {
  return process.env.AYLA_WEBHOOK_SECRET || process.env.NEXTAUTH_SECRET || "kolo-ativacao-dev";
}
function assinar(payload: string): string {
  return crypto.createHmac("sha256", segredo()).update(payload).digest("hex");
}

/**
 * Passo 1 da ativação: gera um código de 6 dígitos, MANDA no WhatsApp do número
 * informado e guarda a prova num cookie httpOnly assinado (HMAC) — stateless,
 * sem tabela nova. Se o número for de terceiro, o código vai pra ELE e o
 * "brincalhão" não consegue confirmar. Confirma que o WhatsApp é da pessoa.
 */
export async function enviarCodigoAtivacao(input: { whatsapp_e164: string }): Promise<AtivarResultado> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Número inválido" };
  }
  const whats = parsed.data.whatsapp_e164;

  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const exp = Date.now() + TTL_MS;
  const token = assinar(`${whats}.${codigo}.${exp}`);

  try {
    await enviarTexto({
      phoneE164: whats,
      texto: `Seu código de ativação da Kolo é: ${codigo} 🌿\n\nÉ só digitar ele no app pra ativar a Ayla. Vale por 10 minutos. Se não foi você, pode ignorar.`,
    });
  } catch {
    return { ok: false, erro: "Não consegui enviar o código pra esse número. Confira se está certo." };
  }

  const cookieVal = Buffer.from(`${whats}.${exp}.${token}`).toString("base64url");
  (await cookies()).set(COOKIE, cookieVal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TTL_MS / 1000,
    path: "/",
  });
  return { ok: true };
}

/**
 * Passo 2: confere o código digitado contra o cookie assinado. Se bate (e não
 * expirou), grava o número e ATIVA a Ayla (desativada=false, consentimento_em).
 */
export async function confirmarCodigoAtivacao(input: { codigo: string }): Promise<AtivarResultado> {
  const codigo = (input.codigo ?? "").replace(/\D/g, "");
  if (codigo.length !== 6) return { ok: false, erro: "Digite os 6 números do código." };

  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return { ok: false, erro: "O código expirou. Peça um novo." };

  let whats = "";
  let exp = 0;
  let token = "";
  try {
    const [w, e, t] = Buffer.from(raw, "base64url").toString("utf8").split(".");
    whats = w ?? "";
    exp = Number(e);
    token = t ?? "";
  } catch {
    return { ok: false, erro: "Não consegui validar. Peça um código novo." };
  }
  if (!whats || !exp || Date.now() > exp) {
    return { ok: false, erro: "O código expirou. Peça um novo." };
  }

  const esperado = assinar(`${whats}.${codigo}.${exp}`);
  const confere =
    token.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
  if (!confere) {
    return { ok: false, erro: "Código errado. Confira no WhatsApp e tente de novo." };
  }

  const res = await gravarEAtivar(whats);
  if (res.ok) jar.delete(COOKIE);
  return res;
}

/** Grava o número na conta e ativa a Ayla. Usado após o código conferir. */
async function gravarEAtivar(whatsapp: string): Promise<AtivarResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) return { ok: false, erro: "Conta não encontrada." };

  const now = new Date().toISOString();
  const { error: eNum } = await supabase
    .from("family_accounts")
    .update({ whatsapp_e164: whatsapp })
    .eq("id", family.id);
  if (eNum) return { ok: false, erro: "Não consegui salvar o número. Tente de novo." };

  const { error: ePref } = await supabase
    .from("ayla_preferences")
    .upsert(
      { family_account_id: family.id, desativada: false, consentimento_em: now },
      { onConflict: "family_account_id" },
    );
  if (ePref) return { ok: false, erro: "Não consegui ativar a Ayla. Tente de novo." };

  revalidatePath("/painel");
  return { ok: true };
}
