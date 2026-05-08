import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "../../nav";
import { CuradoriaForm } from "./curadoria-form";

export default async function CuradoriaPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/skills"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Skills
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Curadoria assistida
        </h1>
        <p className="text-sm text-muted-foreground">
          Descreva a demanda e a IA decide se já é coberta, é melhoria de skill
          existente ou é skill nova. Você revê e aprova/edita antes de criar.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descreva a demanda</CardTitle>
          <CardDescription>
            Pode ser texto livre. Exemplo: &quot;mães pedindo orientação sobre como
            lidar com situações de bullying na escola&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CuradoriaForm />
        </CardContent>
      </Card>
    </div>
  );
}
