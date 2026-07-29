import Link from "next/link";
import { ArrowRight, Lock, Sprout, Lightbulb, TrendingUp, Shapes, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Porta = {
  titulo: string;
  desc: string;
  href: string;
  Icon: typeof Sprout;
  bar: string;
  chip: string;
};

const PORTAS_BASE: Porta[] = [
  {
    titulo: "Perfil",
    desc: "Conte a socialização, a comunicação, o foco — as orientações saem daqui.",
    href: "/kolo-vivo",
    Icon: Sprout,
    bar: "bg-cat-social",
    chip: "bg-cat-social-bg text-cat-social",
  },
  {
    titulo: "Estratégias",
    desc: "Conte um desafio e receba um plano prático.",
    href: "/estrategias",
    Icon: Lightbulb,
    bar: "bg-cat-foco",
    chip: "bg-cat-foco-bg text-cat-foco",
  },
  {
    titulo: "Lúdico",
    desc: "Histórias, rotina visual, leitura dos desenhos e avatar.",
    href: "/ludico",
    Icon: Shapes,
    bar: "bg-cat-sensorial",
    chip: "bg-cat-sensorial-bg text-cat-sensorial",
  },
];

/**
 * "Tudo que dá pra fazer na Kolo" — atalhos explicados pras seções. Aparece
 * na Home de boas-vindas (recém-chegada) e também na engajada (pra quem ainda
 * não explorou tudo). Evolução fica travada até haver registros; a Ayla vira
 * atalho de ativação quando ainda não foi ligada.
 */
export function AtalhosKolo({
  titulo,
  evolucaoLocked,
  mostrarAtivarAyla,
}: {
  titulo: string;
  evolucaoLocked: boolean;
  /** true = Ayla nunca foi ativada → o card vira atalho de ativação (#ativar-ayla). */
  mostrarAtivarAyla: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-[2px] w-7 rounded-full bg-brand-yellow" />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {titulo}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PORTAS_BASE.map((p) => (
          <PortaLink key={p.href} porta={p} />
        ))}

        {/* Evolução — travada até haver registros. */}
        {evolucaoLocked ? (
          <div className="relative flex gap-4 overflow-hidden rounded-2xl border border-foreground/[0.06] bg-white/60 p-5 opacity-70">
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-cat-motor/50" />
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-cat-motor-bg text-cat-motor">
              <TrendingUp className="size-6" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <h3 className="flex items-center gap-1.5 font-heading text-lg font-medium text-foreground">
                Evolução <Lock className="size-3.5 text-muted-foreground" aria-hidden />
              </h3>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                O caminho ao longo das semanas. Aparece assim que você registrar alguns dias.
              </p>
            </div>
          </div>
        ) : (
          <PortaLink
            porta={{
              titulo: "Evolução",
              desc: "O caminho ao longo das semanas: o que mudou, o que floresceu.",
              href: "/evolucao",
              Icon: TrendingUp,
              bar: "bg-cat-motor",
              chip: "bg-cat-motor-bg text-cat-motor",
            }}
          />
        )}

        {/* Ayla — vira atalho de ativação quando ainda não foi ligada. */}
        {!mostrarAtivarAyla ? (
          <div className="relative flex gap-4 overflow-hidden rounded-2xl border border-brand-purple/15 bg-gradient-to-br from-brand-purple/[0.05] to-white p-5">
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand-purple" />
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple">
              <MessageCircle className="size-6" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <h3 className="font-heading text-lg font-medium text-foreground">Ayla no WhatsApp</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                Sua parceira no dia a dia — estratégia, rotina e dúvidas, na hora em que acontece.
              </p>
            </div>
          </div>
        ) : (
          <a
            href="#ativar-ayla"
            className="group relative flex gap-4 overflow-hidden rounded-2xl border border-brand-purple/20 bg-gradient-to-br from-brand-purple/[0.06] to-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(46,10,82,0.06)]"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand-purple" />
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple">
              <MessageCircle className="size-6" strokeWidth={1.8} aria-hidden />
            </span>
            <div className="flex-1">
              <h3 className="font-heading text-lg font-medium text-foreground">Ayla no WhatsApp</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                Ative pra pedir estratégia, montar a rotina e tirar dúvidas — na hora.
              </p>
            </div>
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center self-center rounded-full bg-brand-yellow text-brand-purple-dark transition-transform group-hover:translate-x-0.5"
            >
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </span>
          </a>
        )}
      </div>
    </section>
  );
}

function PortaLink({ porta }: { porta: Porta }) {
  const { titulo, desc, href, Icon, bar, chip } = porta;
  return (
    <Link
      href={href}
      className="group relative flex gap-4 overflow-hidden rounded-2xl border border-foreground/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)] transition-all hover:-translate-y-0.5 hover:border-brand-yellow/50 hover:shadow-[0_4px_12px_rgba(46,10,82,0.06),_0_12px_28px_rgba(46,10,82,0.06)]"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", bar)} />
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", chip)}>
        <Icon className="size-6" strokeWidth={1.8} aria-hidden />
      </span>
      <div className="flex-1">
        <h3 className="font-heading text-lg font-medium text-foreground">{titulo}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center self-center rounded-full bg-brand-yellow text-brand-purple-dark opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
      >
        <ArrowRight className="size-4" strokeWidth={2.5} />
      </span>
    </Link>
  );
}
