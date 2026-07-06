import { createServiceRoleClient } from "@/lib/supabase/server";
import { analisarPlanos } from "@/lib/analytics/plano-analise";
import { Bloco, BarList, Vazio } from "@/components/dashboard/blocos";
import { AdminOnly } from "@/components/dashboard/admin-only";

/**
 * Bloco "Planos por área" — carrega numa chamada de IA que categoriza os pedidos
 * de plano (o `tema` é texto cru) e resume os padrões. Fica dentro de um Suspense
 * na página pra não travar o resto. Só admin vê o texto real dos pedidos.
 */
export async function AnalisePlanos({ isAdmin }: { isAdmin: boolean }) {
  const a = await analisarPlanos(createServiceRoleClient());

  return (
    <>
      <Bloco titulo="Planos por área" desc="Sobre o que as famílias pedem plano (a IA classifica o pedido cru numa área).">
        {a.porArea.length ? <BarList items={a.porArea} /> : <Vazio />}
      </Bloco>

      <Bloco titulo="O que estão pedindo" desc="Leitura por IA dos pedidos de plano — os padrões que aparecem.">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{a.resumo}</p>
      </Bloco>

      {isAdmin && a.pedidos.length > 0 && (
        <Bloco
          titulo="Pedidos, como a mãe escreveu"
          desc="O texto real de cada pedido de plano — pra você entender a fundo."
        >
          <div className="mb-3">
            <AdminOnly>Só admin — a agência não vê o texto dos pedidos</AdminOnly>
          </div>
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {a.pedidos.map((p, i) => (
              <li key={i} className="flex flex-col gap-0.5 border-b border-border/50 pb-2 last:border-0">
                <span className="text-sm text-foreground">{p.tema}</span>
                <span className="text-xs text-muted-foreground">
                  {p.nome} · <span className="text-brand-purple">{p.area}</span>
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </>
  );
}
