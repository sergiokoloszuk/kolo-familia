import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AfiliadoFormulario, type AfiliadoForm } from "../afiliado-form";
import { CopyLink } from "../copy-link";

export default async function EditarAfiliadoPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: af } = await supabase
    .from("afiliados")
    .select(
      "id, nome, email, codigo_unico, ativo, comissao_tipo, comissao_valor, comissao_meses, desconto_tipo, desconto_valor, desconto_duracao, janela_atribuicao_dias, observacoes",
    )
    .eq("id", id)
    .maybeSingle();
  if (!af) notFound();

  const admin = createServiceRoleClient();
  const [{ count: cliques }, { count: cadastros }] = await Promise.all([
    admin
      .from("afiliado_cliques")
      .select("id", { count: "exact", head: true })
      .eq("afiliado_id", id),
    admin
      .from("family_accounts")
      .select("id", { count: "exact", head: true })
      .eq("afiliado_id", id),
  ]);

  const inicial: AfiliadoForm = {
    id: af.id as string,
    nome: af.nome as string,
    email: af.email as string,
    codigo_unico: af.codigo_unico as string,
    ativo: af.ativo as boolean,
    comissao_tipo: af.comissao_tipo as AfiliadoForm["comissao_tipo"],
    comissao_valor: Number(af.comissao_valor),
    comissao_meses: Number(af.comissao_meses),
    desconto_tipo: af.desconto_tipo as AfiliadoForm["desconto_tipo"],
    desconto_valor: Number(af.desconto_valor),
    desconto_duracao: af.desconto_duracao as AfiliadoForm["desconto_duracao"],
    janela_atribuicao_dias: Number(af.janela_atribuicao_dias),
    observacoes: (af.observacoes as string | null) ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/afiliados"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Afiliados
      </Link>

      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {af.nome as string}
        </h1>
      </header>

      <div className="rounded-xl border bg-white p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Link de divulgação
        </p>
        <CopyLink codigo={af.codigo_unico as string} />
        <div className="mt-4 flex gap-6 text-sm">
          <span>
            <strong>{cliques ?? 0}</strong> cliques
          </span>
          <span>
            <strong>{cadastros ?? 0}</strong> cadastros
          </span>
          <span className="text-muted-foreground">pagantes/comissão: Fase 2 (Stripe)</span>
        </div>
      </div>

      <AfiliadoFormulario inicial={inicial} />
    </div>
  );
}
