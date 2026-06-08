import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";

export default async function PlanosPage() {
  const { supabase, family } = await loadFamilyContext();

  const { data: planos } = await supabase
    .from("planos")
    .select("id, titulo, tema, resultado, created_at, membros_atipicos(nome)")
    .eq("family_account_id", family!.id)
    .order("created_at", { ascending: false });

  const lista = planos ?? [];

  const RESULTADO_CHIP: Record<string, { label: string; classe: string }> = {
    funcionou: { label: "Funcionou", classe: "bg-emerald-500/10 text-emerald-700" },
    parcial: { label: "Mais ou menos", classe: "bg-brand-yellow/20 text-brand-purple-dark" },
    nao_funcionou: { label: "Não funcionou", classe: "bg-foreground/[0.06] text-muted-foreground" },
    nao_testou: { label: "A testar", classe: "bg-foreground/[0.06] text-muted-foreground" },
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Meus Planos</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Seus planos <em className="not-italic text-brand-purple">guardados</em>
        </h1>
      </header>

      {lista.length === 0 ? (
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Você ainda não montou nenhum plano. Vá nas Estratégias, conte um desafio e
          toque em “Montar plano completo” — ele fica guardado aqui pra você voltar e
          imprimir quando quiser.
        </p>
      ) : (
        <ul className="flex flex-col">
          {lista.map((p, i) => {
            const rel = p.membros_atipicos as
              | { nome: string }
              | { nome: string }[]
              | null;
            const nome = rel
              ? Array.isArray(rel)
                ? rel[0]?.nome ?? null
                : rel.nome
              : null;
            const data = new Date(p.created_at as string).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
            });
            return (
              <li key={p.id}>
                <Link
                  href={`/planos/${p.id}`}
                  className={`flex items-center gap-3 py-4 transition-colors hover:text-brand-purple ${
                    i > 0 ? "border-t border-kolo-linha" : ""
                  }`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-yellow/20 text-brand-purple">
                    <FileText className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {p.titulo as string}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[nome ? capitalizarNome(nome) : null, data].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {p.resultado && RESULTADO_CHIP[p.resultado as string] && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        RESULTADO_CHIP[p.resultado as string].classe
                      }`}
                    >
                      {RESULTADO_CHIP[p.resultado as string].label}
                    </span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
