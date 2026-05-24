import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { LeitorHistoria } from "./leitor";

export default async function HistoriaPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { supabase, family } = await loadFamilyContext();

  const { data: historia } = await supabase
    .from("historias")
    .select("id, titulo")
    .eq("id", id)
    .eq("family_account_id", family!.id)
    .maybeSingle();
  if (!historia) notFound();

  const { data: paginas } = await supabase
    .from("historia_paginas")
    .select("ordem, texto, fala, imagem_url")
    .eq("historia_id", id)
    .order("ordem", { ascending: true });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        href="/historias"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Histórias
      </Link>

      <h1 className="font-heading text-2xl text-foreground md:text-3xl">
        {historia.titulo as string}
      </h1>

      <LeitorHistoria
        paginas={
          (paginas ?? []) as Array<{
            ordem: number;
            texto: string | null;
            fala: string | null;
            imagem_url: string | null;
          }>
        }
      />
    </div>
  );
}
