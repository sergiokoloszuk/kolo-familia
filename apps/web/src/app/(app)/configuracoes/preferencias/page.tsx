import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { PreferenciasForm } from "./preferencias-form";
import type { Preferencias } from "./actions";

function lerPref(extras: unknown): Preferencias {
  const p = (extras as { preferencias?: Partial<Preferencias> } | null)?.preferencias ?? {};
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return { temas: arr(p.temas), midia: arr(p.midia), materiais: arr(p.materiais), musicas: arr(p.musicas) };
}

export default async function PreferenciasPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const ids = (membros ?? []).map((m) => m.id as string);
  const { data: perfis } = ids.length
    ? await supabase
        .from("perfil_vivo_membro")
        .select("membro_atipico_id, categorias_extras")
        .in("membro_atipico_id", ids)
    : { data: [] };
  const prefPorMembro = new Map(
    (perfis ?? []).map((p) => [p.membro_atipico_id as string, lerPref(p.categorias_extras)]),
  );

  const criancas = (membros ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    preferencias: prefPorMembro.get(m.id as string) ?? {
      temas: [],
      midia: [],
      materiais: [],
      musicas: [],
    },
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/configuracoes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Configurações
        </Link>
      </div>

      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <Heart aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Gostos e preferências</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            O que cada um(a) <em className="not-italic text-brand-purple">ama</em>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Temas, personagens, materiais e músicas favoritos. Quanto mais a Kolo
            sabe, mais as histórias e ideias saem com a cara de cada um.
          </p>
        </div>
      </header>

      {criancas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ninguém cadastrado ainda.</p>
      ) : (
        <PreferenciasForm criancas={criancas} />
      )}
    </div>
  );
}
