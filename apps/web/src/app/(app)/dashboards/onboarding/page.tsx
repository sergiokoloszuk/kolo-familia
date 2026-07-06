import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarCopy } from "@/lib/onboarding/copy-store";
import { lerModo } from "@/lib/onboarding/modo";
import { OnboardingExperiencia } from "./preview";
import { OnboardingEditor } from "./editor";

/**
 * Dashboards → Onboarding. A experiência inicial do lead (cadastro conversacional
 * + passeio + começar por um desafio). Admin vê o EDITOR (chat de IA + preview ao
 * vivo + publicar); agência (co-acesso) vê só a prévia. Acesso garantido pelo
 * layout dos dashboards (admin OU analista). Copy vem do rascunho no banco (ou do
 * default, se a migração 0059 ainda não foi aplicada).
 */
export const dynamic = "force-dynamic";

export default async function DashboardsOnboardingPage() {
  const admin = createServiceRoleClient();
  const [copy, isAdmin, modo] = await Promise.all([
    carregarCopy(admin),
    ehAdmin(),
    lerModo(admin),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl text-foreground">Experiência inicial do lead</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Tudo o que uma família nova vive no começo: o cadastro conversacional (a Ayla conduz, quase
          tudo é toque) e, no fim, os dois caminhos — <strong>conhecer o app</strong> (passeio narrado)
          ou <strong>começar por um desafio</strong>.
          {isAdmin
            ? " Ajuste a copy pelo chat ao lado; a prévia atualiza na hora. Publique quando gostar."
            : " Clique como uma mãe faria — é uma demonstração, não altera nenhum dado."}
        </p>
      </div>

      {isAdmin ? (
        <OnboardingEditor initialCopy={copy} modoInicial={modo} />
      ) : (
        <OnboardingExperiencia copy={copy} />
      )}
    </div>
  );
}
