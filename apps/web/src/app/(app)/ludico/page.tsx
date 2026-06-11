import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ListChecks,
  Palette,
  Timer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";

/**
 * Lúdico — seção que agrupa as ferramentas visuais/experienciais com o avatar
 * no centro: Histórias, Rotinas visuais, e (em breve) Meditação guiada e o
 * Timer lúdico. Apoio pelo brincar e imaginar.
 */

type Card = {
  titulo: string;
  desc: string;
  icone: LucideIcon;
  href?: string;
  tone: { bar: string; chip: string };
  status?: "em breve";
};

const CARDS: Card[] = [
  {
    titulo: "Histórias",
    desc: "Uma história ilustrada com o avatar pra antecipar um momento, ensaiar uma situação ou celebrar uma conquista.",
    icone: BookOpen,
    href: "/historias",
    tone: { bar: "bg-cat-sensorial", chip: "bg-cat-sensorial-soft text-cat-sensorial" },
  },
  {
    titulo: "Rotinas visuais",
    desc: "A sequência do dia com o avatar — a criança aponta o que vem; o adolescente consulta e marca sozinho. Dá pra imprimir.",
    icone: ListChecks,
    href: "/ludico/rotinas",
    tone: { bar: "bg-cat-foco", chip: "bg-cat-foco-soft text-cat-foco" },
  },
  {
    titulo: "O que o desenho conta?",
    desc: "Envie a foto de um desenho e receba uma leitura cuidadosa (sem rótulos) — o que aparece, possíveis leituras e perguntas pra explorar. Fica guardado com a data.",
    icone: Palette,
    href: "/ludico/desenhos",
    tone: { bar: "bg-cat-emocao", chip: "bg-cat-emocao-soft text-cat-emocao" },
  },
  {
    titulo: "Meditação guiada",
    desc: "Visualizações curtas com o avatar — pra acalmar, ou pra imaginar algo desejado acontecendo antes de viver de verdade.",
    icone: Wind,
    tone: { bar: "bg-cat-emocao", chip: "bg-cat-emocao-soft text-cat-emocao" },
    status: "em breve",
  },
  {
    titulo: "Timer lúdico",
    desc: "O tempo vira história: o avatar se prepara, entra na piscina e nada até o fim da raia — e ali se passaram 10 minutos.",
    icone: Timer,
    tone: { bar: "bg-cat-rotina", chip: "bg-cat-rotina-soft text-cat-rotina" },
    status: "em breve",
  },
];

export default function LudicoPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-2xl">
        <Eyebrow>Lúdico</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Apoio pelo <em className="not-italic text-brand-purple">brincar e imaginar</em>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Recursos visuais com o avatar de cada um — pra preparar, seguir o dia, acalmar
          ou imaginar algo bom acontecendo. Pra diferentes momentos e necessidades.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icone;
          const inner = (
            <>
              <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", c.tone.bar)} />
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-xl",
                    c.tone.chip,
                  )}
                >
                  <Icon className="size-[20px]" strokeWidth={1.8} />
                </span>
                {c.status && (
                  <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Em breve
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-heading text-xl font-medium leading-snug text-foreground">
                {c.titulo}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {c.desc}
              </p>
              {c.href && (
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple transition-all group-hover:gap-2.5">
                  Abrir
                  <ArrowRight className="size-3" aria-hidden />
                </span>
              )}
            </>
          );
          const base =
            "group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white px-6 pb-6 pt-7 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)]";
          return (
            <li key={c.titulo}>
              {c.href ? (
                <Link
                  href={c.href}
                  className={cn(
                    base,
                    "transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(46,10,82,0.06),_0_12px_28px_rgba(46,10,82,0.06)]",
                  )}
                >
                  {inner}
                </Link>
              ) : (
                <div className={cn(base, "opacity-75")}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
