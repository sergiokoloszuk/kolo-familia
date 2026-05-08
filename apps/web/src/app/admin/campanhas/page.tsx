import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "../nav";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  rascunho: "outline",
  aguardando_aprovacao: "secondary",
  aprovada: "default",
  enviando: "default",
  enviada: "secondary",
  cancelada: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  enviando: "Enviando",
  enviada: "Enviada",
  cancelada: "Cancelada",
};

const CATEGORIA_LABEL: Record<string, string> = {
  informacional: "Informacional",
  promocional: "Promocional",
  avaliacao: "Avaliação",
  operacional: "Operacional",
};

export default async function AdminCampanhasPage() {
  const { supabase } = await requireAdmin();

  const { data: campanhas } = await supabase
    .from("campanhas")
    .select(
      "id, titulo, categoria, status, total_alcance, total_bloqueados, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Campanhas
          </h1>
          <p className="text-sm text-muted-foreground">
            Comunicados administrativos por WhatsApp. Toda campanha exige
            aprovação antes do disparo — mesmo que você seja autora e
            aprovadora.
          </p>
        </div>
        <Link
          href="/admin/campanhas/nova"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus aria-hidden="true" className="size-4" /> Nova campanha
        </Link>
      </header>

      {campanhas && campanhas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {campanhas.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/campanhas/${c.id}`}
                className="block rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORIA_LABEL[c.categoria] ?? c.categoria} ·{" "}
                      {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                      {c.status === "enviada" &&
                        ` · ${c.total_alcance ?? 0} entregues, ${c.total_bloqueados ?? 0} bloqueados`}
                    </p>
                  </div>
                  <Badge
                    variant={STATUS_VARIANT[c.status] ?? "outline"}
                    className="shrink-0"
                  >
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sem campanhas ainda</CardTitle>
            <CardDescription>
              Comece criando uma campanha em rascunho. Você pode editar
              livremente até submetê-la pra aprovação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/campanhas/nova" className={cn(buttonVariants())}>
              Criar campanha
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
