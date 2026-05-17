import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { CampanhaForm } from "../campanha-form";

export default async function NovaCampanhaPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/campanhas"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Campanhas
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Nova campanha
        </h1>
        <p className="text-sm text-muted-foreground">
          Cria em rascunho — só é enviada após simulação + aprovação.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <CampanhaForm inicial={{}} />
        </CardContent>
      </Card>
    </div>
  );
}
