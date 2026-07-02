import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  carregarJornadaAdmin,
  type FaseTrial,
  type JornadaAdminFamilia,
} from "@/lib/analytics/jornada";

/**
 * Jornada do Trial — ADMIN (com nomes + contato). Espelha a versão anônima da
 * agência, mas nominal: pra a Karina agir (mensagem custom no WhatsApp, já
 * preenchida por fase). Só admin (gate no layout /admin).
 */
export const dynamic = "force-dynamic";

/** Fases onde vale a pena mandar mensagem, na ordem de prioridade. */
const ACIONAVEIS: FaseTrial[] = ["oportunidade", "em_risco", "ativou_teste", "cadastrou", "expirado"];

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n;

const dataBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

/** Mensagem sugerida por fase (aprovada com a Karina; adaptada do playbook). */
function mensagemDaFase(fase: FaseTrial, f: JornadaAdminFamilia): string | null {
  const mae = primeiroNome(f.nomeMae === "—" ? "" : f.nomeMae) || "oi";
  const c = f.nomeCrianca ? primeiroNome(f.nomeCrianca) : "seu filho(a)";
  const d = (f.dor ?? "a situação que você me contou").toLowerCase();
  switch (fase) {
    case "cadastrou":
    case "ativou_teste":
      return `Oi, ${mae}! 🌿 Vi que você começou na Kolo, mas ainda não deu pra experimentar de verdade. Pra sentir se ajuda, comece por uma situação real com ${c} — ${d}. Me conta como costuma acontecer que a gente monta uma primeira orientação juntas.`;
    case "em_risco":
      return `Oi, ${mae}! Faz uns dias que não te vejo por aqui 🌿 Se ainda tem algo pegando com ${c} — ${d} —, me chama que a gente pensa um próximo passo. Tô aqui.`;
    case "oportunidade":
      return `Oi, ${mae}! Seu teste da Kolo está chegando ao fim. Se ela te ajudou com ${c} — ${d} —, dá pra manter o acesso e seguir. Quer que eu te mande o link pra continuar?`;
    case "expirado":
      return `Oi, ${mae}! Seu teste encerrou 🌿 Se nesses dias a Kolo te ajudou a pensar melhor sobre ${d}, você ainda pode continuar e manter o apoio. Quer que eu te mande o link pra reativar?`;
    default:
      return null;
  }
}

function waLink(whatsapp: string | null, msg: string | null): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (!digits) return null;
  const q = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/${digits}${q}`;
}

export default async function AdminJornadaPage() {
  const d = await carregarJornadaAdmin(createServiceRoleClient());

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-heading text-2xl text-foreground">Jornada do Trial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Em que fase cada família está — com nome e contato, pra você mandar uma mensagem
          personalizada. (A agência vê a versão anônima disto.)
        </p>
      </header>

      {/* Funil resumido */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {d.funil.map((f) => (
          <div key={f.key} className="rounded-2xl border border-foreground/[0.08] bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</p>
            <p className="font-heading text-2xl text-foreground">{f.n}</p>
            <p className="text-[11px] text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Fases acionáveis com nomes + WhatsApp */}
      {ACIONAVEIS.map((fase) => {
        const familias = d.porFase[fase] ?? [];
        if (familias.length === 0) return null;
        return (
          <section key={fase} className="flex flex-col gap-3">
            <div>
              <h2 className="font-heading text-lg text-foreground">
                {d.funil.find((x) => x.key === fase)?.label} · {familias.length}
              </h2>
              <p className="text-xs text-muted-foreground">
                {d.funil.find((x) => x.key === fase)?.desc}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Mãe · criança</th>
                    <th className="px-3 py-2 font-medium">Criado</th>
                    <th className="px-3 py-2 font-medium">Dia</th>
                    <th className="px-3 py-2 font-medium">Origem</th>
                    <th className="px-3 py-2 font-medium">Dor</th>
                    <th className="px-3 py-2 font-medium">Último uso</th>
                    <th className="px-3 py-2 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {familias.map((f) => {
                    const link = waLink(f.whatsapp, mensagemDaFase(fase, f));
                    return (
                      <tr key={f.id} className="border-t border-foreground/[0.06]">
                        <td className="py-2 pr-3 text-foreground">
                          {f.nomeMae}
                          {f.nomeCrianca && (
                            <span className="text-muted-foreground"> · {f.nomeCrianca}</span>
                          )}
                          {f.interno && (
                            <span className="ml-1 rounded bg-brand-yellow/30 px-1 text-[10px] font-medium text-brand-purple-dark">
                              interno
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{dataBR(f.criadoEm)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.diaTrial}/7</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {f.origemCanal}
                          {(f.campanha || f.criativo) && (
                            <span className="block text-[11px] text-foreground/50">
                              {[f.campanha, f.criativo].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{f.dor ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {f.ultimoUsoDias == null
                            ? "nunca"
                            : f.ultimoUsoDias === 0
                              ? "hoje"
                              : `há ${f.ultimoUsoDias}d`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white hover:brightness-95"
                            >
                              Abrir no WhatsApp
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">sem WhatsApp</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
