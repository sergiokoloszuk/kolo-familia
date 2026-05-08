import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchReportData, type Destinatario, type JanelaMeses } from "@/lib/relatorio/data";
import { gerarNarrativa } from "@/lib/relatorio/narrativa";
import { ReportRender } from "@/components/relatorio/render";

export const metadata = {
  title: "Relatório — Kolo Família",
  robots: "noindex, nofollow",
};

export default async function LinkVivoPublicoPage(props: PageProps<"/r/[token]">) {
  const { token } = await props.params;

  // Service role: rota pública sem sessão de usuário, mas cada acesso ao
  // recurso é validado via token + RLS bypass intencional.
  const admin = createServiceRoleClient();

  const { data: link } = await admin
    .from("links_vivos")
    .select(
      "id, family_account_id, membro_atipico_id, destinatario, destinatario_nome, expira_em, revogado, inclui_camada_b, inclui_dass21, acessos",
    )
    .eq("token", token)
    .maybeSingle();

  if (!link) {
    return <NaoEncontrado motivo="Link não existe ou expirou." />;
  }
  if (link.revogado) {
    return <NaoEncontrado motivo="Este link foi revogado pelo responsável." />;
  }
  if (link.expira_em && new Date(link.expira_em as string) < new Date()) {
    return <NaoEncontrado motivo="Este link expirou." />;
  }

  // Auditoria — registra IP/user-agent + timestamp em links_vivos.acessos
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent") ?? null;
  const acessos = Array.isArray(link.acessos) ? link.acessos : [];
  acessos.push({
    em: new Date().toISOString(),
    ip,
    user_agent: userAgent?.slice(0, 200),
  });
  // Mantém os últimos 200 pra não inflar o JSONB
  const acessosTrim = acessos.slice(-200);
  await admin
    .from("links_vivos")
    .update({ acessos: acessosTrim })
    .eq("id", link.id);

  // Carrega dados frescos (live) — não usa snapshot
  const reportData = await fetchReportData(admin, {
    membroAtipicoId: link.membro_atipico_id as string,
    destinatario: link.destinatario as Destinatario,
    janelaMeses: 3 as JanelaMeses,
    includeCamadaB: link.inclui_camada_b as boolean,
    includeDass21: link.inclui_dass21 as boolean,
  });

  if (!reportData) {
    return <NaoEncontrado motivo="Dados base do relatório não puderam ser carregados." />;
  }

  const narrativa = await gerarNarrativa(reportData);

  return (
    <main className="mx-auto max-w-3xl bg-background p-6">
      <div className="mb-4 rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        Compartilhado com <strong>{link.destinatario_nome}</strong> · Atualizado em{" "}
        {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · Conteúdo
        gerado a partir de registros voluntários da família. Não é diagnóstico.
      </div>

      <ReportRender data={reportData} narrativa={narrativa} variante="live" />

      <footer className="mt-8 border-t pt-3 text-xs text-muted-foreground">
        Kolo Família · Este link foi compartilhado pela família e pode ser revogado a
        qualquer momento. Quem diagnostica é profissional de saúde.
      </footer>
    </main>
  );
}

function NaoEncontrado({ motivo }: { motivo: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-xl font-semibold">Acesso indisponível</h1>
      <p className="mt-2 text-sm text-muted-foreground">{motivo}</p>
      <p className="mt-4 text-xs text-muted-foreground">
        Se você precisa do conteúdo, peça à família que gere um novo link.
      </p>
    </main>
  );
}
