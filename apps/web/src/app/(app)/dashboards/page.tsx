import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarComportamento } from "@/lib/analytics/dashboard";
import { carregarJornadaTrial, type FamiliaSegmento } from "@/lib/analytics/jornada";
import { carregarFichaFamilia } from "@/lib/analytics/ficha";
import { Bloco, BarList, Stat, Vazio } from "@/components/dashboard/blocos";

/**
 * Dashboard 1 — Aquisição & Jornada. Números de topo + a jornada de trial (fase
 * por fase, origem, campanha, dor, leads). Anônimo. Comportamento/uso é a outra
 * aba. Os testes internos aparecem marcados "interno" (fora das contagens).
 */
export const dynamic = "force-dynamic";

const SEGMENTOS: Record<string, { label: string; pred: (f: FamiliaSegmento) => boolean }> = {
  cadastrou: { label: "Cadastrou", pred: () => true },
  ativou_teste: { label: "Ativou o teste", pred: (f) => f.ativou },
  ativado: { label: "Ativado", pred: (f) => f.ativado },
  engajado: { label: "Engajado", pred: (f) => f.engajado },
  convertido: { label: "Converteu", pred: (f) => f.fase === "convertido" },
  em_risco: { label: "Em risco (parou 24h+)", pred: (f) => f.fase === "em_risco" },
  expirado: { label: "Expiraram sem assinar", pred: (f) => f.fase === "expirado" },
};

