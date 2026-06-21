import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { CriarHistoriaForm } from "./criar-form";

export const metadata = { title: "Criar história — Kolo Família" };

// Geração escreve + ilustra várias páginas (gpt-image-1). O trabalho pesado
// roda em after() e HERDA este maxDuration — 60s não cabia (5 imgs paralelas
// em pares + roteiro passava do limite e matava o container antes do catch
// marcar status='erro', prendendo o usuário no skeleton).
export const maxDuration = 300;

export default async function CriarHistoriaPage() {
  const { supabase, family } = await loadFamilyContext();

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, avatares_membros_atipicos(id, imagem_url, selecionado, created_at)")
    .eq("family_account_id", family!.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  type AvRow = {
    id: string;
    imagem_url: string | null;
    selecionado: boolean | null;
    created_at: string | null;
  };

  // Por criança: ordena os avatares (em uso primeiro, depois recentes).
  const perMembro = (membros ?? []).map((m) => {
    const arr = (
      Array.isArray(m.avatares_membros_atipicos)
        ? m.avatares_membros_atipicos
        : m.avatares_membros_atipicos
          ? [m.avatares_membros_atipicos]
          : []
    ) as AvRow[];
    const avs = [...arr].sort((a, b) => {
      if (Boolean(b.selecionado) !== Boolean(a.selecionado)) return b.selecionado ? 1 : -1;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    return { id: m.id as string, nome: m.nome as string, avs };
  });

  // Assina todas as URLs num lote só (bucket privado) e redistribui.
  const signed = await assinarImagens(
    supabase,
    perMembro.flatMap((pm) => pm.avs.map((a) => a.imagem_url ?? null)),
  );
  let idx = 0;
  const criancas = perMembro.map((pm) => {
    const avatares = pm.avs
      .map((a) => ({
        id: a.id,
        url: signed[idx++] ?? a.imagem_url ?? null,
        selecionado: Boolean(a.selecionado),
      }))
      .filter((a): a is { id: string; url: string; selecionado: boolean } => Boolean(a.url));
    return { id: pm.id, nome: pm.nome, avatares };
  });

  const todas = criancas.map((c) => ({ id: c.id, nome: c.nome, temAvatar: c.avatares.length > 0 }));
  const comAvatar = criancas.filter((c) => c.avatares.length > 0);
  const semAvatar = todas.filter((m) => !m.temAvatar);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        href="/historias"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Histórias
      </Link>

      <header>
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl text-foreground">
            Criar uma <em className="not-italic text-brand-purple">história</em>
          </h1>
          <span
            aria-label="feature em versão beta"
            className="inline-flex items-center rounded-full border border-kolo-linha bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            beta
          </span>
        </div>
        <p className="mt-2 text-muted-foreground">
          Conte a situação com suas palavras. A Kolo escreve a história e ilustra
          cada página com o avatar como personagem.
        </p>
      </header>

      {todas.length === 0 ? (
        <div className="rounded-2xl border border-kolo-linha bg-secondary/40 p-6">
          <p className="font-heading text-lg text-foreground">
            Ninguém cadastrado ainda
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione no Kolo Vivo e volte aqui pra criar a história.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {comAvatar.length > 0 ? (
            <CriarHistoriaForm criancas={comAvatar} />
          ) : (
            <div className="rounded-2xl border border-kolo-linha bg-secondary/40 p-6">
              <p className="font-heading text-lg text-foreground">
                Falta o avatar
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                O avatar é o personagem das histórias. Crie um abaixo e volte aqui.
              </p>
            </div>
          )}

          {semAvatar.length > 0 && (
            <div className="rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/40 p-4">
              <p className="font-heading text-base font-medium text-foreground">
                {comAvatar.length > 0 ? "Criar avatar de outra pessoa" : "Comece criando o avatar"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                O avatar é o personagem das histórias — você escolhe o estilo e a
                Kolo ilustra. É feito uma vez por pessoa.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {semAvatar.map((m) => (
                  <Link
                    key={m.id}
                    href={`/configuracoes/avatar/${m.id}`}
                    className={cn(
                      buttonVariants({
                        variant: comAvatar.length > 0 ? "outline" : "default",
                        size: "sm",
                      }),
                    )}
                  >
                    Criar avatar de {m.nome}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Link
            href="/configuracoes/avatar"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver / editar todos os avatares →
          </Link>
        </div>
      )}
    </div>
  );
}
