import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";
import { ExcluirMeditacao } from "./excluir-meditacao";
import { PrintButton } from "./print-button";

const INTENCAO_LABEL: Record<string, string> = {
  acalmar: "Acalmar",
  visualizar: "Visualizar um momento",
  dormir: "Relaxar pra dormir",
  coragem: "Coragem",
  seguranca: "Sentir-se segura",
  outra: "Meditação",
};

export default async function MeditacaoView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, family } = await loadFamilyContext();

  const { data: med } = await supabase
    .from("meditacoes")
    .select("id, titulo, intencao, tema, roteiro, created_at, membros_atipicos(nome)")
    .eq("id", id)
    .eq("family_account_id", family!.id)
    .maybeSingle();

  if (!med) notFound();

  const rel = med.membros_atipicos as { nome: string } | { nome: string }[] | null;
  const nome = rel ? (Array.isArray(rel) ? rel[0]?.nome : rel.nome) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link
        href="/ludico/meditacao"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ChevronLeft aria-hidden className="size-3" /> Meditações
      </Link>

      <header>
        <h1 className="font-heading text-2xl text-foreground md:text-3xl">
          {(med.titulo as string) || INTENCAO_LABEL[med.intencao as string] || "Meditação"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {INTENCAO_LABEL[med.intencao as string] ?? "Meditação"}
          {med.tema ? ` · ${med.tema as string}` : ""}
          {nome ? ` · ${capitalizarNome(nome)}` : ""}
        </p>
      </header>

      <p className="rounded-xl bg-kolo-lilas-bg-2/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground print:hidden">
        Leia devagar, em voz baixa, fazendo as pausas. Não precisa ficar perfeito — o ritmo
        calmo já acolhe.
      </p>

      <article className="whitespace-pre-wrap font-heading text-lg leading-relaxed text-foreground md:text-xl">
        {med.roteiro as string}
      </article>

      <div className="flex items-center justify-between border-t border-foreground/[0.06] pt-4 print:hidden">
        <ExcluirMeditacao meditacaoId={med.id as string} />
        <PrintButton />
      </div>
    </div>
  );
}
