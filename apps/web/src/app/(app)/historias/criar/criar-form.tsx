"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AVATAR_ESTILOS, type AvatarEstilo } from "@/lib/imagem/avatar-prompt";
import { criarHistoria } from "../actions";

const EXEMPLOS = [
  "Preparar para a primeira ida ao dentista",
  "Ensaiar a hora do banho depois da TV, sem crise",
  "Celebrar que comeu um alimento novo",
  "Antecipar o almoço de domingo na casa da vó",
];

type Avatar = { id: string; url: string; selecionado: boolean };
type Crianca = { id: string; nome: string; idade: number | null; avatares: Avatar[] };

function avatarPadrao(avs: Avatar[]): string {
  return (avs.find((a) => a.selecionado) ?? avs[0])?.id ?? "";
}

export function CriarHistoriaForm({
  criancas,
  ativaId,
  intencaoId,
  descricaoInicial = "",
  objetivoInicial = "compreender",
}: {
  criancas: Crianca[];
  ativaId?: string;
  intencaoId?: string;
  descricaoInicial?: string;
  objetivoInicial?: "compreender" | "agir" | "agencia";
}) {
  const router = useRouter();
  const inicial = criancas.find((c) => c.id === ativaId) ?? criancas[0];
  const [membroId, setMembroId] = useState(inicial?.id ?? "");
  const [avatarId, setAvatarId] = useState(() => avatarPadrao(inicial?.avatares ?? []));
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [objetivo, setObjetivo] = useState(objetivoInicial);
  const [tom, setTom] = useState("acolhedora");
  const [personagem, setPersonagem] = useState<"avatar" | "animais_floresta" | "criancas" | "dinossauros" | "robos">(
    inicial?.avatares.length ? "avatar" : /dinossaur/i.test(descricaoInicial) ? "dinossauros" : "animais_floresta",
  );
  const [estiloVisual, setEstiloVisual] = useState<AvatarEstilo>("animacao_3d");
  const [nPaginas, setNPaginas] = useState(5);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const avatares = criancas.find((c) => c.id === membroId)?.avatares ?? [];
  const idade = criancas.find((c) => c.id === membroId)?.idade ?? null;
  const estilosOrdenados = [...AVATAR_ESTILOS].sort((a, b) => {
    const jovem = (idade ?? 0) >= 11;
    const prioridade = jovem
      ? ["gamer_3d", "anime_3d", "ficcao_3d", "fantasia_3d", "animacao_3d"]
      : ["animacao_3d", "massinha_3d", "pelucia", "fantasia_3d"];
    const rank = (value: string) => {
      const i = prioridade.indexOf(value);
      return i < 0 ? prioridade.length : i;
    };
    return rank(a.value) - rank(b.value);
  });

  function trocarCrianca(id: string) {
    setMembroId(id);
    setAvatarId(avatarPadrao(criancas.find((c) => c.id === id)?.avatares ?? []));
  }
  function criar() {
    if (!descricao.trim() || pending) return;
    setErro(null);
    start(async () => {
      const descricaoCompleta = `${descricao.trim()}\nObjetivo da história: ${objetivo}. Tom: ${tom}.`;
      const r = await criarHistoria({ membroId, descricao: descricaoCompleta, nPaginas, avatarId: personagem === "avatar" ? avatarId || undefined : undefined, personagem, estiloVisual, intencaoId });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push(`/historias/${r.id}`);
    });
  }

  if (pending) {
    return (
      <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple-deep to-brand-purple-dark px-8 py-16 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1.5px 1.5px at 18% 26%, rgba(255,255,255,.55) 50%, transparent), radial-gradient(1.5px 1.5px at 82% 20%, rgba(255,186,0,.7) 50%, transparent), radial-gradient(1px 1px at 70% 80%, rgba(255,255,255,.5) 50%, transparent), radial-gradient(1px 1px at 28% 82%, rgba(255,186,0,.5) 50%, transparent)",
          }}
        />
        <span className="relative flex size-24 items-center justify-center rounded-full bg-white/10 backdrop-blur">
          <span
            aria-hidden
            className="absolute -inset-2 rounded-full border-2 border-dashed border-brand-yellow/50 animate-[spin_10s_linear_infinite]"
          />
          <Wand2 className="size-10 text-brand-yellow" />
        </span>
        <h2 className="relative font-heading text-2xl">A Kolo está ilustrando…</h2>
        <p className="relative max-w-sm text-sm text-white/75">
          Escrevendo a história e desenhando cada página com o mesmo personagem.
          Leva cerca de um minuto — pode deixar aberto.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-kolo-linha bg-white p-5">
      {descricaoInicial && (
        <div className="rounded-2xl border border-brand-purple/25 bg-kolo-lilas-bg-2/40 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">História preparada para {inicial?.nome ?? "a criança"}</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{descricaoInicial}</p>
          <p className="mt-2 text-sm text-muted-foreground">Revise a ideia e o foco abaixo. Depois, escolha quem vive a aventura e o visual.</p>
        </div>
      )}
      {criancas.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crianca">Pra quem</Label>
          <select
            id="crianca"
            value={membroId}
            onChange={(e) => trocarCrianca(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {criancas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="order-3 flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">3. Escolha quem vive a história</p>
        <p className="text-sm text-muted-foreground">Isso define os personagens da aventura; não muda a situação que você contou.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ...(avatares.length ? [["avatar", "🧒", "O avatar"]] : []),
            ["animais_floresta", "🦊", "Animais da floresta"],
            ["criancas", "🧑🏽‍🤝‍🧑🏻", (idade ?? 0) >= 13 ? "Pessoas fictícias" : "Crianças fictícias"],
            ["dinossauros", "🦕", "Dinossauros"],
            ["robos", "🤖", "Robôs"],
          ].map(([valor, emoji, label]) => (
            <button key={valor} type="button" onClick={() => setPersonagem(valor as typeof personagem)} className={cn("min-h-24 rounded-2xl border-2 p-3 text-left", personagem === valor ? "border-brand-purple bg-kolo-lilas-bg-2/50" : "border-input bg-secondary/20")}>
              <span className="block text-3xl" aria-hidden>{emoji}</span><span className="mt-2 block text-sm font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {personagem === "avatar" && avatares.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label>Com qual avatar?</Label>
          <div className="flex flex-wrap gap-2.5">
            {avatares.map((a) => {
              const ativo = a.id === avatarId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarId(a.id)}
                  aria-pressed={ativo}
                  className={cn(
                    "relative overflow-hidden rounded-xl border-2 transition-colors",
                    ativo ? "border-brand-purple" : "border-transparent hover:border-brand-purple/40",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="Avatar" className="size-16 object-cover" />
                  {a.selecionado && (
                    <span className="absolute bottom-0 inset-x-0 bg-brand-purple/85 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-white">
                      em uso
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="order-4 flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">4. Escolha o visual do mundo</p>
        <p className="text-sm text-muted-foreground">Personagens e cenários seguem o mesmo estilo em todas as páginas.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {estilosOrdenados.map((estilo) => (
            <button key={estilo.value} type="button" onClick={() => setEstiloVisual(estilo.value)} className={cn("min-h-28 rounded-2xl border-2 bg-gradient-to-br from-secondary/60 to-white p-4 text-left", estiloVisual === estilo.value ? "border-brand-purple shadow-sm" : "border-input")}>
              <span aria-hidden className="block aspect-[4/3] w-full rounded-xl bg-cover" style={{ backgroundImage: "url('/avatar-styles/style-sheet-3d.png')", backgroundSize: "400% 200%", backgroundPosition: estilo.previewPosition }} />
              <span className="mt-2 block text-sm font-semibold">{estilo.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{estilo.descricao}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="order-1 flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">1. Confira a situação</p>
        <Label htmlFor="descricao" className="text-base">O que está acontecendo?</Label>
        <textarea
          id="descricao"
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: uma história pra preparar o André para a consulta no dentista na semana que vem. Ele tem medo de barulho."
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-base leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setDescricao(ex)}
              className="rounded-full border border-foreground/10 bg-kolo-lilas-bg-2/50 px-3 py-1 text-xs text-muted-foreground hover:border-brand-purple/30 hover:text-brand-purple"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="order-2 flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">2. Confira o foco da história</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ["compreender", "Entender o que acontece"],
            ["agir", "Saber o que fazer"],
            ["agencia", "Sentir segurança e escolha"],
          ] as const).map(([valor, label]) => (
            <button key={valor} type="button" onClick={() => setObjetivo(valor)} className={cn("flex min-h-16 items-center gap-2 rounded-xl border-2 p-3 text-left text-sm font-medium", objetivo === valor ? "border-brand-purple bg-kolo-lilas-bg-2/50" : "border-input")}>
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", objetivo === valor && "border-brand-purple bg-brand-purple text-white")}>{objetivo === valor && <Check className="size-3" />}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tom">Clima da história</Label>
          <select id="tom" value={tom} onChange={(e) => setTom(e.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="acolhedora">Acolhedora e tranquila</option>
            <option value="divertida">Divertida e leve</option>
            <option value="aventureira">Aventura e coragem</option>
          </select>
        </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paginas">Quantas páginas</Label>
        <select
          id="paginas"
          value={nPaginas}
          onChange={(e) => setNPaginas(Number(e.target.value))}
          className="flex h-10 w-40 rounded-md border border-input bg-background px-3 text-sm"
        >
          {[3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} páginas
            </option>
          ))}
        </select>
      </div>
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="rounded-2xl bg-kolo-creme p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">5. Gere e acompanhe</p>
        <p className="mt-1 text-sm text-muted-foreground">Você verá a história assim que ficar pronta e poderá voltar a ela depois.</p>
        <Button className="mt-4 h-12 w-full text-base" type="button" onClick={criar} disabled={!descricao.trim()}>
          <Sparkles className="size-4" aria-hidden />
          Criar história
        </Button>
      </div>
    </div>
  );
}
