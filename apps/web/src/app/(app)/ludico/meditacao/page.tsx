import Link from "next/link";
import { ChevronLeft, Wind } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";
import { CriarMeditacao } from "./criar-meditacao";
import { Eyebrow } from "@/components/brand/eyebrow";
import { ExcluirMini } from "./excluir-mini";

// A geração do roteiro (Sonnet) roda na action — teto largo por garantia.
export const maxDuration = 300;

const INTENCAO_LABEL: Record<string, string> = {
  acalmar: "Acalmar agora",
  visualizar: "Ensaiar um momento",
  processar: "Guardar o que passou",
  dormir: "Relaxar pra dormir",
  coragem: "Coragem",
  seguranca: "Sentir-se segura",
  outra: "Meditação",
};

function dataBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function MeditacaoPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: meditacoes }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("meditacoes")
      .select("id, titulo, intencao, created_at, membros_atipicos(nome)")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const membrosList = (membros ?? []).map((m) => ({
    id: m.id as string,
    nome: capitalizarNome(m.nome as string),
  }));

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/ludico"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-3" /> Lúdico
      </Link>

      <header className="max-w-2xl">
        <Eyebrow>Meditação guiada</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Um respiro <em className="not-italic text-brand-purple">no jeito dela</em>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Escolha uma intenção — acalmar, ensaiar um momento que vai chegar, relaxar pra
          dormir — e a Kolo escreve uma meditação curtinha pra você ler em voz alta, com o
          nome e os interesses dela. Se quiser, ela sugere temas pelo que está acontecendo.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/70">
          <strong className="font-medium text-foreground">Quem cuida:</strong> escolha um
          momento calmo e leia devagar, com voz baixa — a sua voz é parte do relaxamento.
          Não precisa decorar; pode pausar e repetir quantas vezes ela quiser.
        </p>
      </header>

      {membrosList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cadastre uma criança no Perfil pra começar.
        </p>
      ) : (
        <CriarMeditacao membros={membrosList} />
      )}

      {(meditacoes ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl text-foreground">Suas meditações</h2>
          <ul className="flex flex-col gap-2">
            {(meditacoes ?? []).map((m) => {
              const rel = m.membros_atipicos as { nome: string } | { nome: string }[] | null;
              const nome = rel ? (Array.isArray(rel) ? rel[0]?.nome : rel.nome) : null;
              return (
                <li key={m.id as string} className="relative">
                  <Link
                    href={`/ludico/meditacao/${m.id}`}
                    className="group flex items-center gap-4 rounded-2xl border border-foreground/[0.07] bg-white py-4 pl-5 pr-14 transition-colors hover:border-brand-purple/30"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cat-emocao-soft text-cat-emocao">
                      <Wind className="size-5" />
                    </span>
                    <div className="flex-1">
                      <p className="font-heading text-base font-medium text-foreground">
                        {(m.titulo as string) || INTENCAO_LABEL[m.intencao as string] || "Meditação"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {INTENCAO_LABEL[m.intencao as string] ?? "Meditação"}
                        {nome ? ` · ${capitalizarNome(nome)}` : ""} · {dataBr(m.created_at as string)}
                      </p>
                    </div>
                  </Link>
                  <ExcluirMini meditacaoId={m.id as string} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
