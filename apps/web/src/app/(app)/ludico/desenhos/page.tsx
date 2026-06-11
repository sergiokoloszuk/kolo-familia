import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";
import { EnviarDesenho } from "./enviar-desenho";

// A análise (Claude visão) roda em segundo plano após o upload — teto largo.
export const maxDuration = 300;

function dataBr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function DesenhosPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: desenhos }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("desenhos")
      .select("id, imagem_url, status, created_at, membro_atipico_id, membros_atipicos(nome)")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(60),
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
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-purple">
          O que o desenho conta?
        </p>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Uma leitura <em className="not-italic text-brand-purple">cuidadosa</em>, pra
          observar e perguntar
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Envie a foto de um desenho e a Kolo te ajuda a notar o que aparece e a fazer boas
          perguntas — sem rótulos, sem diagnóstico. Cada desenho fica guardado com a data,
          pra vocês acompanharem a evolução ao longo do tempo.
        </p>
      </header>

      {membrosList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cadastre um membro no Kolo Vivo pra começar.
        </p>
      ) : (
        <EnviarDesenho membros={membrosList} />
      )}

      {(desenhos ?? []).length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl text-foreground">Diário de desenhos</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(desenhos ?? []).map((d) => {
              const rel = d.membros_atipicos as { nome: string } | { nome: string }[] | null;
              const nome = rel
                ? Array.isArray(rel)
                  ? rel[0]?.nome
                  : rel.nome
                : null;
              return (
                <li key={d.id as string}>
                  <Link
                    href={`/ludico/desenhos/${d.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/[0.07] bg-white transition-colors hover:border-brand-purple/30"
                  >
                    <div className="relative aspect-square overflow-hidden bg-secondary/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.imagem_url as string}
                        alt="Desenho"
                        className="size-full object-cover"
                      />
                      {d.status === "analisando" && (
                        <span className="absolute inset-x-0 bottom-0 bg-brand-purple/80 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
                          analisando…
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 px-3 py-2">
                      <span className="text-sm font-medium text-foreground">
                        {dataBr(d.created_at as string)}
                      </span>
                      {nome && (
                        <span className="text-xs text-muted-foreground">
                          {capitalizarNome(nome)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
