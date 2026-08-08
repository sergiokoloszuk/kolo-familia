import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarComportamento, FUNIL_ASSINATURA } from "@/lib/analytics/dashboard";
import { carregarJornadaTrial, type FamiliaSegmento } from "@/lib/analytics/jornada";
import { carregarFichaFamilia } from "@/lib/analytics/ficha";
import { carregarComportamentoDiario } from "@/lib/crm/comportamento-diario";
import { Bloco, BarList, Stat, Vazio } from "@/components/dashboard/blocos";
import { ComportamentoDiarioTabela } from "@/components/dashboard/comportamento-diario-tabela";

/**
 * Dashboard 1 — Aquisição & Jornada. Números de topo + a jornada de trial (fase
 * por fase, origem, campanha, dor, leads). Anônimo. Comportamento/uso é a outra
 * aba. Os testes internos aparecem marcados "interno" (fora das contagens).
 */
export const dynamic = "force-dynamic";

const SEGMENTOS: Record<
  string,
  { label: string; desc?: string; pred: (f: FamiliaSegmento) => boolean }
> = {
  cadastrou: { label: "Cadastrou", pred: () => true },
  ativou_teste: { label: "Ativou o teste", pred: (f) => f.ativou },
  ativado: { label: "Ativado", pred: (f) => f.ativado },
  engajado: { label: "Engajado", pred: (f) => f.engajado },
  convertido: { label: "Converteu", pred: (f) => f.fase === "convertido" },
  em_risco: { label: "Em risco (parou 24h+)", pred: (f) => f.fase === "em_risco" },
  expirado: { label: "Expiraram sem assinar", pred: (f) => f.fase === "expirado" },
  clicou_assinar: {
    label: "Clicaram em assinar",
    desc: "Chegaram a abrir o checkout. Quem clicou e não pagou é a lista mais quente pra abordar — a intenção já foi declarada.",
    pred: (f) => f.cliquesAssinar > 0,
  },
  pagou: {
    label: "Assinantes",
    desc: "Quem está pagando agora (status active).",
    pred: (f) => f.assinaturaStatus === "active",
  },
};

