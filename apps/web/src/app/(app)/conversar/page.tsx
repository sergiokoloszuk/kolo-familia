import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { ConversarForm } from "./conversar-form";

export default async function ConversarPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: conversas }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("conversas")
      .select("id, titulo, created_at, encerrada, membro_atipico_id")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero da página. */}
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <MessageCircle aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Conversar com Koló</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Pergunta como{" "}
            <em className="not-italic text-brand-purple">aconteceria</em> no dia.
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Escreva uma dúvida real. O sistema decide qual perspectiva responde
            — você não precisa escolher.
          </p>
        </div>
      </header>

      {/* Form em card lilás. */}
      <div className="rounded-3xl bg-kolo-lilas-bg-2 p-6 md:p-8">
        <h2 className="font-heading text-xl text-foreground">Nova conversa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sobre quem é (se for um membro específico) e o que aconteceu.
        </p>
        <div className="mt-6">
          <ConversarForm membros={membros ?? []} />
        </div>
      </div>

      {/* Conversas anteriores. */}
      {conversas && conversas.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <Eyebrow>Conversas anteriores</Eyebrow>
            <h2 className="mt-1 font-heading text-2xl text-foreground">
              O que você{" "}
              <em className="not-italic text-brand-purple">já perguntou</em>
            </h2>
          </div>
          <ul className="flex flex-col gap-2">
            {conversas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/conversar/${c.id}`}
                  className="block rounded-2xl border border-kolo-linha bg-white px-5 py-4 text-sm transition-all hover:-translate-y-0.5 hover:border-brand-purple hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="line-clamp-1 font-medium text-foreground">
                      {c.titulo ?? "Conversa"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(new Date(c.created_at), new Date(), {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
