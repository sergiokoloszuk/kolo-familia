import Link from "next/link";
import { ChevronLeft, ListChecks } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { capitalizarNome } from "@/lib/nome";
import { idadeAnos } from "@/lib/idade";
import { NovaRotina } from "./nova-rotina";
import { SeletorCrianca } from "../../seletor-crianca";

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
      .select("id, nome, membro_atipico_id, dia_semana")
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

  // Criança ativa (cookie): lista e nova rotina já são dela.
  const ativaId = (await resolverCriancaAtivaId(membros ?? [])) ?? null;
  const rotinasVisiveis = (rotinas ?? []).filter(
    (r) =>
      (r.dia_semana as number | null) == null && // rotinas de dia vivem na "Rotina da semana"
      (!ativaId || (r.membro_atipico_id as string | null) === ativaId),
  );

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
          Uma rotina visual mostra <em className="not-italic text-foreground">o que vem agora e o que vem depois</em> —
          e isso tira o peso do desconhecido, que é o que mais desregula. A criança vai marcando o que já passou
          (fica cinza) e ganha previsibilidade e autonomia, sem cobrança. Pra criança vira cartões ilustrados;
          pro adolescente, uma lista que ele consulta no celular.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pode ser a <em className="not-italic text-foreground">semana toda</em> ou <em className="not-italic text-foreground">um dia específico</em> —
          e um dia pode ser bem do seu jeito: <span className="text-foreground">dia do dentista</span>,{" "}
          <span className="text-foreground">dia do parque</span>, <span className="text-foreground">manhã tranquila</span>,
          <span className="text-foreground"> dia de prova</span>…
        </p>
      </header>

      {membrosList.length > 1 && ativaId && (
        <div className="w-fit">
          <SeletorCrianca
            criancas={membrosList.map((m) => ({ id: m.id, nome: m.nome }))}
            ativaId={ativaId}
            variant="screen"
          />
        </div>
      )}

      {membrosList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cadastre uma criança no Perfil pra criar uma rotina.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            O que você quer montar?
          </p>
          <Link
            href="/ludico/rotinas/assistente"
            className="group flex items-center justify-between gap-4 rounded-2xl border-2 border-brand-purple/40 bg-brand-purple/[0.06] px-5 py-5 transition-colors hover:border-brand-purple/70 hover:bg-brand-purple/[0.1]"
          >
            <span className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-purple/15 text-xl">
                ✨
              </span>
              <span>
                <span className="block font-heading text-lg font-medium text-foreground">Montar com a Kolo</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Você conta como são os dias e a Kolo organiza a semana pra você. O jeito mais fácil.
                </span>
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-brand-purple px-4 py-2 text-xs font-semibold text-white transition-transform group-hover:translate-x-0.5">
              Conversar →
            </span>
          </Link>
          <Link
            href="/ludico/rotinas/semana"
            className="group flex items-center justify-between gap-4 rounded-2xl border-2 border-brand-purple/30 bg-kolo-lilas-bg-2/50 px-5 py-5 transition-colors hover:border-brand-purple/60 hover:bg-kolo-lilas-bg-2/70"
          >
            <span className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-purple/15 text-xl">
                🗓️
              </span>
              <span>
                <span className="block font-heading text-lg font-medium text-foreground">Rotina da semana</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  A semana toda (Seg–Dom), dia por dia, no tema do interesse.
                </span>
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-brand-purple px-4 py-2 text-xs font-semibold text-white transition-transform group-hover:translate-x-0.5">
              Abrir →
            </span>
          </Link>
          <NovaRotina membros={membrosList.map((m) => ({ id: m.id, nome: m.nome }))} ativaId={ativaId} />
        </div>
      )}

      {rotinasVisiveis.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rotinasVisiveis.map((r) => {
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
