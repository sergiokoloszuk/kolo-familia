import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { capitalizarNome } from "@/lib/nome";
import { Eyebrow } from "@/components/brand/eyebrow";
import { SeletorCrianca } from "../../../seletor-crianca";
import { DIAS_SEMANA } from "../dias";
import { CriarDia } from "../criar-dia";
import { CopiarDia } from "../copiar-dia";
import { TemaSemana } from "../tema-semana";
import { ImprimirSemana } from "./imprimir-semana";

/**
 * Rotina da SEMANA — visão por dia (Seg–Dom). Cada dia é uma rotina própria
 * (reusa o editor e o gerador de cartões). A pessoa monta só os dias que quer;
 * gera os cartões de cada dia sob demanda pelo editor daquele dia.
 */
export default async function RotinaSemanaPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const membrosList = (membros ?? []).map((m) => ({
    id: m.id as string,
    nome: capitalizarNome(m.nome as string),
  }));
  const ativaId = (await resolverCriancaAtivaId(membros ?? [])) ?? null;

  const { data: rotinas } = ativaId
    ? await supabase
        .from("rotinas")
        .select("id, dia_semana, tema, cards_status")
        .eq("membro_atipico_id", ativaId)
        .not("dia_semana", "is", null)
    : { data: [] as Array<{ id: string; dia_semana: number; tema: string | null; cards_status: string }> };

  const ids = (rotinas ?? []).map((r) => r.id as string);
  const { data: tarefas } = ids.length
    ? await supabase
        .from("rotina_tarefas")
        .select("rotina_id, texto, hora, ordem")
        .in("rotina_id", ids)
        .order("ordem", { ascending: true })
    : { data: [] as Array<{ rotina_id: string; texto: string; hora: string | null; ordem: number }> };

  const rotinaPorDia = new Map<number, { id: string; tema: string | null; cards_status: string }>();
  for (const r of rotinas ?? [])
    rotinaPorDia.set(r.dia_semana as number, {
      id: r.id as string,
      tema: (r.tema as string | null) ?? null,
      cards_status: (r.cards_status as string) ?? "nenhum",
    });
  const tarefasPorRotina = new Map<string, Array<{ texto: string; hora: string | null }>>();
  for (const t of tarefas ?? []) {
    const arr = tarefasPorRotina.get(t.rotina_id as string) ?? [];
    arr.push({ texto: t.texto as string, hora: (t.hora as string | null) ?? null });
    tarefasPorRotina.set(t.rotina_id as string, arr);
  }

  const nomeAtiva = membrosList.find((m) => m.id === ativaId)?.nome ?? "";
  const temaSemana = (rotinas ?? []).map((r) => (r.tema as string | null) ?? null).find(Boolean) ?? null;
  const temAlgumDia = (rotinas ?? []).length > 0;
  const temCartoesProntos = (rotinas ?? []).some((r) => (r.cards_status as string) === "pronto");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/ludico/rotinas"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ChevronLeft className="size-4" aria-hidden /> Rotinas
      </Link>

      <header className="max-w-2xl">
        <div className="print:hidden">
          <Eyebrow>Rotina Visual</Eyebrow>
        </div>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Rotina da <em className="not-italic text-brand-purple">semana</em>
          {nomeAtiva ? ` — ${nomeAtiva}` : ""}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground print:hidden">
          Monte a sequência de cada dia (o horário é opcional). Ligue só os dias que fizerem sentido.
          Os cartões ilustrados de cada dia você gera quando quiser, no editor do dia.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {membrosList.length > 1 && ativaId && (
          <SeletorCrianca
            criancas={membrosList.map((m) => ({ id: m.id, nome: m.nome }))}
            ativaId={ativaId}
            variant="screen"
          />
        )}
        {temAlgumDia && <ImprimirSemana />}
        {temCartoesProntos && (
          <a
            href="/api/ludico/rotinas/semana/cartoes"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-brand-purple/30 px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-brand-purple/5"
          >
            ✂️ Cartões pra recortar
          </a>
        )}
      </div>

      {membrosList.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cadastre uma pessoa no Perfil pra montar a rotina.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {ativaId && (
            <div className="print:hidden">
              <TemaSemana membroId={ativaId} temaAtual={temaSemana} />
            </div>
          )}
          {DIAS_SEMANA.map((nomeDia, dia) => {
            const rot = rotinaPorDia.get(dia);
            const tasks = rot ? tarefasPorRotina.get(rot.id) ?? [] : [];
            return (
              <div
                key={dia}
                className={`rounded-2xl border border-kolo-linha p-4 ${rot ? "bg-white" : "bg-secondary/30"} ${
                  rot && tasks.length > 0 ? "" : "print:hidden"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${rot ? "bg-brand-purple" : "bg-foreground/20"}`} />
                    <span className="font-heading text-base text-foreground">{nomeDia}</span>
                    {rot?.cards_status === "gerando" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-yellow/25 px-2 py-0.5 text-[11px] font-semibold text-[#8B5A00]">
                        <span className="animate-bounce" aria-hidden>
                          ⏳
                        </span>{" "}
                        gerando…
                      </span>
                    )}
                    {rot?.cards_status === "pronto" && (
                      <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[11px] font-medium text-brand-purple">
                        cartões prontos ✓
                      </span>
                    )}
                  </div>
                  {rot ? (
                    <Link
                      href={`/ludico/rotinas/${rot.id}`}
                      className="rounded-full bg-brand-purple px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple/90 print:hidden"
                    >
                      Editar / cartões
                    </Link>
                  ) : (
                    ativaId && (
                      <span className="print:hidden">
                        <CriarDia membroId={ativaId} diaSemana={dia} />
                      </span>
                    )
                  )}
                </div>

                {rot && tasks.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {tasks.map((t, i) => (
                      <span key={i} className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-xl border border-kolo-linha bg-kolo-lilas-bg-2/40 px-3 py-1.5 text-sm text-foreground print:rounded-md print:border-foreground/40">
                          <span className="hidden text-base leading-none print:inline" aria-hidden>
                            ☐
                          </span>
                          {t.hora && (
                            <span className="rounded bg-white px-1.5 text-[11px] font-bold tabular-nums text-brand-purple print:bg-transparent">
                              {t.hora}
                            </span>
                          )}
                          {t.texto}
                        </span>
                        {i < tasks.length - 1 && (
                          <span className="text-xs text-muted-foreground print:hidden">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {rot && tasks.length === 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">Sem tarefas ainda — abra pra montar a sequência.</p>
                )}
                {rot && tasks.length > 0 && (
                  <div className="mt-3 print:hidden">
                    <CopiarDia rotinaId={rot.id} diaOrigem={dia} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
