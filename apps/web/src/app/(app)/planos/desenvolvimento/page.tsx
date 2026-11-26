import { requireAdmin } from "@/lib/auth/require-admin";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { listarPlanosV51 } from "@/lib/plano-v51/repositorio";
import { PlanoConectado } from "./plano-conectado";

/** Candidata restrita a staff, sem flag ou substituição da Home/planos existentes. */
export default async function DesenvolvimentoPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  await requireAdmin();
  const { family, supabase } = await loadFamilyContext();
  if (!family) return <p>Família não inicializada.</p>;
  const [{ data: membros, error }, { data: perfil, error: erroPerfil }, planos] = await Promise.all([
    supabase.from("membros_atipicos").select("id,nome,perfil").eq("family_account_id", family.id).eq("ativo", true).order("created_at", { ascending: true }),
    supabase.from("family_profiles").select("como_chamar,nome_mae").eq("family_account_id", family.id).maybeSingle(),
    listarPlanosV51(supabase, family.id),
  ]);
  if (error || erroPerfil) return <p>Não foi possível carregar o contexto. Tente novamente.</p>;
  const { plano } = await searchParams;
  return <><p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm">Candidata interna V5.1 · Acesso restrito à equipe. Não é a experiência publicada das famílias.</p><PlanoConectado familyId={family.id} nome={perfil?.como_chamar || perfil?.nome_mae || "vamos conversar"} membros={(membros ?? []).map(m => ({ id: m.id, nome: m.nome, cadastro: m.perfil?.trim() ? [{ texto: m.perfil, origem: "Cadastro do membro" }] : [] }))} planos={planos} planoInicialId={plano} /></>;
}
