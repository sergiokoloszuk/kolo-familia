import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Eyebrow } from "@/components/brand/eyebrow";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { classificarPublico, GRUPOS_PUBLICO, type AssinaturaPublico, type GrupoPublico } from "@/lib/admin/publicos-campanha";

export const dynamic = "force-dynamic";

type Linha = Record<string, unknown>;
const TAMANHO_PAGINA = 50;

/** A API do Supabase limita resultados; não tratar uma página como a base toda. */
async function lerTabela(admin: SupabaseClient, tabela: string, colunas: string, ordem: string): Promise<Linha[]> {
  const linhas: Linha[] = [];
  const lote = 500;
  for (let inicio = 0; inicio < 50_000; inicio += lote) {
    const { data, error } = await admin.from(tabela).select(colunas).order(ordem).range(inicio, inicio + lote - 1);
    if (error) throw new Error(`Não foi possível conferir os públicos (${tabela}): ${error.message}`);
    if (!data) throw new Error(`Não foi possível conferir os públicos (${tabela}): leitura sem dados.`);
    const pagina = data as Linha[];
    linhas.push(...pagina);
    if (pagina.length < lote) return linhas;
  }
  throw new Error(`O público ultrapassou o limite de leitura segura (${tabela}).`);
}

function chave(v: unknown): string { return typeof v === "string" ? v : ""; }

export default async function PublicosCampanhaPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string | string[]; pagina?: string | string[]; busca?: string | string[] }>;
}) {
  await requireAdmin();
  const admin = createServiceRoleClient();
  const params = await searchParams;
  const solicitado = typeof params.grupo === "string" ? params.grupo : "todos";
  const grupo: GrupoPublico = GRUPOS_PUBLICO.some((g) => g.id === solicitado)
    ? solicitado as GrupoPublico : "todos";
  const paginaParam = typeof params.pagina === "string" ? Number(params.pagina) : 1;
  const pagina = Number.isSafeInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;
  const busca = typeof params.busca === "string" ? params.busca.trim().slice(0, 100) : "";

  const [familias, assinaturas, perfis, preferencias] = await Promise.all([
    lerTabela(admin, "family_accounts", "id, nome_familia, whatsapp_e164, created_at", "id"),
    lerTabela(admin, "subscription_accesses", "family_account_id, status, trial_ends_at, current_period_end, stripe_subscription_id, pagamento_falhou_em, cancel_at_period_end, cortesia, cortesia_ate", "family_account_id"),
    lerTabela(admin, "family_profiles", "family_account_id, nome_mae", "family_account_id"),
    lerTabela(admin, "ayla_preferences", "family_account_id, consentimento_em, desativada", "family_account_id"),
  ]);

  const subPorFamilia = new Map(assinaturas.map((s) => [chave(s.family_account_id), s]));
  const perfilPorFamilia = new Map(perfis.map((p) => [chave(p.family_account_id), p]));
  const prefPorFamilia = new Map(preferencias.map((p) => [chave(p.family_account_id), p]));
  const agora = Date.now();
  const contatos = familias.map((f) => {
    const id = chave(f.id);
    const sub = subPorFamilia.get(id);
    const perfil = perfilPorFamilia.get(id);
    const pref = prefPorFamilia.get(id);
    const classificacao = classificarPublico((sub ?? null) as AssinaturaPublico, agora);
    return {
      id,
      nome: chave(perfil?.nome_mae) || chave(f.nome_familia) || "Sem nome no perfil",
      whatsapp: chave(f.whatsapp_e164),
      criadoEm: chave(f.created_at),
      consentiuAyla: Boolean(pref?.consentimento_em) && pref?.desativada !== true,
      ...classificacao,
    };
  });
  const contagens = Object.fromEntries(GRUPOS_PUBLICO.map((g) => [g.id, contatos.filter((c) => c.grupos.includes(g.id)).length]));
  const buscaNormalizada = busca.toLocaleLowerCase("pt-BR");
  const filtrados = contatos
    .filter((c) => c.grupos.includes(grupo))
    .filter((c) => !buscaNormalizada || `${c.nome} ${c.whatsapp}`.toLocaleLowerCase("pt-BR").includes(buscaNormalizada))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * TAMANHO_PAGINA, paginaAtual * TAMANHO_PAGINA);
  const urlPagina = (n: number) => `/admin/campanhas/publicos?grupo=${grupo}&pagina=${n}${busca ? `&busca=${encodeURIComponent(busca)}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link href="/admin/campanhas" className="text-sm text-muted-foreground hover:underline">← Comunicações</Link>
        <Eyebrow>Públicos da Kolo</Eyebrow>
        <h1 className="font-heading text-3xl">Quem está em cada grupo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastro atual da Kolo. Uma família pode estar em mais de um grupo; isso não confirma entrega,
          pagamento no Stripe nem permissão para receber ofertas.
        </p>
      </header>

      <nav aria-label="Grupos de contatos" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {GRUPOS_PUBLICO.map((g) => (
          <Link key={g.id} href={`/admin/campanhas/publicos?grupo=${g.id}`}
            aria-current={grupo === g.id ? "page" : undefined}
            className={`rounded-xl border p-3 hover:border-brand-purple ${grupo === g.id ? "border-brand-purple bg-brand-purple/5" : "bg-white"}`}>
            <span className="flex items-center justify-between gap-2 font-medium"><span>{g.nome}</span><span>{contagens[g.id]}</span></span>
            <span className="mt-1 block text-xs text-muted-foreground">{g.descricao}</span>
          </Link>
        ))}
      </nav>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl">{GRUPOS_PUBLICO.find((g) => g.id === grupo)?.nome}</h2>
            <p className="text-sm text-muted-foreground">{filtrados.length} contato(s) nesta lista</p>
          </div>
          <form method="get" className="flex gap-2">
            <input type="hidden" name="grupo" value={grupo} />
            <input name="busca" defaultValue={busca} aria-label="Buscar por nome ou WhatsApp"
              placeholder="Nome ou WhatsApp" className="rounded-md border px-3 py-2 text-sm" />
            <button type="submit" className="rounded-md border px-3 py-2 text-sm">Buscar</button>
          </form>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground"><tr>
              <th className="px-2 py-2">Família</th><th className="px-2 py-2">WhatsApp</th>
              <th className="px-2 py-2">Situação e motivo</th><th className="px-2 py-2">Ayla</th>
            </tr></thead>
            <tbody>
              {visiveis.map((c) => <tr key={c.id} className="border-b last:border-0">
                <td className="px-2 py-3 font-medium">{c.nome}</td>
                <td className="px-2 py-3 font-mono text-xs">{c.whatsapp || "Sem número"}</td>
                <td className="px-2 py-3"><span className="block font-medium">{c.situacao}</span>
                  <span className="text-xs text-muted-foreground">{c.motivo}</span></td>
                <td className="px-2 py-3 text-xs">{c.consentiuAyla ? "Ativa" : "Sem autorização ativa da Ayla"}</td>
              </tr>)}
              {visiveis.length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">Nenhum contato encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>Página {paginaAtual} de {totalPaginas}</span>
          <span className="flex gap-3">
            {paginaAtual > 1 && <Link href={urlPagina(paginaAtual - 1)} className="underline">Anterior</Link>}
            {paginaAtual < totalPaginas && <Link href={urlPagina(paginaAtual + 1)} className="underline">Próxima</Link>}
          </span>
        </div>
      </div>
    </div>
  );
}
