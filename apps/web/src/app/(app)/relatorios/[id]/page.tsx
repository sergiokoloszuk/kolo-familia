import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { ReportRender } from "@/components/relatorio/render";
import type { ReportData } from "@/lib/relatorio/data";
import { LinkVivoActions } from "./link-vivo-actions";
import { ApagarRelatorioButton } from "./apagar-button";

export default async function RelatorioDetailPage(props: PageProps<"/relatorios/[id]">) {
  const { id } = await props.params;
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: rel } = await supabase
    .from("relatorios_gerados")
    .select(
      "id, destinatario, snapshot, created_at, membro_atipico_id, inclui_camada_b, inclui_dass21",
    )
    .eq("id", id)
    .eq("family_account_id", familyId)
    .maybeSingle();

  if (!rel) notFound();

  const snapshot = rel.snapshot as { report: ReportData; narrativa: string[] } | null;
  if (!snapshot) notFound();

  const { data: links } = await supabase
    .from("links_vivos")
    .select(
      "id, destinatario_nome, token, expira_em, revogado, revogado_em, acessos, created_at",
    )
    .eq("family_account_id", familyId)
    .eq("membro_atipico_id", rel.membro_atipico_id)
    .eq("destinatario", rel.destinatario)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/relatorios"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Relatórios
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Relatório · {snapshot.report.membro.nome}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/relatorios/${rel.id}/imprimir`}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Printer aria-hidden="true" className="size-3.5" /> Imprimir / PDF
            </Link>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link vivo</CardTitle>
          <CardDescription>
            Compartilhe um link único com {rel.destinatario}. Você pode revogar a
            qualquer momento e ver o histórico de acessos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinkVivoActions
            relatorioId={rel.id}
            destinatarioPadrao={rel.destinatario}
            linksExistentes={(links ?? []).map((l) => ({
              id: l.id,
              destinatario_nome: l.destinatario_nome,
              token: l.token,
              expira_em: l.expira_em as string | null,
              revogado: l.revogado as boolean,
              revogado_em: l.revogado_em as string | null,
              acessos: Array.isArray(l.acessos) ? l.acessos.length : 0,
              created_at: l.created_at as string,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pré-visualização (snapshot)</CardTitle>
          <CardDescription>
            Esta é a versão congelada no momento da geração. O link vivo busca os
            dados atualizados a cada visita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-background p-4">
            <ReportRender
              data={snapshot.report}
              narrativa={snapshot.narrativa}
              variante="preview"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <ApagarRelatorioButton id={rel.id} />
      </div>
    </div>
  );
}
