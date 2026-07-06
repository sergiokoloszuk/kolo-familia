import type { SupabaseClient } from "@supabase/supabase-js";
import { dataBrParaIso } from "@/lib/idade";
import { capitalizarNome } from "@/lib/nome";
import { chaveTelefoneBR } from "@/lib/telefone";
import { inferGeneroDePalavra } from "@/lib/ayla/pronomes";
import { perfilPrimario, buildDiagnosticosFormais } from "@/lib/onboarding/diagnostico";

/**
 * Persistência do onboarding CONVERSACIONAL (Fatia 3) — em ETAPAS (checkpoints),
 * espelhando o wizard antigo (que salvava por tela). Cada etapa salva o que já
 * tem e avança `onboarding_step`, então:
 *  - o "Parou em" do funil volta a mostrar onde a pessoa desistiu;
 *  - o WhatsApp + opt-in entram CEDO → a Ayla consegue resgatar quem abandona.
 * Tudo idempotente (dá pra reenviar a mesma etapa ao corrigir uma resposta).
 * Roda por service-role; o familyId JÁ vem resolvido da sessão autenticada.
 */

export type MembroInput = {
  nome: string;
  genero: "feminino" | "masculino";
  nascimento: string; // dd/mm/aaaa
  laudo: string[];
  laudoOutro?: string | null;
  investigacao: string[];
  interesses: string[];
};

export type ResponsavelInput = {
  nome: string;
  relacao: string; // mae | pai | avo | avoh | outro
  relacaoOutro?: string | null;
  genero?: "feminino" | "masculino" | "neutro" | null;
  faixa?: string | null;
};

export type SalvarResultado =
  | { ok: true }
  | { ok: false; motivo: "whatsapp_duplicado" | "erro"; mensagem: string };

// Domínios que contam como "tema preenchido" (espelha o tela4 antigo).
const DOMINIO_KEYS = [
  "sensorial", "nutricional", "comunicacao", "emocional", "foco", "sono",
  "socializacao", "motor", "rotina", "autonomia", "aprendizado", "imitacao",
  "tela_midia", "escola", "saude_geral",
];

// onboarding_step do fluxo NOVO: 2=pessoa, 3=whatsapp, 4=aceite, 7=concluiu.
async function bumpStep(admin: SupabaseClient, familyId: string, step: number) {
  await admin
    .from("family_accounts")
    .update({ onboarding_step: step })
    .eq("id", familyId)
    .lt("onboarding_step", step);
}

function faixaParaDataAprox(faixa: string | null | undefined): string | null {
  const meio: Record<string, number> = { "18-25": 21, "26-35": 30, "36-45": 40, "46-59": 52, "60+": 65 };
  const idade = faixa ? meio[faixa] : undefined;
  if (!idade) return null;
  const d = new Date();
  d.setFullYear(d.getFullYear() - idade);
  return d.toISOString().slice(0, 10);
}

function generoDoResponsavel(r: ResponsavelInput): "feminino" | "masculino" | "neutro" | null {
  if (r.genero) return r.genero;
  if (r.relacao === "mae" || r.relacao === "avo") return "feminino";
  if (r.relacao === "pai" || r.relacao === "avoh") return "masculino";
  if (r.relacaoOutro) return inferGeneroDePalavra(r.relacaoOutro) ?? null;
  return null;
}

/** ETAPA 1 — a pessoa cuidada (membro + desafios/interesses). Idempotente. */
export async function cpMembro(
  admin: SupabaseClient,
  familyId: string,
  m: MembroInput,
  desafios: string[],
): Promise<SalvarResultado> {
  try {
    const laudo = [...m.laudo];
    if (m.laudoOutro && !laudo.includes("Outro")) laudo.push("Outro");
    const diagParaPerfil = laudo.length ? laudo : m.investigacao.length ? ["EmInvestigacao"] : [];
    const campos = {
      nome: capitalizarNome(m.nome),
      data_nascimento: dataBrParaIso(m.nascimento),
      genero: m.genero,
      perfil: perfilPrimario(diagParaPerfil),
      diagnosticos_formais: buildDiagnosticosFormais({
        diagnosticos: laudo,
        outro: m.laudoOutro ?? null,
        hipoteses: m.investigacao,
      }),
    };

    // Idempotente: se já existe um membro (etapa reenviada ao corrigir), atualiza.
    const { data: existente } = await admin
      .from("membros_atipicos")
      .select("id")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let membroId = existente?.id as string | undefined;
    if (membroId) {
      await admin.from("membros_atipicos").update(campos).eq("id", membroId);
    } else {
      const { data: novo, error } = await admin
        .from("membros_atipicos")
        .insert({ family_account_id: familyId, ...campos })
        .select("id")
        .single();
      if (error || !novo) return { ok: false, motivo: "erro", mensagem: error?.message ?? "sem id" };
      membroId = novo.id as string;
    }

    const extras: Record<string, unknown> = { desafios_onboarding: desafios };
    for (const d of desafios) extras[d] = { texto: "" };
    if (m.interesses.length) extras.preferencias = { temas: m.interesses };
    // Completude: conta os domínios marcados (igual ao tela4 antigo), pra não
    // derrubar a "completude média" do dashboard com um 0.
    const preenchidos = desafios.filter((d) => DOMINIO_KEYS.includes(d)).length;
    await admin.from("perfil_vivo_membro").upsert(
      {
        membro_atipico_id: membroId,
        family_account_id: familyId,
        como_e: m.interesses.length ? { interesses: m.interesses } : {},
        essencial: {},
        categorias_extras: extras,
        completude_pct: Math.round((preenchidos / DOMINIO_KEYS.length) * 100),
      },
      { onConflict: "membro_atipico_id" },
    );

    await bumpStep(admin, familyId, 2);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "erro", mensagem: e instanceof Error ? e.message : "erro" };
  }
}

