import { Users } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { KoloVivoWrapper, type FamiliaSecoes, type MembroData, type SugestaoRow } from "./wrapper";

export default async function KoloVivoPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: familia }, { data: perfisMembros }, { data: sugestoes }] =
    await Promise.all([
      supabase
        .from("membros_atipicos")
        .select("id, nome, idade, perfil")
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
    composicao: extractTexto(familia?.composicao),
    rotina: extractTexto(familia?.rotina),
    recursos: extractTexto(familia?.recursos),
    dinamica: extractTexto(familia?.dinamica),
  };

  const membrosData: MembroData[] = (membros ?? []).map((m) => {
    const p = perfisMembros?.find((x) => x.membro_atipico_id === m.id);
    return {
      id: m.id,
      nome: m.nome,
      idade: m.idade,
      perfil: m.perfil,
      essencial: extractTexto(p?.essencial),
      como_e: extractTexto(p?.como_e),
      corpo_rotina: extractTexto(p?.corpo_rotina),
      desafios_regulacao: extractTexto(p?.desafios_regulacao),
      sensorial: extractTexto(p?.sensorial),
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
          <Eyebrow>Kolo Vivo</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Perfil{" "}
            <em className="not-italic text-brand-purple">progressivo</em> da
            sua família
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Edite o que mudou — a Ayla e os especialistas usam isso de contexto.
            Quanto mais completo, mais útil ficam as respostas.
          </p>
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
 * Os campos jsonb foram gravados pelo onboarding como { texto?: string, ... }.
 * Aqui extraímos só o `texto` para o editor simples desta versão.
 * (Versões futuras podem expor a estrutura inteira.)
 */
function extractTexto(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const obj = json as Record<string, unknown>;
  if (typeof obj.texto === "string") return obj.texto;
  return "";
}
