import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FamRow, Rank } from "@/lib/analytics/dashboard";

/**
 * Blocos de UI do dashboard de comportamento — compartilhados entre
 * /admin/comportamento (admin, com nomes) e /dashboards (analista, anônimo).
 */

export function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card className="rounded-3xl">
      <CardHeader className="gap-1">
        <CardDescription className="text-xs uppercase tracking-[0.12em] text-muted-foreground/80">
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-3xl text-foreground">{value}</CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

export function Bloco({
  titulo,
  desc,
  children,
}: {
  titulo: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function BarList({ items }: { items: Rank[] }) {
  if (!items.length) return <Vazio />;
  const max = Math.max(...items.map((i) => i.n), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3">
          <span className="w-44 shrink-0 truncate text-sm text-foreground" title={i.label}>
            {i.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
            <span
              className="block h-full rounded-full bg-brand-yellow"
              style={{ width: `${Math.round((i.n / max) * 100)}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground">{i.n}</span>
        </li>
      ))}
    </ul>
  );
}

export function Vazio({ texto = "Ainda sem dados — começa a encher com o uso." }: { texto?: string }) {
  return <p className="text-sm text-muted-foreground">{texto}</p>;
}

export function fmtData(ms: number): string {
  return ms > 0 ? new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
}

/**
 * Tabela de famílias. `labelFam` decide o rótulo (admin mostra nome; analista
 * mostra só um id curto anônimo) — assim a mesma tabela serve às duas telas.
 */
export function TabelaFamilias({
  linhas,
  labelFam,
}: {
  linhas: FamRow[];
  labelFam: (f: FamRow) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Família</th>
            <th className="px-3 py-2 text-right font-medium">Ayla</th>
            <th className="px-3 py-2 text-right font-medium">Web</th>
            <th className="px-3 py-2 text-right font-medium">Diários</th>
            <th className="px-3 py-2 text-right font-medium">Lúdico</th>
            <th className="px-3 py-2 text-right font-medium">Planos</th>
            <th className="px-3 py-2 text-right font-medium">Último acesso</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((f) => (
            <tr key={f.id} className="border-t border-foreground/[0.06]">
              <td className="py-2 pr-3 text-foreground">{labelFam(f)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.ayla}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.web}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.diarios}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.ludico}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.planos}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmtData(f.ultima)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
