import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  Eye,
  Sparkles,
  TriangleAlert,
  X as XIcon,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { cn } from "@/lib/utils";
import {
  aprovarPadrao,
  rejeitarPadrao,
  marcarIrrelevante,
  ajustarRelevanciaFromForm,
  reabrirPadrao,
} from "./actions";

/**
 * Painel mínimo de revisão de padrões hipotéticos.
 *
 * Princípio Karina (18/05/2026): "Isso será parte importante do
 * treinamento longitudinal da Kolo." Cada decisão de revisão calibra
 * as heurísticas futuras.
 *
 * Filtros via search param `?estado=...`:
 *   pendentes (default) = hipotese ou observado, sem revisão
 *   aprovados           = confirmado_mae
 *   descartados         = descartado
 *   todos               = todos os estados
 */

type FiltroEstado = "pendentes" | "aprovados" | "descartados" | "todos";

export default async function AdminPadroesPage(
  props: PageProps<"/admin/padroes">,
) {
  const { supabase } = await requireAdmin();
  const sp = await props.searchParams;
  const filtro: FiltroEstado =
    typeof sp.estado === "string" &&
    ["pendentes", "aprovados", "descartados", "todos"].includes(sp.estado)
      ? (sp.estado as FiltroEstado)
      : "pendentes";

  let query = supabase
    .from("ayla_padroes")
    .select(
      "id, padrao_key, descricao, evidencias_count, confianca, estado, primeira_evidencia, ultima_evidencia, motivo_hipotese, sinais_correlacionados, janela_analisada, relevancia_karina, revisado_em, revisado_por, family_account_id, membro_atipico_id, membros_atipicos(nome)",
    )
    .order("ultima_evidencia", { ascending: false })
    .limit(100);

  if (filtro === "pendentes") {
    query = query
      .in("estado", ["hipotese", "observado"])
      .is("revisado_em", null);
  } else if (filtro === "aprovados") {
    query = query.eq("estado", "confirmado_mae");
  } else if (filtro === "descartados") {
    query = query.eq("estado", "descartado");
  }

  const { data: padroes } = await query;

  // Contadores pros chips de filtro
  const [contPend, contAprov, contDesc, contTotal] = await Promise.all([
    supabase
      .from("ayla_padroes")
      .select("id", { count: "exact", head: true })
      .in("estado", ["hipotese", "observado"])
      .is("revisado_em", null),
    supabase
      .from("ayla_padroes")
      .select("id", { count: "exact", head: true })
      .eq("estado", "confirmado_mae"),
    supabase
      .from("ayla_padroes")
      .select("id", { count: "exact", head: true })
      .eq("estado", "descartado"),
    supabase
      .from("ayla_padroes")
      .select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <Sparkles aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Padrões longitudinais</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Hipóteses{" "}
            <em className="not-italic text-brand-purple">observadas</em>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Padrões detectados por heurísticas determinísticas a partir da
            memória longitudinal. Linguagem é observacional, não diagnóstica.
            Sua revisão alimenta o aprendizado futuro da Ayla.
          </p>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <FiltroChip
          ativo={filtro === "pendentes"}
          href="/admin/padroes?estado=pendentes"
          label="Pendentes"
          contagem={contPend.count ?? 0}
        />
        <FiltroChip
          ativo={filtro === "aprovados"}
          href="/admin/padroes?estado=aprovados"
          label="Aprovados"
          contagem={contAprov.count ?? 0}
        />
        <FiltroChip
          ativo={filtro === "descartados"}
          href="/admin/padroes?estado=descartados"
          label="Descartados"
          contagem={contDesc.count ?? 0}
        />
        <FiltroChip
          ativo={filtro === "todos"}
          href="/admin/padroes?estado=todos"
          label="Todos"
          contagem={contTotal.count ?? 0}
        />
      </div>

      {/* Lista de padrões */}
      {padroes && padroes.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {padroes.map((p) => {
            const nomeMembro = Array.isArray(p.membros_atipicos)
              ? p.membros_atipicos[0]?.nome
              : (p.membros_atipicos as { nome: string } | null)?.nome;
            return (
              <li key={p.id}>
                <PadraoCard padrao={p} nomeMembro={nomeMembro ?? null} />
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="rounded-3xl border-l-4 border-brand-yellow bg-kolo-lilas-bg-2">
          <CardHeader>
            <CardTitle className="text-base">
              {filtro === "pendentes"
                ? "Nada pra revisar agora"
                : "Sem padrões neste filtro"}
            </CardTitle>
            <CardDescription>
              {filtro === "pendentes"
                ? "Rode o avaliador de padrões: node apps/web/scripts/ayla-avaliar-padroes.mjs"
                : "Mude o filtro acima pra ver outras categorias."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Componentes
// ============================================================

function FiltroChip({
  ativo,
  href,
  label,
  contagem,
}: {
  ativo: boolean;
  href: string;
  label: string;
  contagem: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
        ativo
          ? "bg-brand-purple text-white"
          : "bg-kolo-lilas-bg-2 text-muted-foreground hover:bg-kolo-lilas hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px]",
          ativo
            ? "bg-white/20 text-white"
            : "bg-white text-muted-foreground",
        )}
      >
        {contagem}
      </span>
    </Link>
  );
}

interface PadraoData {
  id: string;
  padrao_key: string;
  descricao: string;
  evidencias_count: number;
  confianca: number;
  estado: string;
  primeira_evidencia: string;
  ultima_evidencia: string;
  motivo_hipotese: string | null;
  sinais_correlacionados: string[];
  janela_analisada: string | null;
  relevancia_karina: number | null;
  revisado_em: string | null;
}

function PadraoCard({
  padrao,
  nomeMembro,
}: {
  padrao: PadraoData;
  nomeMembro: string | null;
}) {
  const revisado = Boolean(padrao.revisado_em);
  return (
    <Card className="rounded-3xl bg-white">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <Badge
            variant={
              padrao.estado === "confirmado_mae"
                ? "default"
                : padrao.estado === "descartado"
                  ? "secondary"
                  : "outline"
            }
          >
            {labelEstado(padrao.estado)}
          </Badge>
          <Badge variant="outline">
            confiança {Math.round(padrao.confianca * 100)}%
          </Badge>
          {padrao.janela_analisada && (
            <Badge variant="outline">janela {padrao.janela_analisada}</Badge>
          )}
          {padrao.relevancia_karina != null && (
            <Badge
              variant={
                padrao.relevancia_karina === -1 ? "secondary" : "default"
              }
            >
              {padrao.relevancia_karina === -1
                ? "irrelevante"
                : `relevância ${padrao.relevancia_karina}`}
            </Badge>
          )}
          {nomeMembro && (
            <span className="text-xs text-muted-foreground">
              · {nomeMembro}
            </span>
          )}
        </div>

        <CardTitle className="font-heading text-lg leading-snug text-foreground">
          {padrao.descricao}
        </CardTitle>

        <CardDescription className="text-xs">
          {padrao.motivo_hipotese && (
            <>heurística: <code className="rounded bg-kolo-lilas-bg-2 px-1.5 py-0.5">{padrao.motivo_hipotese}</code> · </>
          )}
          {padrao.evidencias_count} evidências ·{" "}
          {formatRelative(new Date(padrao.primeira_evidencia), new Date(), {
            locale: ptBR,
          })}
          {" → "}
          {formatRelative(new Date(padrao.ultima_evidencia), new Date(), {
            locale: ptBR,
          })}
        </CardDescription>
      </CardHeader>

      {/* Sinais correlacionados — auditoria */}
      {padrao.sinais_correlacionados &&
        padrao.sinais_correlacionados.length > 0 && (
          <CardContent>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-purple">
              Sinais correlacionados
            </p>
            <ul className="flex flex-wrap gap-2">
              {padrao.sinais_correlacionados.map((s, i) => (
                <li
                  key={i}
                  className="rounded-full bg-kolo-lilas-bg-2 px-3 py-1 text-xs text-foreground/80"
                >
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        )}

      {/* Ações de revisão */}
      <CardContent className="flex flex-wrap items-center gap-2 border-t border-kolo-linha pt-4">
        {!revisado ? (
          <>
            <form action={aprovarPadrao.bind(null, padrao.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-dark"
              >
                <Check className="size-3.5" aria-hidden /> Aprovar
              </button>
            </form>
            <form action={rejeitarPadrao.bind(null, padrao.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-kolo-linha bg-white px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground"
              >
                <XIcon className="size-3.5" aria-hidden /> Rejeitar
              </button>
            </form>
            <form action={marcarIrrelevante.bind(null, padrao.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-kolo-linha bg-white px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground"
              >
                <TriangleAlert className="size-3.5" aria-hidden /> Irrelevante
              </button>
            </form>
            <RelevanciaForm padraoId={padrao.id} />
          </>
        ) : (
          <form action={reabrirPadrao.bind(null, padrao.id)}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-kolo-linha bg-white px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-kolo-lilas-bg-2 hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Reabrir pra
              revisão
            </button>
          </form>
        )}

        {/* Detalhe técnico recolhido */}
        <details className="ml-auto text-xs text-muted-foreground">
          <summary className="cursor-pointer inline-flex items-center gap-1 hover:text-foreground">
            <Eye className="size-3.5" aria-hidden /> detalhes
          </summary>
          <div className="mt-2 rounded-lg bg-kolo-lilas-bg-2 p-3 font-mono text-[10px]">
            <p>id: {padrao.id}</p>
            <p>key: {padrao.padrao_key}</p>
            <p>evidências: {padrao.evidencias_count} eventos</p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function RelevanciaForm({ padraoId }: { padraoId: string }) {
  async function onSubmit(formData: FormData) {
    "use server";
    const valor = Number(formData.get("relevancia"));
    if (Number.isFinite(valor)) {
      await ajustarRelevancia(padraoId, valor);
    }
  }
  return (
    <form action={onSubmit} className="inline-flex items-center gap-2">
      <label
        htmlFor={`rel-${padraoId}`}
        className="text-xs font-semibold text-muted-foreground"
      >
        relevância:
      </label>
      <select
        id={`rel-${padraoId}`}
        name="relevancia"
        defaultValue=""
        className="rounded-md border border-kolo-linha bg-white px-2 py-1 text-xs text-foreground"
      >
        <option value="" disabled>
          —
        </option>
        <option value="0">0 (neutro)</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5 (alta)</option>
      </select>
      <button
        type="submit"
        className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-semibold text-brand-purple-dark hover:bg-brand-yellow-light"
      >
        Salvar
      </button>
    </form>
  );
}

function labelEstado(estado: string): string {
  switch (estado) {
    case "hipotese":
      return "hipótese";
    case "observado":
      return "observado";
    case "confirmado_mae":
      return "aprovado";
    case "descartado":
      return "descartado";
    default:
      return estado;
  }
}
