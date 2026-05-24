import { Eyebrow } from "@/components/brand/eyebrow";
import { AjudaClient } from "./ajuda-client";

export const metadata = {
  title: "Ajuda — Kolo Família",
};

export default function AjudaPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <Eyebrow>Ajuda</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          O que você quer{" "}
          <em className="not-italic text-brand-purple">fazer</em>?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Escreve com suas palavras e eu te digo em qual tela ir e o passo a
          passo.
        </p>
      </header>

      <AjudaClient />
    </div>
  );
}