/** ETAPA 2 — WhatsApp (com checagem de duplicado). Idempotente. */
export async function cpWhatsapp(
  admin: SupabaseClient,
  familyId: string,
  whatsapp: string,
): Promise<SalvarResultado> {
  try {
    const chaveNova = chaveTelefoneBR(whatsapp);
    if (chaveNova) {
      const { data: outras } = await admin
        .from("family_accounts")
        .select("id, whatsapp_e164")
        .not("whatsapp_e164", "is", null)
        .neq("id", familyId);
      const conflito = (outras ?? []).some(
        (f) => chaveTelefoneBR(f.whatsapp_e164 as string) === chaveNova,
      );
      if (conflito) {
        return { ok: false, motivo: "whatsapp_duplicado", mensagem: "Já existe uma conta com esse WhatsApp." };
      }
    }
    const { error } = await admin.from("family_accounts").update({ whatsapp_e164: whatsapp }).eq("id", familyId);
    if (error) {
      if (error.code === "23505") {
        return { ok: false, motivo: "whatsapp_duplicado", mensagem: "Já existe uma conta com esse WhatsApp." };
      }
      return { ok: false, motivo: "erro", mensagem: error.message };
    }
    await bumpStep(admin, familyId, 3);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "erro", mensagem: e instanceof Error ? e.message : "erro" };
  }
}

/** ETAPA 3 — aceites (termos + opt-in da Ayla). Captura o consentimento CEDO. */
export async function cpAceites(
  admin: SupabaseClient,
  familyId: string,
  aceites: { termos: boolean; ayla: boolean },
): Promise<void> {
  try {
    if (aceites.ayla) {
      await admin.from("ayla_preferences").upsert(
        { family_account_id: familyId, desativada: false, consentimento_em: new Date().toISOString() },
        { onConflict: "family_account_id" },
      );
    }
    await bumpStep(admin, familyId, 4);
  } catch {
    /* best-effort */
  }
}

const JANELAS: Record<string, { i: string; f: string }> = {
  manha: { i: "08:00", f: "10:00" },
  meio_dia: { i: "12:00", f: "14:00" },
  tarde: { i: "15:00", f: "17:00" },
  noite: { i: "19:00", f: "21:00" },
};

/** ETAPA 4 — responsável + horário + CONCLUSÃO (1ª mensagem da Ayla + aviso admin). */
export async function cpConcluir(
  admin: SupabaseClient,
  familyId: string,
  r: ResponsavelInput,
  horario: string | null | undefined,
): Promise<SalvarResultado> {
  try {
    const ehOutro = !["mae", "pai", "avo", "avoh"].includes(r.relacao);
    await admin.from("family_profiles").upsert({
      family_account_id: familyId,
      nome_mae: capitalizarNome(r.nome),
      data_nascimento_mae: faixaParaDataAprox(r.faixa),
      papel: ehOutro ? "outro" : r.relacao,
      papel_outro: ehOutro ? r.relacaoOutro ?? null : null,
      genero_responsavel: generoDoResponsavel(r),
    });

    if (horario && JANELAS[horario]) {
      await admin.from("ayla_preferences").upsert(
        {
          family_account_id: familyId,
          horario_preferido_inicio: JANELAS[horario].i,
          horario_preferido_fim: JANELAS[horario].f,
        },
        { onConflict: "family_account_id" },
      );
    }

    const { error } = await admin
      .from("family_accounts")
      .update({
        onboarding_completed: true,
        onboarding_step: 7,
        boas_vindas_vista_at: new Date().toISOString(),
      })
      .eq("id", familyId);
    if (error) return { ok: false, motivo: "erro", mensagem: error.message };

    try {
      const { sendBoasVindas } = await import("@/lib/ayla/orchestrator");
      await sendBoasVindas(admin, familyId);
    } catch (e) {
      console.error("[onb-conversacional] sendBoasVindas:", e);
    }
    try {
      const { notificarNovoCadastro } = await import("@/lib/admin/notificacoes");
      await notificarNovoCadastro(admin, familyId);
    } catch (e) {
      console.error("[onb-conversacional] notificarNovoCadastro:", e);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "erro", mensagem: e instanceof Error ? e.message : "erro" };
  }
}
