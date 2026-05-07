import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { BootstrapButton } from "./bootstrap-button";

export default async function AdminSetupPage() {
  const { user } = await requireUser();
  const admin = createServiceRoleClient();

  // Já é admin? Redireciona pro admin dashboard.
  const userClient = await createClient();
  const { data: meAccess } = await userClient
    .from("controle_acessos")
    .select("role, ativo")
    .eq("user_id", user.id)
    .maybeSingle();
  if (meAccess?.ativo) redirect("/admin");

  // Existe algum admin ativo? Se sim, ninguém mais pode bootstrap.
  const { data: existingAdmins } = await admin
    .from("controle_acessos")
    .select("user_id")
    .eq("ativo", true)
    .limit(1);

  const jaTemAdmin = (existingAdmins?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Acesso administrativo</CardTitle>
          <CardDescription>
            {jaTemAdmin
              ? "Esta área é restrita à equipe Kolo Família."
              : "Você está autenticado como o primeiro usuário e ainda não há nenhum admin cadastrado. Pode se tornar o primeiro."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            Logado como: <strong>{user.email}</strong>
          </p>
          {jaTemAdmin ? (
            <p className="text-muted-foreground">
              Se você precisa de acesso admin, peça para um admin existente ativar sua conta em
              <code className="mx-1 rounded bg-muted px-1">controle_acessos</code>.
            </p>
          ) : (
            <BootstrapButton />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
