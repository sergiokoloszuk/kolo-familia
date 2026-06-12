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
          O tempo vira um <em className="not-italic text-brand-purple">arco-íris</em>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Escolha quanto tempo e o que vem depois. As cores do arco-íris vão chegando uma por
          uma — quando ele fica completo, o tempo acabou. A criança vê o fim se formar e sabe,
          desde o começo, o que vem na sequência. Previsibilidade pra transições sem susto.
        </p>
      </header>

      <TimerClient />
    </div>
  );
}
