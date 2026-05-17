import type { Metadata } from "next";
import { Mail, Shield } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { ContatoForm } from "./contato-form";

export const metadata: Metadata = {
  title: "Contato · Kolo Família",
  description:
    "Fale com a equipe do Kolo Família. Dúvidas, sugestões, parcerias com escolas ou consultórios.",
};

export default function ContatoPage() {
  return (
    <>
      {/* HERO contato — lilás suave. */}
      <section className="bg-kolo-lilas-2">
        <div className="mx-auto w-full max-w-3xl px-6 py-20 text-center md:px-8 md:py-24">
          <Eyebrow className="justify-center">Fala com a gente</Eyebrow>
          <h1 className="mt-4 font-heading text-4xl text-foreground md:text-5xl">
            A equipe{" "}
            <em className="not-italic text-brand-purple">lê tudo</em>.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Pra suporte de conta existente, acesse{" "}
            <a
              href="/login"
              className="text-brand-purple underline underline-offset-2 hover:text-brand-purple-dark"
            >
              entrar
            </a>{" "}
            e use o link de ajuda dentro do app.
          </p>
        </div>
      </section>

      {/* FORM — branco, card com sombra suave. */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 md:px-8 md:py-16">
          <div className="rounded-3xl bg-kolo-lilas-bg-2 p-8 md:p-10">
            <h2 className="font-heading text-2xl text-foreground">
              Manda uma mensagem
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pra dúvidas, sugestões ou parcerias com escolas/consultórios.
            </p>
            <div className="mt-6">
              <ContatoForm />
            </div>
          </div>

          {/* Outras formas de contato — Manual §17 emails específicos. */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-kolo-linha bg-white p-6">
              <div className="flex items-start gap-3">
                <span className="icon-card-kolo size-10 rounded-xl [&_svg]:size-5">
                  <Mail aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-purple">
                    Geral
                  </p>
                  <a
                    href="mailto:contato@kolofamilia.com.br"
                    className="mt-1 inline-block text-sm font-semibold text-foreground hover:text-brand-purple-dark"
                  >
                    contato@kolofamilia.com.br
                  </a>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-kolo-linha bg-white p-6">
              <div className="flex items-start gap-3">
                <span className="icon-card-kolo size-10 rounded-xl [&_svg]:size-5">
                  <Shield aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-purple">
                    Privacidade · DPO
                  </p>
                  <a
                    href="mailto:dpo@kolofamilia.com.br"
                    className="mt-1 inline-block text-sm font-semibold text-foreground hover:text-brand-purple-dark"
                  >
                    dpo@kolofamilia.com.br
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
