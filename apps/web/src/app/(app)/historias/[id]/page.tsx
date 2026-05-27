import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { LeitorHistoria } from "./leitor";

export default async function HistoriaPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { supabase, family } = await loadFamilyContext();

  const { data: historia } = await supabase
    .from("historias")
    .select("id, titulo, capa_url, status, erro")
    .eq("id", id)
    .eq("family_account_id", family!.id)
    .maybeSingle();
  if (!historia) notFound();

  const status = (historia.status as string | null) ?? "pronta";

  // Ainda gerando: skeleton + meta-refresh pra atualizar sozinho.
  if (status === "gerando") {
    return (
      <>
        {/* o leitor revalida sozinho enquanto a IA escreve+ilustra */}
        <meta httpEquiv="refresh" content="6" />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <Link
            href="/historias"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden /> Histórias
          </Link>
          <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple-deep to-brand-purple-dark px-8 py-16 text-center text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(1.5px 1.5px at 18% 26%, rgba(255,255,255,.55) 50%, transparent), radial-gradient(1.5px 1.5px at 82% 20%, rgba(255,186,0,.7) 50%, transparent), radial-gradient(1px 1px at 70% 80%, rgba(255,255,255,.5) 50%, transparent), radial-gradient(1px 1px at 28% 82%, rgba(255,186,0,.5) 50%, transparent)",
              }}
            />
            <span className="relative flex size-24 items-center justify-center rounded-full bg-white/10 backdrop-blur">
              <span
                aria-hidden
                className="absolute -inset-2 rounded-full border-2 border-dashed border-brand-yellow/50 animate-[spin_10s_linear_infinite]"
              />
              <Sparkles className="size-10 text-brand-yellow" />
            </span>
            <h2 className="relative font-heading text-2xl">A Kolo está ilustrando…</h2>
            <p className="relative max-w-sm text-sm text-white/75">
              Escrevendo a história e desenhando cada página com o mesmo personagem.
              Pode levar até 2 minutos — essa página atualiza sozinha.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (status === "erro") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <Link
          href="/historias"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Histórias
        </Link>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-heading text-lg text-foreground">Não consegui terminar essa história.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(historia.erro as string | null) ?? "Tente criar de novo com outras palavras."}
          </p>
          <Link
            href="/historias/criar"
            className="mt-4 inline-flex rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark"
          >
            Criar nova
          </Link>
        </div>
      </div>
    );
  }

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

      <LeitorHistoria
        historiaId={historia.id as string}
        titulo={historia.titulo as string}
        capaUrl={(historia.capa_url as string | null) ?? null}
        aviso={(historia.erro as string | null) ?? null}
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
