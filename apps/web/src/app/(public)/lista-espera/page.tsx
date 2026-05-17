import type { Metadata } from "next";
import { Clock, Sparkles, Users } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { ListaEsperaForm } from "./lista-espera-form";

export const metadata: Metadata = {
  title: "Lista de espera · Kolo Família",
  description:
    "Estamos em beta fechado. Entre na lista pra receber convite quando abrirmos novas vagas.",
};

export default function ListaEsperaPage() {
  return (
    <>
      {/* HERO lista de espera — roxo deep com pontilhado amarelo (Manual §11). */}
      <section className="relative overflow-hidden bg-brand-purple-deep text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,186,0,0.14) 1.2px, transparent 1.2px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto w-full max-w-3xl px-6 py-20 text-center md:px-8 md:py-24">
          <Eyebrow tone="dark">Beta fechado</Eyebrow>
          <h1 className="mt-4 font-heading text-4xl text-white md:text-5xl">
            Entre na{" "}
            <em className="not-italic text-brand-yellow">lista de espera</em>.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Estamos em beta por enquanto pra cuidar bem das primeiras famílias.
            Quando abrirmos novas vagas, você recebe o código por e-mail.
          </p>
        </div>
      </section>

      {/* FORM — lilás. */}
      <section className="bg-kolo-lilas-2">
        <div className="mx-auto w-full max-w-2xl px-6 py-16 md:px-8 md:py-20">
          <div className="rounded-3xl bg-white p-8 shadow-lg md:p-10">
            <h2 className="font-heading text-2xl text-foreground">
              Quero saber quando abrir
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O contexto da sua família é opcional, mas ajuda a gente a entender
              quem vem chegando.
            </p>
            <div className="mt-6">
              <ListaEsperaForm />
            </div>
          </div>
        </div>
      </section>

      {/* O QUE ESPERAR — branco, 3 cards reassurance. */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="justify-center">O que esperar</Eyebrow>
            <h2 className="mt-4 font-heading text-3xl text-foreground md:text-4xl">
              Cuidamos das{" "}
              <em className="not-italic text-brand-purple">primeiras famílias</em>{" "}
              com calma.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-3xl bg-kolo-lilas-bg-2 p-8">
              <IconCard tone="light">
                <Users aria-hidden />
              </IconCard>
              <h3 className="font-heading text-xl text-foreground">
                Vagas limitadas
              </h3>
              <p className="text-muted-foreground">
                Abrimos pouco a cada ciclo pra garantir suporte humano de
                verdade pra quem entra.
              </p>
            </div>
            <div className="flex flex-col gap-4 rounded-3xl bg-kolo-lilas-bg-2 p-8">
              <IconCard tone="light">
                <Sparkles aria-hidden />
              </IconCard>
              <h3 className="font-heading text-xl text-foreground">
                Convite por e-mail
              </h3>
              <p className="text-muted-foreground">
                Quando sua vez chegar, você recebe um código pra criar sua
                conta com 30 dias grátis.
              </p>
            </div>
            <div className="flex flex-col gap-4 rounded-3xl bg-kolo-lilas-bg-2 p-8">
              <IconCard tone="light">
                <Clock aria-hidden />
              </IconCard>
              <h3 className="font-heading text-xl text-foreground">
                Sem pressa
              </h3>
              <p className="text-muted-foreground">
                Você decide quando ativar o convite. Ele fica disponível por 30
                dias depois do envio.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
