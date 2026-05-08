import { notFound } from "next/navigation";
import { format } from "date-fns";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { ReportRender } from "@/components/relatorio/render";
import type { ReportData } from "@/lib/relatorio/data";
import { PrintControls } from "./print-controls";

export const metadata = {
  title: "Relatório — imprimir",
};

export default async function ImprimirPage(
  props: PageProps<"/relatorios/[id]/imprimir">,
) {
  const { id } = await props.params;
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: rel } = await supabase
    .from("relatorios_gerados")
    .select("snapshot")
    .eq("id", id)
    .eq("family_account_id", familyId)
    .maybeSingle();

  if (!rel) notFound();
  const snapshot = rel.snapshot as { report: ReportData; narrativa: string[] } | null;
  if (!snapshot) notFound();

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PrintControls />

      <div className="print-area">
        <ReportRender
          data={snapshot.report}
          narrativa={snapshot.narrativa}
          variante="print"
        />
        <div className="watermark mt-12 border-t pt-3 text-[10px] text-muted-foreground">
          Kolo Família · Espelho de registros voluntários da família · Gerado em{" "}
          {format(new Date(snapshot.report.geradoEm), "dd/MM/yyyy 'às' HH:mm")} · ID{" "}
          {id.slice(0, 8)}
        </div>
      </div>
    </>
  );
}

const PRINT_CSS = `
@media print {
  [data-app-chrome], .no-print { display: none !important; }
  body { background: white !important; }
  .print-area { max-width: none !important; padding: 0 !important; }
  @page { size: A4; margin: 1.5cm; }
}
`;
