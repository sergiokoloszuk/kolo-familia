import Link from "next/link";
import { VideoAjuda } from "@/components/video-guia";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { capitalizarNome } from "@/lib/nome";
import { ConversarForm } from "../conversar/conversar-form";
import { ConversaItem } from "./conversa-item";

/**
 * Estratégias Kolo — UM CAMINHO:
 *   1. Conversar sobre o que aconteceu (ConversarForm)
 *   2. Conversas anteriores (5 últimas)
 *
 * A antiga "biblioteca de tipos" (Brincadeiras/Atividades/Crenças…) saiu daqui:
 * os formatos viram as abas do plano; a conversa conduz pra eles. As rotas
 * /apoio/[key] seguem acessíveis por URL (legado), só não há mais os botões.
 */

export default async function EstrategiasPage({
  searchParams,
}: {
  searchParams: Promise<{ membro?: string; tema?: string }>;
}) {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;
  const sp = await searchParams;
  const temaContexto = sp.tema?.trim() || null;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const ativaId = (await resolverCriancaAtivaId(membros ?? [])) ?? undefined;

  // Conversas anteriores da CRIANÇA ATIVA (não mistura os filhos).
  let convQuery = supabase
    .from("conversas")
    .select("id, titulo, created_at")
    .eq("family_account_id", familyId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (ativaId) convQuery = convQuery.eq("membro_atipico_id", ativaId);
  const { data: conversas } = await convQuery;
  const temConversas = (conversas ?? []).length > 0;
  const nomes = (membros ?? [])
    .map((m) => (m.nome ? capitalizarNome(m.nome as string) : null))
    .filter((n): n is string => Boolean(n));
  const nomesFmt =
    nomes.length === 0
      ? "a pessoa que você cuida"
      : nomes.length === 1
        ? nomes[0]
        : nomes.length === 2
          ? `${nomes[0]} e ${nomes[1]}`
          : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  const reageVerbo = nomes.length > 1 ? "reagem" : "reage";

  return (
    <div className="flex flex-col gap-12">
      <header className="max-w-2xl">
        <Eyebrow>Estratégias</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Conte o que tá difícil —{" "}
          <em className="not-italic text-brand-purple">eu acho um caminho</em>.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Escreva do seu jeito; quanto mais do dia real, mais certeira eu fico.
        </p>
      </header>

      {/* Ajuda contextual — invisível enquanto não houver URL em lib/video-ajuda. */}
      <VideoAjuda area="estrategias" />

      {/* Dicas pra perto de onde importam (saíram do cabeçalho): o que incluir
          + o fim de semana organizado, numa linha discreta acima do campo.
          ⚠️ NÃO chamar de "plano": Plano Kolo virou um contrato específico
          (objetivo, estratégia central, progressão, avaliação, quando ajustar).
          O fim de semana é outra entrega — organiza dois dias, não constrói uma
          habilidade — e o mesmo nome pra duas coisas foi metade da variação de
          profundidade que a auditoria mediu. A oferta no WhatsApp já dizia
          "roteiro leve", e o título gerado já é "Fim de semana leve — Nome";
          esta linha era o último lugar que dizia "plano". */}
      <div className="flex flex-col gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Ajuda incluir:</span> o que acontece e
          quando, como {nomesFmt} {reageVerbo} e o que parece disparar, e o que você já tentou.
          Também organizo o{" "}
          <span className="font-medium text-foreground">fim de semana ou as férias</span> — é só
          contar a programação.
        </p>
        <ConversarForm
          membros={membros ?? []}
          initialMembroId={sp.membro ?? ativaId}
          tema={temaContexto ?? undefined}
        />
      </div>

      {temConversas && <ConversasAnterioresSection conversas={conversas ?? []} />}

      <footer className="max-w-2xl border-t border-foreground/[0.06] pt-5 text-sm text-muted-foreground">
        <p className="italic text-muted-foreground/80">
          Aqui é apoio de quem entende de neurodivergência e do cansaço de cuidar — não substitui
          profissionais de saúde.
        </p>
        <p className="mt-2">
          Quer ajustar o perfil antes?{" "}
          <Link
            href="/kolo-vivo"
            className="font-semibold text-brand-purple underline-offset-4 hover:underline"
          >
            Ir pro Perfil
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}

// ============================================================
// Conversas anteriores — lista editorial (5 últimas)
// ============================================================

interface ConversaResumo {
  id: string;
  titulo: string | null;
  created_at: string;
}

function ConversasAnterioresSection({
  conversas,
}: {
  conversas: ConversaResumo[];
}) {
  return (
    <section>
      <Eyebrow>Conversas anteriores</Eyebrow>
      <h2 className="mt-1 font-heading text-2xl text-foreground">
        Onde vocês <em className="not-italic text-brand-purple">pararam</em>
      </h2>
      <ul className="mt-5 flex flex-col">
        {conversas.map((c, idx) => (
          <ConversaItem
            key={c.id}
            id={c.id}
            titulo={c.titulo}
            createdAt={c.created_at}
            comBorda={idx > 0}
          />
        ))}
      </ul>
    </section>
  );
}
