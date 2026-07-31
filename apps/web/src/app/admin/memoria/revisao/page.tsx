import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { casosEmDuvida, filaDeRevisao } from "@/lib/memoria-viva/revisao";
import { Fila } from "./fila";

/**
 * A ÚNICA tela da revisão da Memória Viva.
 *
 * Não há página por caso, rota por identificador nem entidade de alerta: o caso
 * É o fato em quarentena, e a fila é uma consulta. Um alerta seria espelho de
 * um estado que já existe — e espelho dessincroniza.
 *
 * O link do WhatsApp aponta para cá. `requireAdmin()` cuida de quem não pode
 * entrar.
 */
export const dynamic = "force-dynamic";

export default async function RevisaoMemoriaPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();

  const [casos, duvidas] = await Promise.all([
    filaDeRevisao(admin),
    casosEmDuvida(admin),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Revisão da Memória</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Estes são os casos em que o sistema ficou em dúvida e preferiu não
          decidir sozinho. Nenhum deles está sendo usado pela Ayla.
        </p>
      </header>

      <Fila casos={casos} />

      {duvidas.length > 0 ? (
        <section className="mt-10 border-t border-neutral-200 pt-6">
          <h2 className="text-base font-medium text-neutral-900">
            Marcados como “não sei dizer”
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {duvidas.length} caso{duvidas.length > 1 ? "s" : ""} que você já olhou e deixou
            para depois. Continuam isolados e aparecem no resumo de sexta.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-neutral-700">
            {duvidas.map((c) => (
              <li key={c.id}>
                · {c.afirmacao.slice(0, 90)}
                {c.afirmacao.length > 90 ? "…" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
