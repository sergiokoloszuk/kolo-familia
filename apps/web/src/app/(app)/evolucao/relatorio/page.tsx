import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";
import { RelatorioClient } from "./relatorio-client";

// A geração do rascunho (Sonnet) roda na action — teto largo por garantia.
export const maxDuration = 120;

export default async function RelatorioPage() {
  const { supabase, family } = await loadFamilyContext();
  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", family!.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const lista = (membros ?? []).map((m) => ({
    id: m.id as string,
    nome: capitalizarNome(m.nome as string),
  }));

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/evolucao"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ChevronLeft aria-hidden className="size-3" /> Evolução
      </Link>

      <header className="max-w-2xl print:hidden">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-purple">
          Relatório
        </p>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Um relatório <em className="not-italic text-brand-purple">pra escola ou terapeuta</em>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A Kolo traduz o que você registrou (o Kolo Vivo + os últimos meses) num relatório
          claro. Você revisa, ajusta e baixa em PDF — fica só com você, sem link nem
          compartilhamento pela plataforma.
        </p>
      </header>

      {lista.length === 0 ? (
        <p className="text-sm text-muted-foreground print:hidden">
          Cadastre um membro no Kolo Vivo pra gerar o relatório.
        </p>
      ) : (
        <RelatorioClient membros={lista} />
      )}
    </div>
  );
}
