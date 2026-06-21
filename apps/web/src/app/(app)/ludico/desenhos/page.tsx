import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { capitalizarNome } from "@/lib/nome";
import { EnviarDesenho } from "./enviar-desenho";

// A análise (Claude visão) roda em segundo plano após o upload — teto largo.
export const maxDuration = 300;

function dataBr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function DesenhosPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membros }, { data: desenhos }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("desenhos")
      .select(
        "id, imagem_url, status, created_at, membro_atipico_id, resposta_crianca, analise, membros_atipicos(nome)",
      )
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  const mapas = montarMapas(desenhos ?? []);
  // Bucket privado → URL assinada na leitura (alinhada à ordem de `desenhos`).
  const desenhosUrls = await assinarImagens(
    supabase,
    (desenhos ?? []).map((d) => d.imagem_url as string),
  );

  const membrosList = (membros ?? []).map((m) => ({
    id: m.id as string,
    nome: capitalizarNome(m.nome as string),
  }));

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/ludico"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-3" /> Lúdico
      </Link>

      <header className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-purple">
          O que o desenho conta?
        </p>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Uma leitura <em className="not-italic text-brand-purple">cuidadosa</em>, pra
          observar e perguntar
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Envie a foto de um desenho e a Kolo te ajuda a notar o que aparece e a fazer boas
          perguntas — sem rótulos, sem diagnóstico. Cada desenho fica guardado com a data,
          pra vocês acompanharem a evolução ao longo do tempo.
        </p>
      </header>

      {membrosList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cadastre uma criança no Perfil pra começar.
        </p>
      ) : (
        <EnviarDesenho membros={membrosList} />
      )}

      {mapas.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-heading text-xl text-foreground">Mapa dos desenhos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O que vai se repetindo ao longo do tempo — um desenho diz pouco; o padrão diz
              muito. Vai ficando mais rico a cada novo desenho.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {mapas.map((m) => (
              <MapaCard key={m.membroId} mapa={m} />
            ))}
          </div>
        </section>
      )}

      {(desenhos ?? []).length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl text-foreground">Diário de desenhos</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(desenhos ?? []).map((d, i) => {
              const rel = d.membros_atipicos as { nome: string } | { nome: string }[] | null;
              const nome = rel
                ? Array.isArray(rel)
                  ? rel[0]?.nome
                  : rel.nome
                : null;
              return (
                <li key={d.id as string}>
                  <Link
                    href={`/ludico/desenhos/${d.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/[0.07] bg-white transition-colors hover:border-brand-purple/30"
                  >
                    <div className="relative aspect-square overflow-hidden bg-secondary/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={(desenhosUrls[i] ?? d.imagem_url) as string}
                        alt="Desenho"
                        className="size-full object-cover"
                      />
                      {d.status === "analisando" && (
                        <span className="absolute inset-x-0 bottom-0 bg-brand-purple/80 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
                          analisando…
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 px-3 py-2">
                      <span className="text-sm font-medium text-foreground">
                        {dataBr(d.created_at as string)}
                      </span>
                      {nome && (
                        <span className="text-xs text-muted-foreground">
                          {capitalizarNome(nome)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ============================================================
// Mapa dos desenhos (Nível 3) — agregação longitudinal por membro.
// A partir de ~5 desenhos analisados, mostra os temas/forma/emoção que voltam.
// ============================================================

type Contagem = { rotulo: string; n: number };
type MapaMembro = {
  membroId: string;
  nome: string;
  total: number;
  temas: Contagem[];
  formas: Contagem[];
  emocoes: Contagem[];
};

const EMOCOES_RX = /apontou:\s*(feliz|preocupad[ao]|brav[ao]|com medo|tranquil[ao])/i;
function emocaoDaResposta(resp: string | null): string | null {
  if (!resp) return null;
  const m = resp.toLowerCase().match(EMOCOES_RX);
  if (!m) return null;
  return m[1].replace(/[ao]$/, "a"); // normaliza gênero pra rótulo único
}

function topN(map: Map<string, number>, n: number): Contagem[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([rotulo, nn]) => ({ rotulo, n: nn }));
}

function montarMapas(desenhos: Array<Record<string, unknown>>): MapaMembro[] {
  const por = new Map<
    string,
    {
      nome: string;
      total: number;
      temas: Map<string, number>;
      formas: Map<string, number>;
      emocoes: Map<string, number>;
    }
  >();
  for (const d of desenhos) {
    if (d.status !== "pronto") continue;
    const membroId = d.membro_atipico_id as string | null;
    if (!membroId) continue;
    const rel = d.membros_atipicos as { nome?: string } | { nome?: string }[] | null;
    const nome = rel ? (Array.isArray(rel) ? rel[0]?.nome : rel.nome) : null;
    if (!por.has(membroId))
      por.set(membroId, {
        nome: nome ?? "",
        total: 0,
        temas: new Map(),
        formas: new Map(),
        emocoes: new Map(),
      });
    const agg = por.get(membroId)!;
    agg.total++;
    const analise = d.analise as { temas?: unknown; forma?: unknown } | null;
    const temas = Array.isArray(analise?.temas)
      ? (analise!.temas as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    for (const t of temas) agg.temas.set(t, (agg.temas.get(t) ?? 0) + 1);
    const forma = typeof analise?.forma === "string" ? analise.forma : "";
    if (forma) agg.formas.set(forma, (agg.formas.get(forma) ?? 0) + 1);
    const emo = emocaoDaResposta(d.resposta_crianca as string | null);
    if (emo) agg.emocoes.set(emo, (agg.emocoes.get(emo) ?? 0) + 1);
  }
  return [...por.entries()]
    .filter(([, a]) => a.total >= 5)
    .map(([membroId, a]) => ({
      membroId,
      nome: a.nome,
      total: a.total,
      temas: topN(a.temas, 6),
      formas: topN(a.formas, 3),
      emocoes: topN(a.emocoes, 3),
    }));
}

const EMOJI_TEMA: Record<string, string> = {
  flor: "🌸",
  árvore: "🌳",
  natureza: "🌿",
  casa: "🏠",
  pessoa: "🧍",
  família: "👨‍👩‍👧",
  animal: "🐾",
  sol: "☀️",
  coração: "❤️",
  carro: "🚗",
  monstro: "👾",
  comida: "🍎",
  "arco-íris": "🌈",
  abstrato: "🌀",
};

const EMOJI_EMOCAO: Record<string, string> = {
  feliz: "😊",
  tranquila: "😐",
  preocupada: "😟",
  brava: "😠",
  "com medo": "😨",
};

const SUGESTAO_TEMA: Record<string, string> = {
  flor: "Explorar a natureza juntas — passear, plantar, observar.",
  natureza: "Explorar a natureza juntas — passear, plantar, observar.",
  árvore: "Explorar a natureza juntas — passear, plantar, observar.",
  animal: "Criar histórias com bichos — ela curte esse universo.",
  casa: "Usar os personagens pra conversar sobre quem ela ama e onde se sente bem.",
  família: "Usar os personagens pra conversar sobre quem ela ama.",
  monstro: "Faz-de-conta com personagens — dá pra explorar medos com leveza.",
  abstrato: "Brincar com formas, cores e movimento — massinha, tinta, dança.",
  carro: "Brincadeiras de movimento e percursos.",
  coração: "Conversar sobre afeto e quem ela gosta, usando o desenho.",
};

function sugestoesDoMapa(temas: Contagem[]): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const t of temas) {
    const s = SUGESTAO_TEMA[t.rotulo];
    if (s && !vistas.has(s)) {
      vistas.add(s);
      out.push(s);
    }
    if (out.length >= 3) break;
  }
  return out;
}

function MapaCard({ mapa }: { mapa: MapaMembro }) {
  const nome = mapa.nome ? capitalizarNome(mapa.nome) : "essa criança";
  const emoTop = mapa.emocoes[0]?.rotulo;
  const temaTop = mapa.temas[0]?.rotulo;
  const sugestoes = sugestoesDoMapa(mapa.temas);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-foreground/[0.07] bg-white p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-lg text-foreground">{nome}</h3>
        <span className="text-xs text-muted-foreground">{mapa.total} desenhos</span>
      </div>

      {mapa.temas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
            Temas favoritos
          </span>
          <div className="flex flex-wrap gap-1.5">
            {mapa.temas.map((t) => (
              <span
                key={t.rotulo}
                className="inline-flex items-center gap-1 rounded-full bg-cat-social-bg px-2.5 py-1 text-xs font-medium text-cat-social"
              >
                {EMOJI_TEMA[t.rotulo] ?? "•"} {t.rotulo}
                {t.n > 1 && <span className="opacity-60">· {t.n}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {mapa.emocoes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
            Emoções mais escolhidas
          </span>
          <div className="flex flex-wrap gap-1.5">
            {mapa.emocoes.map((e) => (
              <span
                key={e.rotulo}
                className="inline-flex items-center gap-1 rounded-full bg-cat-emocao-bg px-2.5 py-1 text-xs font-medium text-cat-emocao"
              >
                {EMOJI_EMOCAO[e.rotulo] ?? "•"} {e.rotulo}
                {e.n > 1 && <span className="opacity-60">· {e.n}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {mapa.formas[0] && (
        <p className="text-sm text-muted-foreground">
          Forma recorrente:{" "}
          <span className="font-medium text-foreground">{mapa.formas[0].rotulo}</span>
        </p>
      )}

      {sugestoes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
            Ideias pra brincar e conversar
          </span>
          <ul className="flex flex-col gap-1">
            {sugestoes.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
                <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-brand-purple/40" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {temaTop && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nos desenhos de {nome}, <span className="text-foreground">{temaTop}</span> aparece com
          frequência{emoTop ? ` e a emoção que mais volta é ${emoTop}` : ""}. São pistas do que
          parece importante pra {nome} agora — não conclusões.
        </p>
      )}
    </div>
  );
}
