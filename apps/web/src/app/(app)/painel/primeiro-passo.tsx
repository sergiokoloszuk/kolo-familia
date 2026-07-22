import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Os 6 temas de desafio do onboarding (tela-4) → domínio do Kolo Vivo.
// A Home lê de volta o que a mãe marcou pra propor por onde começar.
const DESAFIO_ONBOARDING: { key: string; label: string; emoji: string }[] = [
  { key: "nutricional", label: "Alimentação", emoji: "🍽️" },
  { key: "comunicacao", label: "Comunicação", emoji: "💬" },
  { key: "emocional", label: "Emoções", emoji: "💛" },
  { key: "foco", label: "Foco", emoji: "🎯" },
  { key: "socializacao", label: "Socialização", emoji: "🤝" },
  { key: "autonomia", label: "Autonomia", emoji: "🧩" },
];

export type DesafioMarcado = { key: string; label: string; emoji: string };

/**
 * Extrai os desafios que a mãe marcou no onboarding, lendo
 * `perfil_vivo_membro.categorias_extras` (cada tema virou `{ texto }` no
 * domínio correspondente — ver saveTela4). Retorna só os 6 temas de desafio
 * que têm texto preenchido.
 */
export function desafiosDoOnboarding(extras: unknown): DesafioMarcado[] {
  if (!extras || typeof extras !== "object") return [];
  const bag = extras as Record<string, unknown>;
  return DESAFIO_ONBOARDING.filter((d) => {
    const v = bag[d.key] as { texto?: unknown } | undefined;
    return v && typeof v.texto === "string" && v.texto.trim().length > 0;
  });
}

/**
 * Primeiro passo da Home de boas-vindas: propõe começar pelo que já pesa. Se a
 * mãe marcou desafios no cadastro, mostra-os como caminhos; se não, convida a
 * contar o que está difícil agora. Sempre leva às Estratégias.
 */
export function PrimeiroPasso({
  nomeCA,
  desafios,
  aylaAtiva,
}: {
  nomeCA: string | null;
  desafios: DesafioMarcado[];
  aylaAtiva: boolean;
}) {
  const temDesafios = desafios.length > 0;
  const nome = nomeCA ?? "seu filho";

  return (
    <section
      className="relative overflow-hidden rounded-3xl px-6 py-6 text-white md:px-8 md:py-7"
      style={{
        background:
          "linear-gradient(135deg, var(--brand-purple-deep) 0%, var(--brand-purple-dark) 100%)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,186,0,0.32) 0%, transparent 70%)" }}
      />
      <div className="relative">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-yellow">
          Por onde começar
        </span>
        <h2 className="mt-3 font-heading text-xl text-white md:text-2xl">
          {temDesafios ? "Vamos começar pelo que mais pesa" : `Conte o que está difícil com ${nome} agora`}
        </h2>
        <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/75">
          {temDesafios
            ? `No cadastro você me contou alguns desafios ${nomeCA ? `d${nome[0]?.toLowerCase() === "a" ? "a" : "o"} ${nome}` : "do seu filho"}. Escolha um pra trabalhar agora — e me conte melhor o que está acontecendo.`
            : "Em uns minutos a Kolo te devolve um caminho prático. É o jeito mais rápido de sentir o valor."}
        </p>

        {temDesafios && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            {desafios.map((d) => (
              <Link
                key={d.key}
                href="/estrategias"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.07] px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-yellow hover:bg-brand-yellow hover:text-brand-purple-dark"
              >
                <span aria-hidden>{d.emoji}</span>
                {d.label}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href="/estrategias"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-5 py-3 text-sm font-bold text-brand-purple-dark transition-transform hover:scale-[1.02]"
          >
            {temDesafios ? "Trabalhar isso agora" : "Contar um desafio"}
            <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
          </Link>
          {aylaAtiva && (
            <span className="text-[13px] text-white/65">
              ou fale com a Ayla no WhatsApp 💬
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
