import type { SupabaseClient } from "@supabase/supabase-js";
import { dataBrParaIso } from "@/lib/idade";
import { capitalizarNome } from "@/lib/nome";
import { chaveTelefoneBR } from "@/lib/telefone";
import { inferGeneroDePalavra } from "@/lib/ayla/pronomes";
import { perfilPrimario, buildDiagnosticosFormais } from "@/lib/onboarding/diagnostico";

/**
 * Persistência do onboarding CONVERSACIONAL (Fatia 3) — mapeia as respostas do
 * fluxo novo pras mesmas tabelas do cadastro antigo, pra a experiência trocar
 * mas o dado continuar igual. Roda por service-role; o familyId JÁ vem resolvido
 * da sessão autenticada (a server action que chama garante isso).
 *
 * Espelha saveTela1/2/4/5 + completeOnboarding do onboarding antigo.
 */

export type RespostasConversacional = {
  membro: {
    nome: string;
    genero: "feminino" | "masculino";
    nascimento: string; // dd/mm/aaaa
    laudo: string[]; // valores enum (TEA, TDAH, Dislexia, AHSD, Outro)
    laudoOutro?: string | null;
    investigacao: string[]; // valores enum (hipóteses)
  };
  desafios: string[]; // valores de tema (comunicacao, sono, foco...)
  responsavel: {
    nome: string;
    relacao: string; // mae | pai | avo | avoh | outro
    relacaoOutro?: string | null;
    genero?: "feminino" | "masculino" | "neutro" | null; // quando foi preciso perguntar
    faixa?: string | null; // "26-35" | "na" | null
  };
  whatsapp: string; // E.164
  aceites: { termos: boolean; ayla: boolean };
};

export type SalvarResultado =
  | { ok: true }
  | { ok: false; motivo: "whatsapp_duplicado" | "erro"; mensagem: string };

/** faixa etária → data de nascimento aproximada (ponto médio), pra a idade média do Público. */
function faixaParaDataAprox(faixa: string | null | undefined): string | null {
  const meio: Record<string, number> = { "18-25": 21, "26-35": 30, "36-45": 40, "46-59": 52, "60+": 65 };
  const idade = faixa ? meio[faixa] : undefined;
  if (!idade) return null;
  const d = new Date();
  d.setFullYear(d.getFullYear() - idade);
  return d.toISOString().slice(0, 10);
}

function generoDoResponsavel(r: RespostasConversacional["responsavel"]): "feminino" | "masculino" | "neutro" | null {
  if (r.genero) return r.genero;
  if (r.relacao === "mae" || r.relacao === "avo") return "feminino";
  if (r.relacao === "pai" || r.relacao === "avoh") return "masculino";
  if (r.relacaoOutro) return inferGeneroDePalavra(r.relacaoOutro) ?? null;
  return null;
}

export async function salvarOnboardingConversacional(
  admin: SupabaseClient,
  familyId: string,
  r: RespostasConversacional,
): Promise<SalvarResultado> {
  try {
    // 1) WhatsApp — checa duplicidade ANTES de gravar (senão a Ayla responde pra
    //    família errada). Se duplicado, devolve pro fluxo oferecer "Entrar".
    const chaveNova = chaveTelefoneBR(r.whatsapp);
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
        return {
          ok: false,
          motivo: "whatsapp_duplicado",
          mensagem: "Já existe uma conta com esse WhatsApp.",
        };
      }
    }

    // 2) Perfil da mãe/responsável
    const ehOutro = !["mae", "pai", "avo", "avoh"].includes(r.responsavel.relacao);
    await admin.from("family_profiles").upsert({
      family_account_id: familyId,
      nome_mae: capitalizarNome(r.responsavel.nome),
      data_nascimento_mae: faixaParaDataAprox(r.responsavel.faixa),
      papel: ehOutro ? "outro" : r.responsavel.relacao,
      papel_outro: ehOutro ? r.responsavel.relacaoOutro ?? null : null,
      genero_responsavel: generoDoResponsavel(r.responsavel),
    });

    // 3) Membro atípico (a pessoa cuidada)
    const laudo = [...r.membro.laudo];
    if (r.membro.laudoOutro && !laudo.includes("Outro")) laudo.push("Outro");
    const diagParaPerfil = laudo.length ? laudo : r.membro.investigacao.length ? ["EmInvestigacao"] : [];
    const { data: membro, error: errMembro } = await admin
      .from("membros_atipicos")
      .insert({
        family_account_id: familyId,
        nome: capitalizarNome(r.membro.nome),
        data_nascimento: dataBrParaIso(r.membro.nascimento),
        genero: r.membro.genero,
        perfil: perfilPrimario(diagParaPerfil),
        diagnosticos_formais: buildDiagnosticosFormais({
          diagnosticos: laudo,
          outro: r.membro.laudoOutro ?? null,
          hipoteses: r.membro.investigacao,
        }),
      })
      .select("id")
      .single();
    if (errMembro || !membro) {
      return { ok: false, motivo: "erro", mensagem: `Erro ao salvar a criança: ${errMembro?.message ?? "sem id"}` };
    }

    // 4) Desafios marcados → perfil_vivo_membro. Guardo a lista pra a Ayla
    //    aprofundar depois (Fatia 4); o conteúdo por domínio enche com a conversa.
    await admin.from("perfil_vivo_membro").upsert(
      {
        membro_atipico_id: membro.id,
        family_account_id: familyId,
        como_e: {},
        essencial: {},
        categorias_extras: { desafios_onboarding: r.desafios },
        completude_pct: 0,
      },
      { onConflict: "membro_atipico_id" },
    );

    // 5) WhatsApp + conclusão do onboarding
    const { error: errFam } = await admin
      .from("family_accounts")
      .update({
        whatsapp_e164: r.whatsapp,
        onboarding_completed: true,
        onboarding_step: 7,
        boas_vindas_vista_at: new Date().toISOString(),
      })
      .eq("id", familyId);
    if (errFam) {
      if (errFam.code === "23505") {
        return { ok: false, motivo: "whatsapp_duplicado", mensagem: "Já existe uma conta com esse WhatsApp." };
      }
      return { ok: false, motivo: "erro", mensagem: `Erro ao concluir: ${errFam.message}` };
    }

    // 6) Consentimento da Ayla (LGPD) — opt-in capturado cedo
    if (r.aceites.ayla) {
      await admin
        .from("ayla_preferences")
        .upsert(
          { family_account_id: familyId, desativada: false, consentimento_em: new Date().toISOString() },
          { onConflict: "family_account_id" },
        );
    }

    // 7) Primeira mensagem da Ayla + aviso pro admin — best-effort, não trava.
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
    return { ok: false, motivo: "erro", mensagem: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
