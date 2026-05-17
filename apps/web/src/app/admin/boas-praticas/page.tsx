import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  rascunho: "outline",
  ativo: "default",
  arquivado: "secondary",
};

export default async function AdminBoasPraticasPage(props: PageProps<"/admin/boas-praticas">) {
  const { supabase } = await requireAdmin();
  const sp = await props.searchParams;
  const filtroStatus = typeof sp.status === "string" ? sp.status : undefined;

  let query = supabase
    .from("boas_praticas")
    .select("id, titulo, status, origem, peso_relevancia, created_at")
    .order("created_at", { ascending: false });

  if (filtroStatus && ["rascunho", "ativo", "arquivado"].includes(filtroStatus)) {
    query = query.eq("status", filtroStatus);
  }

  const { data: bps } = await query;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Boas Práticas</h1>
        <p className="text-sm text-muted-foreground">
          Orientações curadas que as skills consomem em todo turno.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterPill label="Todas" href="/admin/boas-praticas" active={!filtroStatus} />
        <FilterPill
          label="Rascunho"
          href="/admin/boas-praticas?status=rascunho"
          active={filtroStatus === "rascunho"}
        />
        <FilterPill
          label="Ativas"
          href="/admin/boas-praticas?status=ativo"
          active={filtroStatus === "ativo"}
        />
        <FilterPill
          label="Arquivadas"
          href="/admin/boas-praticas?status=arquivado"
          active={filtroStatus === "arquivado"}
        />
      </div>

      {bps && bps.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {bps.map((bp) => (
            <li key={bp.id}>
              <Link
                href={`/admin/boas-praticas/${bp.id}`}
                className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="line-clamp-1 font-medium">{bp.titulo ?? "(sem título)"}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[bp.status] ?? "outline"}>{bp.status}</Badge>
                    <span className="text-xs text-muted-foreground">{bp.origem}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(new Date(bp.created_at), new Date(), { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhuma neste filtro</CardTitle>
            <CardDescription>
              Boas Práticas surgem ao publicar uma aula com transcrição (extração automática
              da IA) ou via cadastro manual (próxima sessão).
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </div>
  );
}

function FilterPill({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs ${
        active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}
