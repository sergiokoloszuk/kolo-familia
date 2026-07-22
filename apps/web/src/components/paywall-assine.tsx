import Link from "next/link";
import { ArrowRight, MessageCircle, Sparkles, Sprout, Shapes, TrendingUp } from "lucide-react";

/**
 * Painel de assinatura — aparece quando o período grátis acabou e a pessoa
 * tenta uma ação. Em vez de um erro seco, VENDE a Kolo: mostra os benefícios
 * e leva pra /assinatura. Reutilizável (Estratégias, conversa, registro…).
 */
const BENEFICIOS: { Icon: typeof Sprout; titulo: string; desc: string; chip: string }[] = [
  {
    Icon: MessageCircle,
    titulo: "Ayla no WhatsApp",
    desc: "Estratégia na hora do desafio, montar a rotina e tirar dúvidas — no seu dia a dia.",
    chip: "bg-brand-purple/10 text-brand-purple",
  },
  {
    Icon: Sparkles,
    titulo: "Estratégias e planos",
    desc: "Um caminho prático pra cada desafio, pensado pro jeito do seu filho.",
    chip: "bg-cat-foco-bg text-cat-foco",
  },
  {
    Icon: Sprout,
    titulo: "Perfil vivo",
    desc: "A Kolo aprende sobre ele e fica mais certeira a cada conversa.",
    chip: "bg-cat-social-bg text-cat-social",
  },
  {
    Icon: Shapes,
    titulo: "Rotina visual e histórias",
    desc: "Cartões ilustrados pra imprimir e histórias com ele de protagonista.",
    chip: "bg-cat-sensorial-bg text-cat-sensorial",
  },
  {
    Icon: TrendingUp,
    titulo: "Evolução ao longo do tempo",
    desc: "O que muda, o que floresce — o caminho de vocês, guardado.",
    chip: "bg-cat-motor-bg text-cat-motor",
  },
];

export function PaywallAssine({
  titulo = "Seu período grátis acabou",
  subtitulo = "Continue com a Kolo pertinho de vocês — é ela que segura sua mão no dia a dia.",
}: {
  titulo?: string;
  subtitulo?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/[0.12] via-kolo-lilas-bg-2/40 to-white p-6 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_8px_28px_rgba(46,10,82,0.06)] md:p-8">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-brand-yellow/20 blur-3xl"
      />
      <div className="relative">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-purple">
          Kolo Família
        </span>
        <h2 className="mt-2 font-heading text-2xl text-foreground md:text-3xl">
          {titulo} <span aria-hidden style={{ color: "#FFBA00" }}>🌿</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-[15px]">
          {subtitulo}
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {BENEFICIOS.map(({ Icon, titulo: t, desc, chip }) => (
            <li
              key={t}
              className="flex gap-3 rounded-2xl border border-foreground/[0.05] bg-white/70 p-3.5"
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${chip}`}>
                <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href="/assinatura"
            className="inline-flex items-center gap-2 rounded-full bg-brand-purple px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02]"
          >
            Assinar agora
            <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
          </Link>
          <span className="text-[13px] text-muted-foreground">
            Seu histórico e o perfil do seu filho ficam guardados. 💛
          </span>
        </div>
      </div>
    </section>
  );
}