export default async function AquisicaoJornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ seg?: string; fam?: string }>;
}) {
  const admin = createServiceRoleClient();
  const [d, j] = await Promise.all([carregarComportamento(admin), carregarJornadaTrial(admin)]);
  const assinantes = d.statusCount.active ?? 0;
  const conversao = d.totalFamilias > 0 ? Math.round((assinantes / d.totalFamilias) * 100) : 0;
  const base = j.funil[0]?.n || 0;
  const pct = (n: number) => (base > 0 ? Math.round((n / base) * 100) : 0);

  const sp = await searchParams;
  const segDef = sp.seg ? SEGMENTOS[sp.seg] : undefined;
  const segAtivo = segDef ? sp.seg : null;
  const familiasSeg = segDef ? j.todasFamilias.filter(segDef.pred) : [];

  // Ficha "o que já fez" de uma família (Fase 2). Admin vê conteúdo; agência
  // co-acesso vê só os sinais.
  const famId = typeof sp.fam === "string" ? sp.fam : null;
  const voltarHref = segAtivo ? `/dashboards?seg=${segAtivo}` : "/dashboards";
  const [ficha, ehAdminView] = famId
    ? await Promise.all([carregarFichaFamilia(admin, famId), ehAdmin()])
    : ([null, false] as const);

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        Os números de aquisição e a jornada de cada família no teste de 7 dias.
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Famílias" value={d.totalFamilias} />
        <Stat label="Ativas 7 dias" value={d.ativas7} sub={`${d.ativas30} em 30 dias`} />
        <Stat label="Clicaram assinar (30d)" value={d.checkoutFamilias} sub="checkout_iniciado" />
        <Stat label="Conversão trial→pago" value={`${conversao}%`} sub={`${assinantes} assinantes`} />
      </section>

      {/* Funil de assinatura (status) */}
      <Bloco titulo="Funil de assinatura" desc="Distribuição de status das famílias.">
        <div className="flex flex-wrap gap-3">
          {(["trialing", "active", "past_due", "paused", "canceled"] as const).map((st) => (
            <div key={st} className="rounded-xl border border-foreground/[0.08] bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{st}</p>
              <p className="font-heading text-2xl text-foreground">{d.statusCount[st] ?? 0}</p>
            </div>
          ))}
        </div>
      </Bloco>

      {/* Funil por fase da jornada */}
      <Bloco titulo="Funil da jornada" desc="Cada etapa é um subconjunto da anterior. % sobre quem cadastrou.">
        <ul className="flex flex-col gap-2">
          {j.funil.map((f) => {
            const ativo = segAtivo === f.key;
            return (
              <li key={f.key}>
                <Link
                  href={ativo ? "/dashboards" : `/dashboards?seg=${f.key}`}
                  scroll={false}
                  className={`block rounded-xl border px-4 py-3 transition-colors ${
                    ativo
                      ? "border-brand-purple bg-kolo-lilas-bg-2 ring-1 ring-brand-purple"
                      : "border-foreground/[0.08] bg-white hover:border-foreground/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-heading text-lg text-foreground">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-2xl text-foreground">{f.n}</p>
                      <p className="text-xs text-muted-foreground">{pct(f.n)}%</p>
                    </div>
                  </div>
                  <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                    <span
                      className="block h-full rounded-full bg-brand-purple"
                      style={{ width: `${pct(f.n)}%` }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={segAtivo === "em_risco" ? "/dashboards" : "/dashboards?seg=em_risco"}
            scroll={false}
            className={`rounded-full px-3 py-1 text-destructive transition-colors ${
              segAtivo === "em_risco"
                ? "bg-destructive/20 ring-1 ring-destructive"
                : "bg-destructive/10 hover:bg-destructive/20"
            }`}
          >
            ⚠ Em risco (parou 24h+): <strong>{j.emRisco}</strong>
          </Link>
          <Link
            href={segAtivo === "expirado" ? "/dashboards" : "/dashboards?seg=expirado"}
            scroll={false}
            className={`rounded-full px-3 py-1 text-muted-foreground transition-colors ${
              segAtivo === "expirado"
                ? "bg-foreground/[0.12] ring-1 ring-foreground/30"
                : "bg-foreground/[0.05] hover:bg-foreground/[0.1]"
            }`}
          >
            ✗ Expiraram sem assinar: <strong>{j.expirados}</strong>
          </Link>
        </div>
      </Bloco>

      {segDef && (
        <Bloco
          titulo={`Quem está em: ${segDef.label}`}
          desc={`${familiasSeg.length} família(s). Nome da mãe (ou e-mail quando ainda sem nome).`}
        >
          <div className="mb-3">
            <Link href="/dashboards" className="text-sm font-medium text-brand-purple hover:underline">
              ← limpar seleção
            </Link>
          </div>
          {familiasSeg.length === 0 ? (
            <Vazio texto="Ninguém neste segmento agora." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Dia</th>
                    <th className="px-3 py-2 font-medium">Origem</th>
                    <th className="px-3 py-2 font-medium">Campanha</th>
                    <th className="px-3 py-2 font-medium">Criativo</th>
                    <th className="px-3 py-2 font-medium">Último uso</th>
                    <th className="px-3 py-2 font-medium">Contato</th>
                  </tr>
                </thead>
                <tbody>
                  {familiasSeg.map((f) => (
                    <tr key={f.id} className="border-t border-foreground/[0.06]">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/dashboards?seg=${segAtivo}&fam=${f.id}`}
                          scroll={false}
                          className="font-medium text-brand-purple hover:underline"
                        >
                          {f.nomeMae || f.email || `#${f.id.slice(0, 6)}`}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{f.diaTrial}/7</td>
                      <td className="px-3 py-2 text-foreground">{f.origemCanal}</td>
                      <td className="px-3 py-2 text-muted-foreground">{f.campanha ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{f.criativo ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {f.ultimoUso ? dataBR(f.ultimoUso) : "nunca"}
                      </td>
                      <td className="px-3 py-2">
                        {f.whatsapp ? (
                          <a
                            href={`https://wa.me/${f.whatsapp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-brand-purple hover:underline"
                          >
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloco>
      )}

      {ficha && (
        <Bloco
          titulo={`Ficha — ${ficha.nome}`}
          desc={ehAdminView ? "Tudo que essa família já fez." : "Sinais de uso (visão da agência, sem conteúdo)."}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Link href={voltarHref} scroll={false} className="text-sm font-medium text-brand-purple hover:underline">
              ← voltar à lista
            </Link>
            {ehAdminView && famId && (
              <Link
                href={`/dashboards/abordagem/${famId}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
              >
                🎯 Preparar abordagem
              </Link>
            )}
          </div>
          {ficha.membros.length > 0 && (
            <p className="mb-4 text-sm text-muted-foreground">
              {ficha.membros
                .map((m) => `${m.nome} (${m.perfil}${m.idade != null ? `, ${m.idade} anos` : ""})`)
                .join(" · ")}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FichaCard titulo="💬 Ayla (WhatsApp)">
              {ficha.ayla.mensagens > 0
                ? `${ficha.ayla.mensagens} mensagem(ns) · última em ${dataBR(ficha.ayla.ultima!)}`
                : "Ainda não falou com a Ayla."}
            </FichaCard>

            <FichaCard titulo="🌿 Perfil">
              {ficha.koloVivo.campos.length === 0 ? (
                "Nada preenchido ainda."
              ) : ehAdminView ? (
                <ul className="flex flex-col gap-1">
                  {ficha.koloVivo.conteudo.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium text-foreground">{c.campo}:</span>{" "}
                      {c.texto}
                    </li>
                  ))}
                </ul>
              ) : (
                `${ficha.koloVivo.campos.length} campo(s) preenchido(s).`
              )}
            </FichaCard>

            <FichaCard titulo="✨ Estratégias">
              {ficha.estrategias.total === 0 ? (
                "Nenhuma conversa."
              ) : ehAdminView && ficha.estrategias.titulos.length ? (
                <>
                  {ficha.estrategias.total} conversa(s):
                  <ul className="mt-1 list-disc pl-4">
                    {ficha.estrategias.titulos.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </>
              ) : (
                `${ficha.estrategias.total} conversa(s).`
              )}
            </FichaCard>

            <FichaCard titulo="📄 Planos">
              {ficha.planos.total === 0
                ? "Nenhum plano."
                : ehAdminView && ficha.planos.temas.length
                  ? `${ficha.planos.total} plano(s): ${ficha.planos.temas.join(", ")}`
                  : `${ficha.planos.total} plano(s).`}
            </FichaCard>

            <FichaCard titulo="🎨 Lúdico">
              {ficha.ludico.total === 0
                ? "Não usou."
                : ficha.ludico.porTipo.map((t) => `${t.tipo}: ${t.n}`).join(" · ")}
            </FichaCard>
          </div>

          {ehAdminView && ficha.timeline.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 font-heading text-sm text-foreground">Timeline recente</h4>
              <ul className="flex flex-col gap-1 text-sm">
                {ficha.timeline.map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-foreground">
                      {t.evento}
                      {t.detalhe ? <span className="text-muted-foreground"> · {t.detalhe}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{dataBR(t.quando)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Bloco>
      )}

      {/* Conversão por origem */}
      <Bloco titulo="Conversão por origem" desc="Qual canal traz gente que ativa e assina.">
        {j.porOrigem.length === 0 ? (
          <Vazio texto="Ainda sem leads por origem." />
        ) : (
          <FunilTabela col="Origem" linhas={j.porOrigem} />
        )}
      </Bloco>

      {j.porCampanha.length > 0 && (
        <Bloco titulo="Tráfego pago — por campanha" desc="Qual campanha traz gente que ativa e assina.">
          <FunilTabela col="Campanha" linhas={j.porCampanha} />
        </Bloco>
      )}
      {j.porCriativo.length > 0 && (
        <Bloco titulo="Tráfego pago — por criativo" desc="Qual anúncio converte melhor.">
          <FunilTabela col="Criativo" linhas={j.porCriativo} />
        </Bloco>
      )}

      {/* Dor principal */}
      <Bloco titulo="Dor principal" desc="Os temas de desafio mais frequentes — pra mirar o criativo do anúncio.">
        <BarList items={j.dorRank} />
      </Bloco>

      {/* Leads em trial */}
      <Bloco titulo="Leads em trial" desc="Cada lead, sua origem e a fase atual. Anônimo.">
        {j.leads.length === 0 ? (
          <Vazio texto="Nenhum lead em trial agora." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Lead</th>
                  <th className="px-3 py-2 font-medium">Criado</th>
                  <th className="px-3 py-2 font-medium">Dia</th>
                  <th className="px-3 py-2 font-medium">Origem</th>
                  <th className="px-3 py-2 font-medium">Campanha</th>
                  <th className="px-3 py-2 font-medium">Criativo</th>
                  <th className="px-3 py-2 font-medium">Fase</th>
                </tr>
              </thead>
              <tbody>
                {j.leads.map((l) => (
                  <tr key={l.id} className="border-t border-foreground/[0.06]">
                    <td className="py-2 pr-3 text-foreground">
                      {l.nomeMae || l.email || `#${l.id.slice(0, 6)}`}
                      {l.interno && (
                        <span className="ml-1 rounded bg-brand-yellow/30 px-1 text-[10px] font-medium text-brand-purple-dark">
                          interno
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{dataBR(l.criadoEm)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.diaTrial}/7</td>
                    <td className="px-3 py-2 text-foreground">{l.origemCanal}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.campanha ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.criativo ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground">{j.fases[l.fase].label}</td>
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

function FichaCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-white px-4 py-3 text-sm">
      <p className="mb-1 font-heading text-base text-foreground">{titulo}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function FunilTabela({
  col,
  linhas,
}: {
  col: string;
  linhas: { label: string; cadastrou: number; ativado: number; converteu: number }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{col}</th>
            <th className="px-3 py-2 text-right font-medium">Cadastrou</th>
            <th className="px-3 py-2 text-right font-medium">Ativado</th>
            <th className="px-3 py-2 text-right font-medium">Converteu</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((o) => (
            <tr key={o.label} className="border-t border-foreground/[0.06]">
              <td className="py-2 pr-3 text-foreground">{o.label}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{o.cadastrou}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{o.ativado}</td>
              <td className="px-3 py-2 text-right font-semibold text-foreground">{o.converteu}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
