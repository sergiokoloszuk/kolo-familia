import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TimerClient } from "./timer-client";

export default function TimerPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <Link
        href="/ludico"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-3" /> Lúdico
      </Link>

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-purple">
          Timer lúdico
        </p>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          O tempo vira uma <em className="not-italic text-brand-purple">jornada</em>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Escolha um tema, quanto tempo e o que vem depois. A criança vê o personagem
          avançar até o destino — e sabe, desde o começo, como vai ser o fim e o que vem na
          sequência. Previsibilidade pra transições sem susto.
        </p>
      </header>

      <TimerClient />
    </div>
  );
}
