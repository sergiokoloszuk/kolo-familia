import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "../nav";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  rascunho: "outline",
  ativo: "default",
  arquivado: "secondary",
};

export default async function AdminAulasPage() {
  const { supabase } = await requireAdmin();

  const { data: aulas } = await supabase
    .from("aulas")
    .select("id, titulo, status, trilha_id, ordem_na_trilha, updated_at, trilhas(titulo)")
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Aulas</h1>
          <p className="text-sm text-muted-foreground">
            Conteúdo formativo direto para a mãe (área Aprender).
          </p>
        </div>
        <Link href="/admin/aulas/nova" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus aria-hidden="true" className="size-4" /> Nova aula
        </Link>
      </header>

      {aulas && aulas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {aulas.map((a) => {
            const trilha = Array.isArray(a.trilhas) ? a.trilhas[0] : a.trilhas;
            return (
              <li key={a.id}>
                <Link
                  href={`/admin/aulas/${a.id}`}
                  className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.titulo}</span>
                      {trilha && (
                        <span className="text-xs text-muted-foreground">
                          em {trilha.titulo}
                          {a.ordem_na_trilha != null && ` · #${a.ordem_na_trilha}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[a.status] ?? "outline"}>
                        {a.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(new Date(a.updated_at), new Date(), { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhuma aula ainda</CardTitle>
            <CardDescription>Comece criando a primeira.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/aulas/nova" className={cn(buttonVariants())}>
              Criar primeira aula
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
