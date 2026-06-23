import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/brand/eyebrow";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AREAS_DIARIO } from "@/lib/ia/classificar-area";
import { capitalizarNome } from "@/lib/nome";

/**
 * Dashboard de COMPORTAMENTO — como as famílias usam o produto. Cruza dados
 * históricos (Kolo Vivo, planos, lúdico, Ayla) com os eventos novos de
 * comportamento (user_events: telas/features). Admin-only, agregado.
 */

export const dynamic = "force-dynamic";

// Domínios do Kolo Vivo (key → label, e onde mora). Espelha kolo-vivo/dominios.
const DOMINIOS: Array<{ key: string; toplevel: boolean; label: string }> = [
  { key: "sensorial", toplevel: true, label: "Sensorial" },
  { key: "essencial", toplevel: true, label: "O essencial" },
  { key: "como_e", toplevel: true, label: "Como é / interesses" },
  { key: "corpo_rotina", toplevel: true, label: "Corpo e rotina" },
  { key: "desafios_regulacao", toplevel: true, label: "Desafios (regulação)" },
  { key: "nutricional", toplevel: false, label: "Alimentação" },
  { key: "comunicacao", toplevel: false, label: "Comunicação" },
  { key: "emocional", toplevel: false, label: "Regulação emocional" },
  { key: "foco", toplevel: false, label: "Foco e atenção" },
  { key: "sono", toplevel: false, label: "Sono" },
  { key: "socializacao", toplevel: false, label: "Socialização" },
  { key: "motor", toplevel: false, label: "Motor" },
  { key: "rotina", toplevel: false, label: "Rotina" },
  { key: "autonomia", toplevel: false, label: "Autonomia" },
  { key: "aprendizado", toplevel: false, label: "Aprendizado" },
  { key: "imitacao", toplevel: false, label: "Imitação" },
  { key: "tela_midia", toplevel: false, label: "Tela e mídia" },
  { key: "escola", toplevel: false, label: "Escola" },
  { key: "saude_geral", toplevel: false, label: "Saúde geral" },
  { key: "gostos", toplevel: false, label: "Gostos" },
];

const MS_DIA = 24 * 60 * 60 * 1000;
function diasAtrasISO(n: number): string {
  return new Date(Date.now() - n * MS_DIA).toISOString();
}
/** Tem algum conteúdo de verdade no jsonb do domínio? */
function temConteudo(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const s = JSON.stringify(v);
  return s.length > 2 && /[a-zA-ZÀ-ÿ0-9]/.test(s); // não é {} nem só pontuação
}

