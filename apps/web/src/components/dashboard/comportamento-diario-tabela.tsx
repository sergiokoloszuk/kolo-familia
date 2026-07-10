import type { DiaComportamento } from "@/lib/crm/comportamento-diario";

/**
 * Tabela do comportamento DIA A DIA do teste (canal, web, Ayla, planos).
 * Usada na tela de abordagem e na ficha do lead (drill-down do dashboard).
 */
export function ComportamentoDiarioTabela({ dias }: { dias: DiaComportamento[] }) {
  if (!dias.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Dia</th>
            <th className="px-3 py-2 font-medium">Canal</th>
            <th className="px-3 py-2 font-medium">Web (telas/uso)</th>
            <th className="px-3 py-2 font-medium">Falou c/ Ayla</th>
            <th className="px-3 py-2 font-medium">Ayla escreveu</th>
            <th className="px-3 py-2 font-medium">Planos</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => {
            const canalLabel =
              d.canal === "ambos"
                ? "🖥️+💬 web e WhatsApp"
                : d.canal === "web"
                  ? "🖥️ web"
                  : d.canal === "whatsapp"
                    ? "💬 WhatsApp"
                    : "—";
            return (
              <tr key={d.dia} className="border-t border-foreground/[0.06]">
                <td className="py-2 pr-3 font-medium text-foreground">{d.dia}/7</td>
                <td className={`px-3 py-2 ${d.canal === "nenhum" ? "text-muted-foreground" : "text-foreground"}`}>
                  {canalLabel}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{d.web || "—"}</td>
                <td className="px-3 py-2">
                  {d.pessoaFalou > 0 ? (
                    <span className="font-medium text-emerald-600">✓ {d.pessoaFalou}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{d.aylaFalou || "—"}</td>
                <td className="px-3 py-2">
                  {d.planos > 0 ? (
                    <span className="font-medium text-brand-purple">📄 {d.planos}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
