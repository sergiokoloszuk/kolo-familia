import { Users } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { idadeAnos } from "@/lib/idade";
import { KoloVivoWrapper, type FamiliaSecoes, type MembroData, type SugestaoRow } from "./wrapper";

export default async function KoloVivoPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: familia }, { data: perfisMembros }, { data: sugestoes }] =
    await Promise.all([
      supabase
        .from("membros_atipicos")
        .select("id, nome, data_nascimento, perfil")
        .eq("family_account_id", familyId)
        .eq("ativo", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("perfil_vivo_familia")
        .select("composicao, rotina, recursos, dinamica, completude_pct")
        .eq("family_account_id", familyId)
        .maybeSingle(),
      supabase
        .from("perfil_vivo_membro")
        .select("membro_atipico_id, essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, completude_pct")
        .eq("family_account_id", familyId),
      supabase
        .from("sugestao_perfil_vivos")
        .select("id, membro_atipico_id, camada, campo, texto_sugerido, origem, created_at")
        .eq("family_account_id", familyId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false }),
    ]);

  const familiaSecoes: FamiliaSecoes = {
    composicao: extractSecao(familia?.composicao),
    rotina: extractSecao(familia?.rotina),
    recursos: extractSecao(familia?.recursos),
    dinamica: extractSecao(familia?.dinamica),
  };

  const membrosData: MembroData[] = (membros ?? []).map((m) => {
    const p = perfisMembros?.find((x) => x.membro_atipico_id === m.id);
    return {
      id: m.id,
      nome: m.nome,
      idade: idadeAnos(m.data_nascimento),
      perfil: m.perfil,
      essencial: extractSecao(p?.essencial),
      como_e: extractSecao(p?.como_e),
      corpo_rotina: extractSecao(p?.corpo_rotina),
      desafios_regulacao: extractSecao(p?.desafios_regulacao),
      sensorial: extractSecao(p?.sensorial),
      completude_pct: p?.completude_pct ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <Users aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>O retrato da família</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Quem é essa família,{" "}
            <em className="not-italic text-brand-purple">hoje</em>.
          </h1>
        </div>
      </header>

      <KoloVivoWrapper
        familyId={familyId}
        familia={familiaSecoes}
        membros={membrosData}
        sugestoes={(sugestoes as SugestaoRow[] | null) ?? []}
      />
    </div>
  );
}

/**
 * Os campos jsonb são gravados como { texto: string, atualizado_em?: ISO }.
 * Onboarding antigo pode ter gravado apenas { texto } — `atualizado_em`
 * fica null nesses casos e o microtexto temporal não aparece.
 */
function extractSecao(json: unknown): {
  texto: string;
  atualizadoEm: string | null;
} {
  if (!json || typeof json !== "object") return { texto: "", atualizadoEm: null };
  const obj = json as Record<string, unknown>;
  const texto = typeof obj.texto === "string" ? obj.texto : "";
  const atualizadoEm =
    typeof obj.atualizado_em === "string" ? obj.atualizado_em : null;
  return { texto, atualizadoEm };
}
