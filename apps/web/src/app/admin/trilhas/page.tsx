import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "../nav";

export default async function AdminTrilhasPage() {
  const { supabase } = await requireAdmin();

  const { data: trilhas } = await supabase
    .from("trilhas")
    .select("id, titulo, descricao, ordem, ativo")
    .order("ordem", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Trilhas</h1>
          <p className="text-sm text-muted-foreground">
            Sequências didáticas que agrupam aulas.
          </p>
        </div>
        <Link href="/admin/trilhas/nova" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus aria-hidden="true" className="size-4" /> Nova trilha
        </Link>
      </header>

      {trilhas && trilhas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {trilhas.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/trilhas/${t.id}`}
                className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{t.titulo}</p>
                    {t.descricao && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{t.descricao}</p>
                    )}
                  </div>
                  <Badge variant={t.ativo ? "default" : "secondary"}>
                    {t.ativo ? "ativa" : "inativa"}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhuma trilha</CardTitle>
            <CardDescription>Aulas sem trilha funcionam normalmente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/trilhas/nova" className={cn(buttonVariants())}>
              Criar primeira trilha
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
