import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eyebrow } from "@/components/brand/eyebrow";
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
      <header>
        <Eyebrow>Quando você precisa de ajuda</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Conta o que aconteceu.{" "}
          <em className="not-italic text-brand-purple">
            Vamos pensar nisso juntos
          </em>
          .
        </h1>
      </header>

      <ConversarForm membros={membros ?? []} />

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
