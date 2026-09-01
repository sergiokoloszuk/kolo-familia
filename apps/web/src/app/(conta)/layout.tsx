import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { loadFamilyContext } from "@/lib/auth/require-user";

/**
 * A ÁREA DE CONTA — autenticada, e SÓ isso.
 *
 * ── a regra que este arquivo existe para carregar ─────────────────────────
 *
 * **Ter uma conta não é ter acesso ao produto.** Uma pessoa autenticada
 * precisa sempre conseguir cuidar do próprio cadastro — e-mail, senha,
 * assinatura, sair — mesmo com o teste vencido e sem ter pago. Isso nunca
 * concede a Ayla, o Plano, a Rotina ou qualquer dado da criança.
 *
 * ── o que mudou, e por que era grave ──────────────────────────────────────
 *
 * Até 01/09/2026, `configuracoes/conta` e `assinatura` viviam dentro de
 * `(app)`, cujo layout devolve o `TrialGate` quando `assinaturaLiberada` é
 * falso. Consequência medida no código: uma família com teste vencido **não
 * alcançava o próprio e-mail, a própria senha, nem a página de assinatura** —
 * e o `TrialGate` não tem um único `href` nem botão de sair, então ela também
 * **não conseguia sair da conta**. Ficava numa tela com dois botões de
 * checkout e nenhuma porta.
 *
 * Grupo de rota não aparece na URL: `/configuracoes/conta` e `/assinatura`
 * continuam exatamente onde estavam. Nenhum link da Ayla quebra, e a allowlist
 * de `destino-link.ts` já os permitia.
 *
 * ── o que este layout deliberadamente NÃO faz ─────────────────────────────
 *
 * 1. **Não chama `assinaturaLiberada`.** É o ponto inteiro.
 * 2. **Não monta a `Sidebar`.** Ela lista crianças, planos e as rotas do
 *    produto — exatamente o que não pode aparecer para quem está sem acesso.
 *    Sem isto, a área de conta viraria uma vitrine do que a família perdeu, e
 *    um vazamento de nome e idade de criança para uma sessão sem entitlement.
 *
 * O que continua protegendo o produto não se move: o gate de rota em
 * `(app)/layout.tsx` e o `requireActiveWrite` de cada ação de produto.
 */
export default async function ContaLayout({ children }: { children: ReactNode }) {
  // Autenticação e família: as MESMAS exigências de `(app)`, menos o
  // entitlement. Quem não terminou o onboarding não tem conta para cuidar
  // ainda — vai terminar o cadastro, como já ia.
  const { family } = await loadFamilyContext();
  if (!family) redirect("/onboarding");
  if (!family.onboarding_completed) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-kolo-page">
      <header className="border-b border-kolo-linha bg-background">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-6">
          <Logo tone="light" size={24} />
          {/* Sem link para o produto: para quem está sem acesso, ele levaria
              ao paywall. O caminho de volta é o botão "Voltar para a Kolo" na
              própria página, que só aparece quando faz sentido. */}
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
