import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { CriarHistoriaForm } from "./criar-form";

export const metadata = { title: "Criar história — Kolo Família" };

// Geração escreve + ilustra várias páginas (gpt-image-1) — pode levar ~1 min.
export const maxDuration = 60;

export default async function CriarHistoriaPage() {
  const { supabase, family } = await loadFamilyContext();

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, avatares_membros_atipicos(imagem_url)")
    .eq("family_account_id", family!.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const comAvatar = (membros ?? [])
    .map((m) => {
      const a = Array.isArray(m.avatares_membros_atipicos)
        ? m.avatares_membros_atipicos[0]
        : m.avatares_membros_atipicos;
      return { id: m.id as string, nome: m.nome as string, temAvatar: Boolean(a?.imagem_url) };
    })
    .filter((m) => m.temAvatar);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        href="/historias"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Histórias
      </Link>

      <header>
        <h1 className="font-heading text-3xl text-foreground">
          Criar uma <em className="not-italic text-brand-purple">história</em>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Conte a situação com suas palavras. A Kolo escreve a história e ilustra
          cada página com o avatar da criança como personagem.
        </p>
      </header>

      {comAvatar.length === 0 ? (
        <div className="rounded-2xl border border-kolo-linha bg-secondary/40 p-6">
          <p className="font-heading text-lg text-foreground">
            Falta o avatar da criança
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            O avatar é o personagem das histórias. Crie um e volte aqui.
          </p>
          <Link
            href="/configuracoes/avatar"
            className={cn(buttonVariants({ variant: "outline" }), "mt-3")}
          >
            Criar avatar
          </Link>
        </div>
      ) : (
        <CriarHistoriaForm criancas={comAvatar} />
      )}
    </div>
  );
}
