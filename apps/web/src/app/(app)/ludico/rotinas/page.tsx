import Link from "next/link";
import { ChevronLeft, ListChecks } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";
import { idadeAnos } from "@/lib/idade";
import { NovaRotina } from "./nova-rotina";

export default async function RotinasPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: rotinas }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("rotinas")
      .select("id, nome, membro_atipico_id")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false }),
  ]);

  const rotinaIds = (rotinas ?? []).map((r) => r.id as string);
  const { data: tarefas } = rotinaIds.length
    ? await supabase
        .from("rotina_tarefas")
        .select("rotina_id, concluida")
        .in("rotina_id", rotinaIds)
    : { data: [] as Array<{ rotina_id: string; concluida: boolean }> };

  const contagem = new Map<string, { total: number; feito: number }>();
  for (const t of (tarefas ?? []) as Array<{ rotina_id: string; concluida: boolean }>) {
    const c = contagem.get(t.rotina_id) ?? { total: 0, feito: 0 };
    c.total += 1;
    if (t.concluida) c.feito += 1;
    contagem.set(t.rotina_id, c);
  }

  const membrosList = (membros ?? []).map((m) => ({
    id: m.id as string,
    nome: capitalizarNome(m.nome as string),
    idade: idadeAnos((m.data_nascimento as string | null) ?? null),
  }));
  const nomePorMembro = new Map(membrosList.map((m) => [m.id, m]));

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
          Rotinas visuais
        </p>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          A sequência do dia, <em className="not-italic text-brand-purple">do jeito de cada um</em>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Monte uma rotina, ordene os passos e vão marcando o que já passou — fica cinza.
          Pra criança vira cartões visuais; pro adolescente, uma lista que ele consulta.
          É previsibilidade e autonomia, não cobrança.
        </p>
      </header>

      {membrosList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cadastre uma criança no Perfil pra criar uma rotina.
        </p>
      ) : (
        <NovaRotina membros={membrosList.map((m) => ({ id: m.id, nome: m.nome }))} />
      )}

      {(rotinas ?? []).length > 0 && (
        <ul className="flex flex-col gap-3">
          {(rotinas ?? []).map((r) => {
            const c = contagem.get(r.id as string) ?? { total: 0, feito: 0 };
            const dono = r.membro_atipico_id
              ? nomePorMembro.get(r.membro_atipico_id as string)
              : null;
            return (
              <li key={r.id as string}>
                <Link
                  href={`/ludico/rotinas/${r.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-foreground/[0.07] bg-white px-5 py-4 transition-colors hover:border-brand-purple/30"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cat-foco-soft text-cat-foco">
                    <ListChecks className="size-5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-heading text-lg font-medium text-foreground">{r.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {dono ? `${dono.nome}${dono.idade != null ? `, ${dono.idade} anos` : ""}` : "Sem membro"}
                      {c.total > 0 && ` · ${c.feito}/${c.total} feito`}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
