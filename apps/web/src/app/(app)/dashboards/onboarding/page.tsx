import { ONBOARDING_COPY_DEFAULT } from "@/lib/onboarding/copy-default";
import { OnboardingExperiencia } from "./preview";

/**
 * Dashboards → Onboarding. Preview interativo do cadastro conversacional novo
 * (Ideia 2), pra admin E agência (co-acesso) verem e sentirem antes de a gente
 * ligar no cadastro real. O acesso (admin OU analista) é garantido pelo layout
 * dos dashboards. É só simulação — não salva nada.
 */
export const dynamic = "force-dynamic";

export default function DashboardsOnboardingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl text-foreground">Onboarding (prévia)</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          O novo cadastro conversacional — a Ayla conduz, quase tudo é toque, e começa pela pessoa
          que a família cuida. Clique pelos passos como uma mãe faria. É só demonstração (não salva
          nada; não altera nenhum dado).
        </p>
      </div>

      <div className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-foreground">
        <strong>Em construção (Fatia 1 de 4).</strong> Aqui você já <em>vê</em> o fluxo. A seguir vem:
        editar a copy por um chat de IA com esta prévia atualizando ao vivo, um botão “Publicar”, e
        por fim trocar o cadastro real por este fluxo.
      </div>

      <OnboardingExperiencia copy={ONBOARDING_COPY_DEFAULT} />
    </div>
  );
}
