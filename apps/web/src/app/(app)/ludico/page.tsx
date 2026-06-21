import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ListChecks,
  Palette,
  Smile,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";

/**
 * Lúdico — seção que agrupa as ferramentas visuais/experienciais com o avatar
 * no centro: Histórias, Rotinas visuais e leitura de desenhos. Apoio pelo
 * brincar e imaginar.
 *
 * OCULTOS TEMPORARIAMENTE (decisão de produto, jun/2026): "Meditação guiada"
 * (/ludico/meditacao) e "Timer lúdico" (/ludico/timer). As rotas e todo o
 * código seguem intactos — só removemos os cards daqui. Pra retomar, basta
 * recolocar as entradas no array CARDS abaixo (ícones Wind e Timer da lucide).
 */

type Card = {
  titulo: string;
  desc: string;
  icone: LucideIcon;
  href?: string;
  tone: { bar: string; chip: string };
  status?: "em breve";
  /** Selo de destaque (ex.: "comece por aqui"). */
  destaque?: string;
  /** Mostra a etiqueta "Usa o avatar escolhido". */
  usaAvatar?: boolean;
};

const CARDS: Card[] = [
  {
    titulo: "Avatar",
    desc: "O personagem de tudo: crie uma vez (vários estilos 3D) e use nas Histórias e nas Rotinas. Você escolhe qual fica em uso.",
    icone: Smile,
    href: "/configuracoes/avatar",
    tone: { bar: "bg-cat-social", chip: "bg-cat-social-soft text-cat-social" },
    destaque: "comece por aqui",
  },
  {
    titulo: "Histórias",
    desc: "Uma história ilustrada pra antecipar um momento, ensaiar uma situação ou celebrar uma conquista.",
    icone: BookOpen,
    href: "/historias",
    tone: { bar: "bg-cat-sensorial", chip: "bg-cat-sensorial-soft text-cat-sensorial" },
    usaAvatar: true,
  },
  {
    titulo: "Rotinas visuais",
    desc: "A sequência do dia em cards — a criança aponta o que vem; o adolescente consulta e marca sozinho. Dá pra imprimir.",
    icone: ListChecks,
    href: "/ludico/rotinas",
    tone: { bar: "bg-cat-foco", chip: "bg-cat-foco-soft text-cat-foco" },
    usaAvatar: true,
  },
  {
    titulo: "O que o desenho conta?",
    desc: "Envie a foto de um desenho e receba uma leitura cuidadosa (sem rótulos) — o que aparece, possíveis leituras e perguntas pra explorar. Fica guardado com a data.",
    icone: Palette,
    href: "/ludico/desenhos",
    tone: { bar: "bg-cat-emocao", chip: "bg-cat-emocao-soft text-cat-emocao" },
  },
  // OCULTOS (jun/2026) — ver comentário no topo. Mantidos aqui comentados pra
  // retomar fácil:
  // {
  //   titulo: "Meditação guiada",
  //   desc: "Escolha uma intenção (acalmar, ensaiar um momento, dormir…) e a Kolo escreve uma meditação curta pra ler em voz alta — no jeito dela.",
  //   icone: Wind,
  //   href: "/ludico/meditacao",
  //   tone: { bar: "bg-cat-sono", chip: "bg-cat-sono-soft text-cat-sono" },
  // },
  // {
  //   titulo: "Timer lúdico",
  //   desc: "O tempo vira uma jornada: o personagem avança até o destino e a criança sabe, desde o início, como vai ser o fim e o que vem depois.",
  //   icone: Timer,
  //   href: "/ludico/timer",
  //   tone: { bar: "bg-cat-rotina", chip: "bg-cat-rotina-soft text-cat-rotina" },
  // },
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
          Crie o avatar de cada um e use nas histórias e rotinas — <strong className="font-medium text-foreground">o mesmo personagem em tudo</strong>. Recursos visuais pra preparar, seguir o dia ou imaginar algo bom.
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
                {c.destaque && (
                  <span className="rounded-full bg-brand-purple/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-purple">
                    {c.destaque}
                  </span>
                )}
                {c.status && (
                  <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Em breve
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-heading text-xl font-medium leading-snug text-foreground">
                {c.titulo}
              </h3>
              <div className="mt-2 flex flex-1 flex-col gap-2">
                <p className="text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
                {c.usaAvatar && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-cat-social-soft px-2 py-0.5 text-[11px] font-medium text-cat-social">
                    <Smile className="size-3" aria-hidden /> Usa o avatar escolhido
                  </span>
                )}
              </div>
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
