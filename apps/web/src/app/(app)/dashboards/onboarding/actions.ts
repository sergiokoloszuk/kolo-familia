"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { carregarCopy, salvarRascunho, publicarCopy, resetarRascunho } from "@/lib/onboarding/copy-store";
import { parseCopy } from "@/lib/onboarding/copy-schema";
import type { OnboardingCopy } from "@/lib/onboarding/copy-default";

type EditResult =
  | { ok: true; copy: OnboardingCopy; resumo: string; persistido: boolean }
  | { ok: false; error: string };

const SYSTEM = `Você é editor(a) da COPY do onboarding do Kolo Família — um app + uma assistente de IA chamada Ayla que conversa pelo WhatsApp, para famílias de pessoas atípicas (autismo, TDAH, dislexia...) de QUALQUER idade (criança, adolescente ou adulto). A dona do produto te dá uma instrução em linguagem natural e você reescreve a copy.

Você recebe o JSON atual da copy e devolve o JSON INTEIRO atualizado, mudando só o que foi pedido.

REGRAS INVIOLÁVEIS:
- Devolva APENAS um JSON válido: {"resumo":"<1 frase do que você mudou>","copy":{<o OnboardingCopy inteiro>}}. Nada antes ou depois.
- NÃO invente campos nem mude a estrutura/os "id" e "tipo" dos passos (a menos que peçam explicitamente adicionar/remover passo). Ao editar texto, preserve id e tipo.
- Preserve os placeholders: [NOME] (a pessoa cuidada), [VOCE] (o cuidador), [TEMA] (o desafio escolhido). Use-os onde já estavam.
- Tom: caloroso, humano, acolhedor — a voz da Ayla. Anti-burocrático, anti-SaaS. Português do Brasil.
- Inclusivo: NÃO presuma "criança" (pode ser adolescente/adulto) nem o gênero/parentesco de ninguém.
- Só mude o que a instrução pede; mantenha o resto igual.`;

function extrairJson(s: string): unknown {
  try {
    return JSON.parse(s.trim());
  } catch {
    const m = s.match(/```json\s*([\s\S]*?)\s*```/i) ?? s.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}

export async function ajustarCopyComIA(instrucao: string): Promise<EditResult> {
  try {
    await requireAdmin();
    const texto = (instrucao ?? "").trim();
    if (!texto) return { ok: false, error: "Escreva o que você quer ajustar." };

    const admin = createServiceRoleClient();
    const atual = await carregarCopy(admin);

    const client = getAnthropicClient();
    const resp = await client.messages.create({
      model: MODELS.principal,
      max_tokens: 3500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `JSON atual da copy:\n${JSON.stringify(atual)}\n\nInstrução: ${texto}`,
        },
      ],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const parsed = extrairJson(raw) as { resumo?: string; copy?: unknown } | null;
    const novaCopy = parseCopy(parsed?.copy);
    if (!novaCopy) {
      return { ok: false, error: "A IA devolveu algo fora do formato. Tente reformular o pedido." };
    }

    const persistido = await salvarRascunho(admin, novaCopy);
    return {
      ok: true,
      copy: novaCopy,
      resumo: (parsed?.resumo ?? "Pronto, ajustei.").toString().slice(0, 300),
      persistido,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function publicarCopyAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const ok = await publicarCopy(createServiceRoleClient());
    return ok ? { ok: true } : { ok: false, error: "Não consegui publicar (a tabela já existe? migração 0059)." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function resetarRascunhoAction(): Promise<{ ok: true; copy: OnboardingCopy } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const copy = await resetarRascunho(createServiceRoleClient());
    return { ok: true, copy };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
