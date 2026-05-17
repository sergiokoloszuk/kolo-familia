import type { Metadata } from "next";
import { Heart, Shield, Sparkles, MessageCircle, FileText } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { Manifesto } from "@/components/brand/manifesto";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sobre · Kolo Família",
  description:
    "Quem está por trás do Kolo Família e por que ele existe.",
};

// Lê de sobre_plataforma — admin pode editar texto sem redeploy.
export const dynamic = "force-dynamic";

export default async function SobrePage() {
  const admin = createServiceRoleClient();
  const { data: textos } = await admin
    .from("sobre_plataforma")
    .select("chave, conteudo_md")
    .eq("publicado", true);

  const map = new Map<string, string>(
    (textos ?? []).map((t) => [t.chave as string, t.conteudo_md as string]),
  );
  const promessa = map.get("promessa");
  const disclaimer = map.get("disclaimer_clinico");

  const principios = [
    {
      icon: Sparkles,
      titulo: "Hipótese, não diagnóstico",
      texto:
        "A IA observa padrões; quem fecha qualquer hipótese em diagnóstico é o profissional clínico.",
    },
    {
      icon: Heart,
      titulo: "A mãe escolhe",
      texto:
        "Adaptações automáticas só entram com OK explícito. Tudo é reversível.",
    },
    {
      icon: FileText,
      titulo: "Sem terror",
      texto:
        "Linguagem que organiza sem alarmar. A vida já é cheia de informação preocupante.",
    },
    {
      icon: Shield,
      titulo: "Privacidade é regra",
      texto:
        "Nem nossa equipe consulta o conteúdo do seu diário. Relatórios só com seu link.",
    },
    {
      icon: MessageCircle,
      titulo: "Onde a família já está",
      texto:
        "A Ayla no WhatsApp respeita pausa, silêncio e horário. Nunca insiste.",
    },
  ];

  return (
    <>
      {/* HERO sobre — lilás suave com eyebrow + H1. */}
      <section className="bg-kolo-lilas-2">
        <div className="mx-auto w-full max-w-4xl px-6 py-20 text-center md:px-8 md:py-28">
          <Eyebrow className="justify-center">Sobre nós</Eyebrow>
          <h1 className="mt-4 font-heading text-4xl text-foreground md:text-6xl">
            Apoio que cabe{" "}
            <em className="not-italic text-brand-purple">na sua semana</em>.
          </h1>
          {promessa ? (
            <p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-lg text-muted-foreground">
              {promessa}
            </p>
          ) : (
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Famílias atípicas têm apoio fragmentado e pouca orientação no
              momento em que a coisa acontece. A gente junta organização,
              personalização e acolhimento num só lugar.
            </p>
          )}
        </div>
      </section>

      {/* POR QUE EXISTE — branco. */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-20 md:px-8 md:py-24">
          <Eyebrow>Por que existe</Eyebrow>
          <h2 className="mt-4 font-heading text-3xl text-foreground md:text-4xl">
            O ecossistema da família atípica{" "}
            <em className="not-italic text-brand-purple">é fragmentado</em>.
          </h2>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-foreground/85">
            <p>
              Famílias com filhos atípicos têm muito apoio fragmentado — um
              terapeuta aqui, uma escola ali, conteúdos avulsos em redes sociais
              — mas pouca <strong className="text-foreground">orientação no
              dia a dia</strong>, no momento em que a coisa acontece.
            </p>
            <p>
              O Kolo Família junta organização, personalização e acolhimento
              num só lugar, no canal onde a família já está: o WhatsApp, com um
              app PWA pra pôr ordem no que foi conversado.
            </p>
          </div>
        </div>
      </section>

      {/* PRINCÍPIOS — lilás, 5 cards. */}
      <section className="bg-kolo-lilas">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="justify-center">Princípios</Eyebrow>
            <h2 className="mt-4 font-heading text-3xl text-foreground md:text-5xl">
              Cinco regras que{" "}
              <em className="not-italic text-brand-purple">não negociamos</em>.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {principios.map(({ icon: Icon, titulo, texto }) => (
              <div
                key={titulo}
                className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <IconCard tone="light">
                  <Icon aria-hidden />
                </IconCard>
                <h3 className="font-heading text-xl text-foreground">
                  {titulo}
                </h3>
                <p className="text-muted-foreground">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MANIFESTO — frase-chave. */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-24">
          <Manifesto>Inclusão não é amor. É método</Manifesto>
        </div>
      </section>

      {/* QUEM ESTÁ POR TRÁS — branco, foco editorial. */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 md:px-8 md:py-20">
          <Eyebrow>Quem está por trás</Eyebrow>
          <h2 className="mt-4 font-heading text-3xl text-foreground md:text-4xl">
            Karina,{" "}
            <em className="not-italic text-brand-purple">mãe atípica e fundadora</em>.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-foreground/85">
            Karina desenhou a metodologia depois de anos navegando o ecossistema
            clínico, escolar e de redes sociais com a própria filha. O Kolo
            Família traz isso pra um produto que cabe na sua semana, não num
            curso pra concluir.
          </p>
        </div>
      </section>

      {/* DISCLAIMER CLÍNICO (se houver no DB). */}
      {disclaimer && (
        <section className="bg-kolo-lilas-2">
          <div className="mx-auto w-full max-w-3xl px-6 py-12 md:px-8">
            <div className="rounded-2xl border border-brand-yellow/30 bg-white p-6 text-sm text-muted-foreground">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-purple">
                Importante
              </p>
              <p>{disclaimer}</p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
