import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sobre · Kolo Família",
  description:
    "Quem está por trás do Kolo Família e por que ele existe.",
};

// Lê de sobre_plataforma — admin pode editar texto sem redeploy
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

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Sobre o Kolo Família
        </h1>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        {promessa && (
          <section>
            <pre className="whitespace-pre-wrap font-sans text-base">
              {promessa}
            </pre>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold">Por que existe</h2>
          <p>
            Famílias com filhos atípicos têm muito apoio fragmentado — um
            terapeuta aqui, uma escola ali, conteúdos avulsos em redes sociais
            — mas pouca <strong>orientação no dia a dia</strong>, no momento
            em que a coisa acontece. O Kolo Família junta organização,
            personalização e acolhimento num só lugar, no canal onde a
            família já está: o WhatsApp, com um app PWA pra pôr ordem no que
            foi conversado.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Princípios</h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Hipótese, não diagnóstico.</strong> A IA observa
              padrões; o profissional clínico é quem fecha qualquer hipótese
              em diagnóstico.
            </li>
            <li>
              <strong>A mãe escolhe.</strong> Adaptações automáticas só
              entram com OK explícito. Tudo é reversível.
            </li>
            <li>
              <strong>Sem terror.</strong> Linguagem que organiza sem
              alarmar. A vida já é cheia de informação preocupante.
            </li>
            <li>
              <strong>Privacidade é regra.</strong> Nem nossa equipe
              consulta o conteúdo do seu diário. Relatórios só com seu
              link.
            </li>
            <li>
              <strong>Onde a família já está.</strong> A Ayla no WhatsApp
              respeita pausa, silêncio e horário; nunca insiste.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Quem está por trás</h2>
          <p>
            Karina — mãe atípica, fundadora — desenhou a metodologia depois
            de anos navegando o ecossistema clínico, escolar e de redes
            sociais com a própria filha. O Kolo Família traz isso pra um
            produto que cabe na sua semana, não num curso pra concluir.
          </p>
        </section>

        {disclaimer && (
          <section className="rounded-md border bg-muted/40 p-4">
            <p className="text-muted-foreground">{disclaimer}</p>
          </section>
        )}
      </div>
    </article>
  );
}
