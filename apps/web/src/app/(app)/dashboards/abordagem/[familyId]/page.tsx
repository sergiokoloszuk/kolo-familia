import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarContextoLead } from "@/lib/crm/contexto";
import { carregarTimelineLead } from "@/lib/crm/timeline";
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
  const [ctx, timeline, { data: crmLead }] = await Promise.all([
    carregarContextoLead(admin, familyId),
    carregarTimelineLead(admin, familyId),
    admin
      .from("crm_leads")
      .select("em_abordagem, aguardando_resposta")
      .eq("family_account_id", familyId)
      .maybeSingle(),
  ]);

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

      {/* Linha do tempo unificada: Ayla + Você + Lead */}
      {timeline.length > 0 && (
        <section className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
          <h2 className="mb-1 font-heading text-base text-foreground">Linha do tempo</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Tudo que já rolou com esse lead — 🤖 Ayla, 🙋‍♀️ você, 💬 lead. Não repita o que a Ayla já cobriu.
          </p>
          <ul className="flex flex-col gap-2">
            {timeline.map((m, i) => (
              <li
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.autor === "voce"
                    ? "self-end bg-brand-purple text-white"
                    : m.autor === "ayla"
                      ? "self-start bg-kolo-lilas-bg-2 text-foreground"
                      : "self-start bg-foreground/[0.04] text-muted-foreground"
                }`}
              >
                <span
                  className={`mb-0.5 block text-[10px] uppercase tracking-wide ${
                    m.autor === "voce" ? "text-white/70" : "text-muted-foreground"
                  }`}
                >
                  {m.autor === "ayla" ? "🤖 " : m.autor === "voce" ? "🙋‍♀️ " : "💬 "}
                  {m.rotulo} ·{" "}
                  {new Date(m.quando).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="whitespace-pre-wrap">{m.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Copiloto familyId={familyId} temWhatsapp={!!ctx.whatsapp} />
    </div>
  );
}
