import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AdminNav } from "../nav";
import { AddAdminForm } from "./admin-form";
import { AdminRow } from "./admin-row";

const ROLE_LABEL: Record<string, string> = {
  admin_geral: "Geral",
  admin_conteudo: "Conteúdo",
  admin_suporte: "Suporte",
};

export default async function AdminAdminsPage() {
  const { user: currentUser } = await requireAdmin();
  const admin = createServiceRoleClient();

  const { data: acessos } = await admin
    .from("controle_acessos")
    .select("user_id, role, ativo, created_at")
    .order("created_at", { ascending: true });

  // Resolve emails via auth.users (acessível apenas com service role)
  const userIds = new Set((acessos ?? []).map((a) => a.user_id as string));
  const emailMap = new Map<string, string>();
  if (userIds.size > 0) {
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      for (const u of data.users) {
        if (userIds.has(u.id)) emailMap.set(u.id, u.email ?? "(sem email)");
      }
      if (data.users.length < 200) break;
    }
  }

  const ativos = (acessos ?? []).filter((a) => a.ativo).length;

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Admins</h1>
        <p className="text-sm text-muted-foreground">
          Quem tem acesso ao painel administrativo. Cargos: Geral (tudo),
          Conteúdo (aulas, trilhas, skills, boas práticas), Suporte (leitura
          + observabilidade).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar admin</CardTitle>
          <CardDescription>
            O usuário precisa já ter feito signup. Insira o email cadastrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddAdminForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admins cadastrados</CardTitle>
          <CardDescription>
            {acessos?.length ?? 0} cadastrado(s) · {ativos} ativo(s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(acessos?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum admin ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(acessos ?? []).map((a) => {
                const userId = a.user_id as string;
                const email = emailMap.get(userId) ?? "(usuário removido)";
                const isSelf = userId === currentUser.id;
                return (
                  <li
                    key={userId}
                    className="flex flex-col gap-1.5 rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{email}</p>
                        <Badge variant={a.ativo ? "default" : "secondary"}>
                          {a.ativo ? "ativo" : "desativado"}
                        </Badge>
                        {isSelf && <Badge variant="outline">você</Badge>}
                      </div>
                      <AdminRow
                        userId={userId}
                        role={a.role as string}
                        ativo={a.ativo as boolean}
                        isSelf={isSelf}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cargo: {ROLE_LABEL[a.role as string] ?? a.role}
                      {" · criado em "}
                      {format(new Date(a.created_at as string), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
