import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarContextoLead } from "@/lib/crm/contexto";
import { carregarComportamentoDiario } from "@/lib/crm/comportamento-diario";
import { ComportamentoDiarioTabela } from "@/components/dashboard/comportamento-diario-tabela";
import { carregarFaseScripts, faseDoLead, FASE_LABEL } from "@/lib/crm/fase-scripts";
import { Copiloto } from "./copiloto";
import { EstadoAbordagem } from "./estado";

export const dynamic = "force-dynamic";

export default async function AbordagemPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  if (!(await ehAdmin())) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/dashboards" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Dashboards
        </Link>
        <p className="rounded-xl border border-foreground/[0.08] bg-white p-6 text-sm text-muted-foreground">
          A preparação de abordagem é só pra administração. A agência acompanha o CRM em leitura.
        </p>
      </div>
    );
  }

  const admin = createServiceRoleClient();
  const [ctx, { data: crmThread }, { data: crmLead }, fase, scripts, comportamento] = await Promise.all([
    carregarContextoLead(admin, familyId),
    admin
      .from("crm_mensagens")
      .select("direcao, texto, created_at")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: true }),
    admin
      .from("crm_leads")
      .select("em_abordagem, aguardando_resposta")
      .eq("family_account_id", familyId)
      .maybeSingle(),
    faseDoLead(admin, familyId),
    carregarFaseScripts(admin),
    carregarComportamentoDiario(admin, familyId),
  ]);
  const scriptFase = scripts.find((s) => s.fase === fase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboards" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Dashboards
        </Link>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">Abordagem</p>
        <h1 className="mt-1 font-heading text-2xl text-foreground md:text-3xl">
          Preparar abordagem — {ctx.nome}
        </h1>
      </header>

      <EstadoAbordagem
        familyId={familyId}
        emAbordagem={!!crmLead?.em_abordagem}
        aguardando={!!crmLead?.aguardando_resposta}
      />

      {/* Contexto do lead */}
      <section className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
        <h2 className="mb-2 font-heading text-base text-foreground">Quem é esse lead</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{ctx.resumo}</pre>
      </section>

      {/* Comportamento no teste — dia a dia */}
      {comportamento.length > 0 && (
        <section className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
          <h2 className="mb-1 font-heading text-base text-foreground">Comportamento no teste — dia a dia</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Onde e como esse lead se mexeu em cada dia do teste (web, WhatsApp, planos).
          </p>
          <ComportamentoDiarioTabela dias={comportamento} />
        </section>
      )}

      {/* Sugestão da agência pra esta fase (editável em Configuração) */}
      {scriptFase && (
        <section className="rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/50 p-5">
          <h2 className="mb-1 font-heading text-base text-foreground">
            💡 Sugestão da agência — fase: {FASE_LABEL[fase] ?? fase}
          </h2>
          <p className="text-sm text-muted-foreground">
            {scriptFase.textoSugestao || "(sem sugestão pra esta fase — edite em CRM → Configuração)"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Compare com a proposta do copiloto abaixo pra ver se está boa. Ajuste o roteiro em CRM → Configuração.
          </p>
        </section>
      )}

      {/* Suas abordagens (só a sua thread — a conversa da Ayla não aparece aqui) */}
      {crmThread && crmThread.length > 0 && (
        <section className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
          <h2 className="mb-3 font-heading text-base text-foreground">Suas abordagens</h2>
          <ul className="flex flex-col gap-2">
            {crmThread.map((m, i) => {
              const enviada = (m.direcao as string) === "enviada";
              return (
                <li
                  key={i}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    enviada ? "self-end bg-brand-purple text-white" : "self-start bg-foreground/[0.04] text-muted-foreground"
                  }`}
                >
                  <span
                    className={`mb-0.5 block text-[10px] uppercase tracking-wide ${
                      enviada ? "text-white/70" : "text-muted-foreground"
                    }`}
                  >
                    {enviada ? "🙋‍♀️ Você" : "💬 Lead"} ·{" "}
                    {new Date(m.created_at as string).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="whitespace-pre-wrap">{m.texto as string}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Copiloto familyId={familyId} temWhatsapp={!!ctx.whatsapp} />
    </div>
  );
}