export default async function AdminComportamentoPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();
  const desde90 = diasAtrasISO(90);
  const desde30 = diasAtrasISO(30);
  const desde7 = diasAtrasISO(7);

  const [
    { count: totalFamilias },
    { data: subs },
    { data: perfis },
    { data: diarios },
    { data: planos },
    { data: aylaMsgs },
    { data: conversas },
    { data: rotinas },
    { data: meditacoes },
    { data: desenhos },
    { data: historias },
    { data: events },
    { data: perfisFam },
  ] = await Promise.all([
    admin.from("family_accounts").select("id", { count: "exact", head: true }),
    admin.from("subscription_accesses").select("family_account_id, status, trial_ends_at"),
    admin
      .from("perfil_vivo_membro")
      .select(
        "family_account_id, completude_pct, essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
      ),
    admin
      .from("diarios")
      .select("family_account_id, desafio_area, created_at")
      .gte("created_at", desde90),
    admin.from("planos").select("family_account_id, tema, created_at"),
    admin
      .from("ayla_messages")
      .select("family_account_id, direcao, created_at")
      .gte("created_at", desde90),
    admin.from("conversas").select("family_account_id, created_at").gte("created_at", desde90),
    admin.from("rotinas").select("family_account_id, created_at"),
    admin.from("meditacoes").select("family_account_id, created_at"),
    admin.from("desenhos").select("family_account_id, created_at"),
    admin.from("historias").select("family_account_id, created_at"),
    admin
      .from("user_events")
      .select("family_account_id, evento, detalhe, created_at")
      .gte("created_at", desde90),
    admin.from("family_profiles").select("family_account_id, nome_mae"),
  ]);

  // ── Funil de assinatura ──
  const statusCount: Record<string, number> = {};
  for (const s of subs ?? []) {
    const st = (s.status as string) ?? "—";
    statusCount[st] = (statusCount[st] ?? 0) + 1;
  }
  const checkoutFamilias = new Set(
    (events ?? []).filter((e) => e.evento === "checkout_iniciado").map((e) => e.family_account_id),
  );

  // ── Kolo Vivo: domínios mais preenchidos + completude média ──
  const domPreenchido: Record<string, number> = {};
  let somaCompletude = 0;
  let nPerfis = 0;
  for (const p of perfis ?? []) {
    nPerfis += 1;
    somaCompletude += Number(p.completude_pct) || 0;
    const extras = (p.categorias_extras as Record<string, unknown> | null) ?? {};
    for (const d of DOMINIOS) {
      const val = d.toplevel ? (p as Record<string, unknown>)[d.key] : extras[d.key];
      if (temConteudo(val)) domPreenchido[d.key] = (domPreenchido[d.key] ?? 0) + 1;
    }
  }
  const completudeMedia = nPerfis ? Math.round(somaCompletude / nPerfis) : 0;
  const domRank = DOMINIOS.map((d) => ({ label: d.label, n: domPreenchido[d.key] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  // ── Desafios mais recorrentes (diarios.desafio_area) ──
  const desafioCount: Record<string, number> = {};
  for (const d of diarios ?? []) {
    const a = d.desafio_area as string | null;
    if (a && AREAS_DIARIO[a]) desafioCount[a] = (desafioCount[a] ?? 0) + 1;
  }
  const desafioRank = Object.entries(desafioCount)
    .map(([k, n]) => ({ label: AREAS_DIARIO[k] ?? k, n }))
    .sort((a, b) => b.n - a.n);

  // ── Planos por tema ──
  const planoTema: Record<string, number> = {};
  for (const p of planos ?? []) {
    const t = ((p.tema as string | null) ?? "").trim() || "(sem tema)";
    planoTema[t] = (planoTema[t] ?? 0) + 1;
  }
  const planoRank = Object.entries(planoTema)
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  // ── Lúdico: o que e quanto ──
  const distintas = (rows: { family_account_id: string | null }[] | null) =>
    new Set((rows ?? []).map((r) => r.family_account_id)).size;
  const ludico = [
    { label: "Rotinas", n: (rotinas ?? []).length, fam: distintas(rotinas) },
    { label: "Meditações", n: (meditacoes ?? []).length, fam: distintas(meditacoes) },
    { label: "Desenhos", n: (desenhos ?? []).length, fam: distintas(desenhos) },
    { label: "Histórias", n: (historias ?? []).length, fam: distintas(historias) },
  ].sort((a, b) => b.n - a.n);

  // ── Ayla × Web (agregado) ──
  const aylaInbound = (aylaMsgs ?? []).filter((m) => m.direcao === "inbound").length;
  const webConversas = (conversas ?? []).length;

  // ── Telas mais visitadas + features mais usadas (user_events) ──
  const telaCount: Record<string, number> = {};
  const featureCount: Record<string, number> = {};
  for (const e of events ?? []) {
    if (e.evento === "tela_visitada") {
      const tela = ((e.detalhe as Record<string, unknown>)?.tela as string) ?? "?";
      telaCount[tela] = (telaCount[tela] ?? 0) + 1;
    } else {
      featureCount[e.evento] = (featureCount[e.evento] ?? 0) + 1;
    }
  }
  const telaRank = Object.entries(telaCount).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  const featureRank = Object.entries(featureCount).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);

  // ── Por família: atividade combinada (recência + volumes) ──
  type Fam = {
    id: string;
    nome: string | null;
    ayla: number;
    web: number;
    diarios: number;
    ludico: number;
    planos: number;
    ultima: number; // epoch ms
  };
  const nomePorFam = new Map(
    (perfisFam ?? []).map((p) => [p.family_account_id as string, (p.nome_mae as string | null) ?? null]),
  );
  const fam = new Map<string, Fam>();
  const get = (id: string | null): Fam | null => {
    if (!id) return null;
    let f = fam.get(id);
    if (!f) {
      f = { id, nome: nomePorFam.get(id) ?? null, ayla: 0, web: 0, diarios: 0, ludico: 0, planos: 0, ultima: 0 };
      fam.set(id, f);
    }
    return f;
  };
  const toca = (id: string | null, ts: string | null | undefined) => {
    const f = get(id);
    if (f && ts) f.ultima = Math.max(f.ultima, new Date(ts).getTime());
  };
  for (const m of aylaMsgs ?? []) {
    if (m.direcao === "inbound") {
      const f = get(m.family_account_id as string | null);
      if (f) f.ayla += 1;
    }
    toca(m.family_account_id as string | null, m.created_at as string);
  }
  for (const c of conversas ?? []) {
    const f = get(c.family_account_id as string | null);
    if (f) f.web += 1;
    toca(c.family_account_id as string | null, c.created_at as string);
  }
  for (const d of diarios ?? []) {
    const f = get(d.family_account_id as string | null);
    if (f) f.diarios += 1;
    toca(d.family_account_id as string | null, d.created_at as string);
  }
  for (const rows of [rotinas, meditacoes, desenhos, historias]) {
    for (const r of rows ?? []) {
      const f = get(r.family_account_id as string | null);
      if (f) f.ludico += 1;
      toca(r.family_account_id as string | null, r.created_at as string);
    }
  }
  for (const p of planos ?? []) {
    const f = get(p.family_account_id as string | null);
    if (f) f.planos += 1;
    toca(p.family_account_id as string | null, p.created_at as string);
  }
  for (const e of events ?? []) toca(e.family_account_id as string | null, e.created_at as string);

  const famArr = [...fam.values()];
  const agora = Date.now();
  const ativas7 = famArr.filter((f) => agora - f.ultima <= 7 * MS_DIA).length;
  const ativas30 = famArr.filter((f) => agora - f.ultima <= 30 * MS_DIA).length;
  const risco = famArr
    .filter((f) => f.ultima > 0 && agora - f.ultima > 7 * MS_DIA)
    .sort((a, b) => a.ultima - b.ultima)
    .slice(0, 20);
  const topEngajadas = [...famArr]
    .sort((a, b) => b.ayla + b.web + b.diarios + b.ludico + b.planos - (a.ayla + a.web + a.diarios + a.ludico + a.planos))
    .slice(0, 20);

  const fmtData = (ms: number) =>
    ms > 0 ? new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
  const labelFam = (f: Fam) => (f.nome ? capitalizarNome(f.nome) : `${f.id.slice(0, 8)}…`);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Console institucional</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Comportamento <em className="not-italic text-brand-purple">das famílias</em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Como as famílias usam o produto: Ayla × web, temas do Kolo Vivo, desafios, lúdico,
          planos e funil. Telas e features (em <strong>user_events</strong>) começam a encher a
          partir do deploy do tracking; o resto já é histórico (últimos 90 dias onde aplicável).
        </p>
      </header>

      {/* Cards de resumo */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Famílias" value={totalFamilias ?? 0} />
        <Stat label="Ativas 7 dias" value={ativas7} sub={`${ativas30} em 30 dias`} />
        <Stat label="Completude média do Kolo Vivo" value={`${completudeMedia}%`} />
        <Stat
          label="Clicaram assinar (30d)"
          value={checkoutFamilias.size}
          sub="evento checkout_iniciado"
        />
      </section>

      {/* Funil de assinatura */}
      <Bloco titulo="Funil de assinatura" desc="Distribuição de status das famílias.">
        <div className="flex flex-wrap gap-3">
          {(["trialing", "active", "past_due", "paused", "canceled"] as const).map((st) => (
            <div key={st} className="rounded-xl border border-foreground/[0.08] bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{st}</p>
              <p className="font-heading text-2xl text-foreground">{statusCount[st] ?? 0}</p>
            </div>
          ))}
        </div>
      </Bloco>

      {/* Ayla x Web */}
      <Bloco titulo="Ayla × Web" desc="Mensagens recebidas no WhatsApp (Ayla) vs conversas na web (Estratégias), últimos 90 dias.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-foreground/[0.08] bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ayla (WhatsApp) — msgs da mãe</p>
            <p className="font-heading text-3xl text-foreground">{aylaInbound}</p>
          </div>
          <div className="rounded-xl border border-foreground/[0.08] bg-white px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Web — conversas iniciadas</p>
            <p className="font-heading text-3xl text-foreground">{webConversas}</p>
          </div>
        </div>
      </Bloco>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bloco titulo="Kolo Vivo — temas preenchidos" desc="Quantos membros têm cada domínio com conteúdo.">
          <BarList items={domRank} />
        </Bloco>
        <Bloco titulo="Desafios mais recorrentes" desc="Áreas dos desafios registrados no diário (90d).">
          <BarList items={desafioRank} />
        </Bloco>
        <Bloco titulo="Lúdico — o que e quanto" desc="Total gerado e quantas famílias usaram.">
          <ul className="flex flex-col gap-2">
            {ludico.map((l) => (
              <li key={l.label} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{l.label}</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{l.n}</strong> · {l.fam} família(s)
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco titulo="Planos por tema" desc="Sobre o que as famílias pedem plano.">
          <BarList items={planoRank} />
        </Bloco>
        <Bloco titulo="Telas mais visitadas" desc="Do tracking novo — enche a partir do deploy.">
          {telaRank.length ? <BarList items={telaRank} /> : <Vazio />}
        </Bloco>
        <Bloco titulo="Features mais usadas" desc="Eventos de feature (registro, conversa, lúdico, plano…).">
          {featureRank.length ? <BarList items={featureRank} /> : <Vazio />}
        </Bloco>
      </div>

      {/* Top famílias engajadas */}
      <Bloco titulo="Famílias mais engajadas" desc="Top 20 por volume combinado (Ayla + web + diários + lúdico + planos).">
        <TabelaFamilias linhas={topEngajadas} labelFam={labelFam} fmtData={fmtData} />
      </Bloco>

      {/* Risco de abandono */}
      <Bloco titulo="Risco de abandono" desc="Famílias sem nenhuma atividade há mais de 7 dias (pra reengajar).">
        {risco.length ? (
          <TabelaFamilias linhas={risco} labelFam={labelFam} fmtData={fmtData} />
        ) : (
          <Vazio texto="Nenhuma família inativa há +7 dias." />
        )}
      </Bloco>
    </div>
  );
}

// ── Componentes ──

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card className="rounded-3xl">
      <CardHeader className="gap-1">
        <CardDescription className="text-xs uppercase tracking-[0.12em] text-muted-foreground/80">
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-3xl text-foreground">{value}</CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

function Bloco({ titulo, desc, children }: { titulo: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BarList({ items }: { items: { label: string; n: number }[] }) {
  if (!items.length) return <Vazio />;
  const max = Math.max(...items.map((i) => i.n), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3">
          <span className="w-44 shrink-0 truncate text-sm text-foreground" title={i.label}>
            {i.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
            <span
              className="block h-full rounded-full bg-brand-yellow"
              style={{ width: `${Math.round((i.n / max) * 100)}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground">{i.n}</span>
        </li>
      ))}
    </ul>
  );
}

function Vazio({ texto = "Ainda sem dados — começa a encher com o uso." }: { texto?: string }) {
  return <p className="text-sm text-muted-foreground">{texto}</p>;
}

type FamLinha = {
  id: string;
  nome: string | null;
  ayla: number;
  web: number;
  diarios: number;
  ludico: number;
  planos: number;
  ultima: number;
};

function TabelaFamilias({
  linhas,
  labelFam,
  fmtData,
}: {
  linhas: FamLinha[];
  labelFam: (f: FamLinha) => string;
  fmtData: (ms: number) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Família</th>
            <th className="px-3 py-2 text-right font-medium">Ayla</th>
            <th className="px-3 py-2 text-right font-medium">Web</th>
            <th className="px-3 py-2 text-right font-medium">Diários</th>
            <th className="px-3 py-2 text-right font-medium">Lúdico</th>
            <th className="px-3 py-2 text-right font-medium">Planos</th>
            <th className="px-3 py-2 text-right font-medium">Último acesso</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((f) => (
            <tr key={f.id} className="border-t border-foreground/[0.06]">
              <td className="py-2 pr-3 text-foreground">{labelFam(f)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.ayla}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.web}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.diarios}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.ludico}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{f.planos}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmtData(f.ultima)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
