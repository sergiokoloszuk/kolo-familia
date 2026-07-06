import { requireAdmin } from "@/lib/auth/require-admin";
import { ONBOARDING_COPY_DEFAULT } from "@/lib/onboarding/copy-default";
import { OnboardingExperiencia } from "./preview";

/**
 * Admin → Onboarding. Fatia 1: PREVIEW interativo do onboarding conversacional
 * novo (Ideia 2), pra Karina ver e sentir antes de a gente ligar no cadastro
 * real. Próximas fatias: copy no banco (rascunho/publicado) + chat de IA que
 * ajusta o texto + botão Publicar + trocar o /onboarding real por este fluxo.
 */
export const dynamic = "force-dynamic";

export default async function AdminOnboardingPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl text-foreground">Onboarding</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Prévia do novo cadastro conversacional — a Ayla conduz, quase tudo é toque, e começa pela
          criança. Clique pelos passos como uma mãe faria. É só demonstração (não salva nada).
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
