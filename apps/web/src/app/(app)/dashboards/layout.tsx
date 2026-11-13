import { requireDashboard } from "@/lib/auth/require-dashboard";
import { Eyebrow } from "@/components/brand/eyebrow";
import { DashboardTabs } from "./tabs";

/**
 * Dashboards compartilhados com a equipe de tráfego (co-acesso) — e espelhados
 * no admin. Acesso: admin OU quem está em family_acessos (co-acesso, gerenciado
 * só pelo admin). Tudo agregado e ANÔNIMO — sem nome nem conteúdo de criança.
 * Dois recortes: Aquisição (funil) e Comportamento (uso).
 */
export const dynamic = "force-dynamic";

export default async function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A mesma guarda roda em cada página — o layout sozinho não protege dados
  // (ver lib/auth/require-dashboard.ts).
  await requireDashboard();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Equipe de tráfego</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">Dashboards</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Visão agregada e anônima — sem nome ou conteúdo de criança. Telas e features enchem
          com o uso; o resto é histórico (90 dias).
        </p>
      </header>

      <DashboardTabs />

      {children}
    </div>
  );
}
