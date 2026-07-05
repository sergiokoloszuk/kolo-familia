import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarCrmLeads } from "@/lib/crm/lista";
import { Bloco, Vazio } from "@/components/dashboard/blocos";

/**
 * Dashboard 4 — CRM. Hub dos leads em abordagem: quem está sendo trabalhado,
 * status e próximo passo. A agência vê (leitura); só admin compõe/envia no
 * copiloto. Versão básica — o radar "precisa de você" vem na Fase C.
 */
export const dynamic = "force-dynamic";

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CrmPage() {
  const leads = await carregarCrmLeads(createServiceRoleClient());

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        Leads em abordagem — quem está sendo trabalhado, status e próximo passo.
      </p>

      <Bloco titulo="Em abordagem" desc="Cada lead que já recebeu uma abordagem sua. Clique pra abrir o copiloto.">
        {leads.length === 0 ? (
          <Vazio texto="Ninguém em abordagem ainda. Comece por um lead no funil → ficha → Preparar abordagem." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Lead</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Última mensagem</th>
                  <th className="px-3 py-2 font-medium">Próximo passo</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.familyId} className="border-t border-foreground/[0.06]">
                    <td className="py-2 pr-3 text-foreground">{l.nome}</td>
                    <td className="px-3 py-2">
                      {l.aguardandoResposta ? (
                        <span className="rounded-full bg-brand-yellow/30 px-2 py-0.5 text-xs font-medium text-brand-purple-dark">
                          ⏳ Aguardando você
                        </span>
                      ) : l.ultimaDirecao === "recebida" ? (
                        <span className="text-muted-foreground">Respondeu</span>
                      ) : (
                        <span className="text-muted-foreground">Abordado</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {l.ultimaMensagemEm ? dataHora(l.ultimaMensagemEm) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {l.proximoPassoEm ? (
                        <>
                          {dataHora(l.proximoPassoEm)}
                          {l.proximoPassoNota ? ` · ${l.proximoPassoNota}` : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboards/abordagem/${l.familyId}`}
                        className="font-medium text-brand-purple hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>
    </div>
  );
}
