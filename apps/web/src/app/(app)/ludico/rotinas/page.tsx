import Link from "next/link";
import { ChevronLeft, ListChecks } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { capitalizarNome } from "@/lib/nome";
import { idadeAnos } from "@/lib/idade";
import { Eyebrow } from "@/components/brand/eyebrow";
import { CriarRotinaVisual } from "./criar-rotina-visual";
import { interessesDaCrianca, avatarDaCrianca } from "@/lib/ludico/interesses";
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

  // Chips de tema e personagem: SEMPRE da criança ativa, filtrados por família.
  // Um interesse ou avatar que vaza de outro filho é o mesmo erro que pôs a
  // rotina da consulta médica no irmão — só que ninguém repara.
  const [interesses, avatarUrl] = ativaId
    ? await Promise.all([
        interessesDaCrianca(supabase, { membroId: ativaId, familyId }),
        avatarDaCrianca(supabase, { membroId: ativaId, familyId }),
      ])
    : [[] as string[], null];

  // A semana continua existindo pra quem já montou lá — só deixou de ser porta
  // de criação. O atalho aparece apenas pra quem tem rotina de dia da semana.
  const temSemana = (rotinas ?? []).some(
    (r) =>
      (r.dia_semana as number | null) != null &&
      (!ativaId || (r.membro_atipico_id as string | null) === ativaId),
  );
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
        <Eyebrow>Rotina Visual</Eyebrow>
        <h1 className="mt-2 font-heading text-4xl leading-[1.05] text-foreground md:text-5xl">
          A sequência do dia, <em className="not-italic text-brand-purple">do jeito de cada um</em>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Você escreve o que vai acontecer.{" "}
          <em className="not-italic text-foreground">A Kolo transforma a sequência em cartões ilustrados</em>{" "}
          pra criança acompanhar. Serve pro dia inteiro, pro dia do dentista ou pra um momento
          difícil — mostrar o que vem agora e o que vem depois tira o peso do desconhecido, que é o
          que mais desregula.
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
        <p className="text-base text-muted-foreground">
          Cadastre uma pessoa no Perfil pra criar uma rotina.
        </p>
      ) : (
        <CriarRotinaVisual
          membroId={ativaId ?? membrosList[0]!.id}
          nomeMembro={nomePorMembro.get(ativaId ?? membrosList[0]!.id)?.nome ?? ""}
          interesses={interesses}
          temAvatar={Boolean(avatarUrl)}
        />
      )}

      {temSemana && (
        <Link
          href="/ludico/rotinas/semana"
          className="flex w-fit items-center gap-2 rounded-full border border-kolo-linha bg-white px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand-purple/40 hover:text-foreground"
        >
          🗓️ Ver a rotina da semana que você já montou
        </Link>
      )}

      {rotinasVisiveis.length > 0 && (
        <section className="flex max-w-3xl flex-col gap-3 border-t border-kolo-linha pt-8">
          <h2 className="font-heading text-xl text-foreground md:text-2xl">
            Suas rotinas <span className="text-base font-normal text-muted-foreground">· {rotinasVisiveis.length}</span>
          </h2>
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
        </section>
      )}
    </div>
  );
}
