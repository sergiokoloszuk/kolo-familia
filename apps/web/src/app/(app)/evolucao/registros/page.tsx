import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { SeletorCrianca } from "../../seletor-crianca";

/**
 * "Tudo que registrei" — o histórico cru dos registros diários da criança
 * ativa, do mais recente ao mais antigo, agrupado por mês. É o arquivo honesto
 * (onde a mãe vê tudo que escreveu), separado da Evolução, que é a leitura
 * interpretada e limitada. Acessível pela Evolução.
 */
export const dynamic = "force-dynamic";

type Registro = {
  id: string;
  data: string;
  conquista: string | null;
  desafio: string | null;
  observacao_livre: string | null;
  possivel_gatilho: string | null;
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** 'YYYY-MM' → 'julho de 2026' */
function rotuloMes(chave: string): string {
  const [y, m] = chave.split("-");
  return `${MESES[Number(m) - 1] ?? ""} de ${y}`;
}

/** 'YYYY-MM-DD' → '01/07' */
function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default async function RegistrosPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const ativaId = (await resolverCriancaAtivaId(membros ?? [])) ?? null;
  const criancas = (membros ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
  }));

  const diarios: Registro[] = ativaId
    ? (((
        await supabase
          .from("diarios")
          .select("id, data, conquista, desafio, observacao_livre, possivel_gatilho")
          .eq("family_account_id", familyId)
          .eq("membro_atipico_id", ativaId)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false })
      ).data ?? []) as Registro[])
    : [];

  // Agrupa por mês (YYYY-MM), preservando a ordem (já vem do mais recente).
  const porMes = new Map<string, Registro[]>();
  for (const d of diarios) {
    const chave = d.data.slice(0, 7);
    if (!porMes.has(chave)) porMes.set(chave, []);
    porMes.get(chave)!.push(d);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/evolucao"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-3" /> Evolução
        </Link>
        <Eyebrow>Registros</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Tudo que <em className="not-italic text-brand-purple">registrei</em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Cada dia que você anotou, do mais recente ao mais antigo.
        </p>
        {criancas.length > 1 && ativaId && (
          <div className="mt-4 w-fit">
            <SeletorCrianca criancas={criancas} ativaId={ativaId} variant="screen" />
          </div>
        )}
      </header>

      {diarios.length === 0 ? (
        <p className="text-muted-foreground">
          Você ainda não registrou nenhum dia.{" "}
          <Link href="/registrar/diario" className="font-medium text-brand-purple hover:underline">
            Registrar hoje →
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {[...porMes.entries()].map(([mes, itens]) => (
            <section key={mes} className="flex flex-col gap-3">
              <h2 className="font-heading text-lg capitalize text-foreground">
                {rotuloMes(mes)}
              </h2>
              <ul className="flex flex-col gap-3">
                {itens.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-2xl border border-foreground/[0.08] bg-white px-4 py-3"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {dataCurta(d.data)}
                    </p>
                    <div className="mt-1 flex flex-col gap-1 text-sm text-foreground">
                      {d.conquista && (
                        <p>
                          <span className="text-cat-social">✓</span> {d.conquista}
                        </p>
                      )}
                      {d.desafio && <p>{d.desafio}</p>}
                      {d.observacao_livre && (
                        <p className="text-foreground/80">{d.observacao_livre}</p>
                      )}
                      {d.possivel_gatilho && (
                        <p className="text-xs text-muted-foreground">
                          possível gatilho: {d.possivel_gatilho}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