/** Segmentos que ganham colunas próprias na tabela (o que importa em cada um). */
const SEG_CHECKOUT = "clicou_assinar";
const SEG_PAGOU = "pagou";

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

  // O card de "clicaram assinar" conta pela MESMA fonte do drill-down (as
  // famílias da jornada), senão o número do topo e a lista discordariam.
  const clicaramAssinar = j.todasFamilias.filter((f) => f.cliquesAssinar > 0);
  const clicaramSemPagar = clicaramAssinar.filter((f) => f.assinaturaStatus !== "active").length;

  // Ficha "o que já fez" de uma família (Fase 2). Admin vê conteúdo; agência
  // co-acesso vê só os sinais.
  const famId = typeof sp.fam === "string" ? sp.fam : null;
  // Os dados comerciais da ficha (assinatura, cliques em assinar) vêm da mesma
  // fonte da tabela — assim ficha e lista nunca contam histórias diferentes.
  const famSeg = famId ? j.todasFamilias.find((f) => f.id === famId) ?? null : null;
  const voltarHref = segAtivo ? `/dashboards?seg=${segAtivo}` : "/dashboards";
  const [ficha, ehAdminView, comportamento] = famId
    ? await Promise.all([
        carregarFichaFamilia(admin, famId),
        ehAdmin(),
        carregarComportamentoDiario(admin, famId),
      ])
    : ([null, false, []] as const);

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        Os números de aquisição e a jornada de cada família no teste de 7 dias.
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Famílias" value={d.totalFamilias} />
        <Stat label="Ativas 7 dias" value={d.ativas7} sub={`${d.ativas30} em 30 dias`} />
        <Stat
          label="Clicaram assinar (90d)"
          value={clicaramAssinar.length}
          sub={
            clicaramSemPagar > 0
              ? `${clicaramSemPagar} clicaram e não pagaram`
              : "abriram o checkout"
          }
          href={segAtivo === SEG_CHECKOUT ? "/dashboards" : `/dashboards?seg=${SEG_CHECKOUT}`}
          ativo={segAtivo === SEG_CHECKOUT}
        />
        <Stat
          label="Conversão trial→pago"
          value={`${conversao}%`}
          sub={`${assinantes} assinantes`}
          href={segAtivo === SEG_PAGOU ? "/dashboards" : `/dashboards?seg=${SEG_PAGOU}`}
          ativo={segAtivo === SEG_PAGOU}
        />
      </section>

      {/* Funil de assinatura (status) */}
      <Bloco
        titulo="Funil de assinatura"
        desc="Distribuição das famílias. O trial não expira sozinho no banco: quem passou da data aparece em “trial vencido”, não em “trialing”."
      >
        <div className="flex flex-wrap gap-3">
          {FUNIL_ASSINATURA.map(({ chave, rotulo, definicao }) => (
            <div key={chave} className="rounded-xl border border-foreground/[0.08] bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
              <p className="font-heading text-2xl text-foreground">{d.statusCount[chave] ?? 0}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{definicao}</p>
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

      {/* Sub-funil do onboarding — abre a caixa-preta do "Cadastrou" */}
      <Bloco
        titulo="Onboarding — onde as pessoas param"
        desc={`O 'Cadastrou' aberto passo a passo. A queda de uma barra pra próxima é o abandono naquela tela. Considera só cadastros a partir de ${j.onboardingDesde}.`}
      >
        <ul className="flex flex-col gap-2">
          {j.onboardingFunil.map((e, i) => {
            const total = j.onboardingFunil[0]?.n || 0;
            const p = total > 0 ? Math.round((e.n / total) * 100) : 0;
            const anterior = i > 0 ? j.onboardingFunil[i - 1].n : e.n;
            const perdaN = Math.max(0, anterior - e.n);
            const perdaP = anterior > 0 ? Math.round((perdaN / anterior) * 100) : 0;
            return (
              <li key={e.label} className="rounded-xl border border-foreground/[0.08] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-base text-foreground">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{e.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-xl text-foreground">{e.n}</p>
                    <p className="text-xs text-muted-foreground">{p}%</p>
                  </div>
                </div>
                <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                  <span className="block h-full rounded-full bg-brand-purple" style={{ width: `${p}%` }} />
                </span>
                {i > 0 && perdaN > 0 && (
                  <p className="mt-1.5 text-xs text-destructive">
                    ↓ perdeu {perdaN} aqui ({perdaP}% dos que tinham chegado)
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Dica: a maior queda mostra a tela a melhorar. Clique em “Cadastrou” acima pra ver, lead a lead, em qual tela cada um parou.
        </p>
      </Bloco>

      {segDef && (
        <Bloco
          titulo={`Quem está em: ${segDef.label}`}
          desc={`${familiasSeg.length} família(s). ${segDef.desc ?? "Nome da mãe (ou e-mail quando ainda sem nome)."}`}
        >
          <div className="mb-3">
            <Link href="/dashboards" className="text-sm font-medium text-brand-purple hover:underline">
              ← Voltar para a visão geral
            </Link>
          </div>
          {segAtivo === SEG_CHECKOUT && familiasSeg.length > 0 && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
              <strong>{clicaramSemPagar}</strong> de {familiasSeg.length} abriram o checkout e não
              concluíram. Elas já disseram que queriam — vale entender o que travou.
            </p>
          )}
          {familiasSeg.length === 0 ? (
            <Vazio texto="Ninguém neste segmento agora." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Dia</th>
                    {segAtivo === "cadastrou" && <th className="px-3 py-2 font-medium">Parou em</th>}
                    {segAtivo === SEG_CHECKOUT && (
                      <>
                        <th className="px-3 py-2 font-medium">Clicou em</th>
                        <th className="px-3 py-2 font-medium">Tentativas</th>
                        <th className="px-3 py-2 font-medium">Pagou?</th>
                      </>
                    )}
                    {segAtivo === SEG_PAGOU && (
                      <>
                        <th className="px-3 py-2 font-medium">Assinou em</th>
                        <th className="px-3 py-2 font-medium">Renova em</th>
                        <th className="px-3 py-2 font-medium">Do clique ao pago</th>
                      </>
                    )}
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
                      {segAtivo === "cadastrou" && (
                        <td className="px-3 py-2 text-foreground">{f.onboardingLabel}</td>
                      )}
                      {segAtivo === SEG_CHECKOUT && (
                        <>
                          <td className="px-3 py-2 text-foreground">
                            {f.ultimoCliqueAssinar ? dataBR(f.ultimoCliqueAssinar) : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {f.cliquesAssinar}
                            {f.cliquesAssinar > 1 && (
                              <span className="ml-1 text-xs text-amber-700">tentou de novo</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {f.assinaturaStatus === "active" ? (
                              <span className="font-medium text-emerald-700">✓ pagou</span>
                            ) : (
                              <span className="font-medium text-destructive">
                                não — {rotuloStatus(f.assinaturaStatus)}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                      {segAtivo === SEG_PAGOU && (
                        <>
                          <td className="px-3 py-2 text-foreground">
                            {f.assinouEm ? dataBR(f.assinouEm) : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {f.renovaEm ? dataBR(f.renovaEm) : "—"}
                            {f.cancelaNoFim && (
                              <span className="ml-1 text-xs text-destructive">cancela no fim</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {diasEntre(f.ultimoCliqueAssinar, f.assinouEm)}
                          </td>
                        </>
                      )}
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
          {comportamento.length > 0 && (
            <div className="mb-5">
              <h4 className="mb-1 font-heading text-sm text-foreground">Comportamento no teste — dia a dia</h4>
              <p className="mb-2 text-xs text-muted-foreground">
                Onde e como se mexeu em cada dia (web, WhatsApp, planos).
              </p>
              <ComportamentoDiarioTabela dias={comportamento} />
            </div>
          )}
          {ficha.membros.length > 0 && (
            <p className="mb-4 text-sm text-muted-foreground">
              {ficha.membros
                .map((m) => `${m.nome} (${m.perfil}${m.idade != null ? `, ${m.idade} anos` : ""})`)
                .join(" · ")}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {famSeg && (
              <FichaCard titulo="💳 Assinatura">
                <ul className="flex flex-col gap-1">
                  <li>
                    <span className="font-medium text-foreground">Situação:</span>{" "}
                    {famSeg.assinaturaStatus === "active"
                      ? "assinante ✓"
                      : rotuloStatus(famSeg.assinaturaStatus)}
                    {famSeg.cancelaNoFim && " · pediu pra cancelar no fim do período"}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Clicou em assinar:</span>{" "}
                    {famSeg.cliquesAssinar === 0
                      ? "nunca abriu o checkout"
                      : `${famSeg.cliquesAssinar}× · última em ${dataBR(famSeg.ultimoCliqueAssinar!)}`}
                  </li>
                  {famSeg.assinouEm && (
                    <li>
                      <span className="font-medium text-foreground">Assinou em:</span>{" "}
                      {dataBR(famSeg.assinouEm)} (
                      {diasEntre(famSeg.ultimoCliqueAssinar, famSeg.assinouEm)} depois do clique)
                    </li>
                  )}
                  {famSeg.renovaEm && (
                    <li>
                      <span className="font-medium text-foreground">Renova em:</span>{" "}
                      {dataBR(famSeg.renovaEm)}
                    </li>
                  )}
                  {famSeg.cliquesAssinar > 0 && famSeg.assinaturaStatus !== "active" && (
                    <li className="text-destructive">
                      Quis assinar e não concluiu — vale entender o que travou.
                    </li>
                  )}
                </ul>
              </FichaCard>
            )}

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

      {/* Leads em trial — ESCONDIDA enquanto um recorte está aberto.
          Uma família em trial no estágio "Cadastrou" satisfaz as duas listas:
          com o drill-down aberto ela aparecia aqui também, e parecia duplicada
          (05/08/2026). Não há duplicidade nenhuma — a auditoria fechou 150
          usuários, 150 famílias, 1:1 em toda tabela relevante. São duas listas
          com propósitos diferentes, e quem abriu um recorte quer ver o recorte.
          Nada aqui muda dado, contagem ou query: só o que fica na tela. */}
      {!segDef && (
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
                  <th className="px-3 py-2 font-medium">Parou em</th>
                  <th className="px-3 py-2 font-medium">WhatsApp</th>
                  <th className="px-3 py-2 font-medium">Falou c/ Ayla</th>
                </tr>
              </thead>
              <tbody>
                {j.leads.map((l) => (
                  <tr key={l.id} className="border-t border-foreground/[0.06]">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/dashboards?fam=${l.id}`}
                        scroll={true}
                        className="font-medium text-brand-purple hover:underline"
                      >
                        {l.nomeMae || l.email || `#${l.id.slice(0, 6)}`}
                      </Link>
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
                    <td className="px-3 py-2">
                      {l.onboardingLabel === "Concluiu" ? (
                        <span className="text-muted-foreground">Concluiu</span>
                      ) : (
                        <span className="font-medium text-destructive">{l.onboardingLabel}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.temWhatsapp ? (
                        <span className="font-medium text-brand-purple">✓ tem</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.falouComAyla ? (
                        <span className="font-medium text-emerald-600">✓ falou</span>
                      ) : (
                        <span className="text-muted-foreground">ainda não</span>
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

/** Status cru da assinatura → o que ele significa pra quem vai abordar. */
function rotuloStatus(status: string | null): string {
  switch (status) {
    case "trialing":
      return "ainda no teste";
    case "past_due":
      return "pagamento falhou";
    case "paused":
      return "pausada";
    case "canceled":
      return "cancelou";
    default:
      return "sem assinatura";
  }
}

/** Quanto tempo levou entre clicar em assinar e virar pagante. */
function diasEntre(de: string | null, ate: string | null): string {
  if (!de || !ate) return "—";
  const ms = new Date(ate).getTime() - new Date(de).getTime();
  if (ms < 0) return "—";
  const horas = Math.round(ms / (60 * 60 * 1000));
  if (horas < 1) return "na hora";
  if (horas < 24) return `${horas}h`;
  return `${Math.round(horas / 24)} dia(s)`;
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
