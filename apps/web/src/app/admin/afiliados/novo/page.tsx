import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AfiliadoFormulario } from "../afiliado-form";

export default async function NovoAfiliadoPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/afiliados"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Afiliados
      </Link>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Novo afiliado</h1>
      <AfiliadoFormulario />
    </div>
  );
}
