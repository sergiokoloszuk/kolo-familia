import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { isBetaGateAtivo } from "@/lib/beta/codigos";
import { cn } from "@/lib/utils";

export default async function Home() {
  const gateBeta = isBetaGateAtivo();
  const ctaPrincipalHref = gateBeta ? "/lista-espera" : "/signup";
  const ctaPrincipalLabel = gateBeta
    ? "Entrar na lista de espera"
    : "Começar 30 dias grátis";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: family } = await supabase
      .from("family_accounts")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!family || !family.onboarding_completed) redirect("/onboarding");
    redirect("/painel");
  }

  // Depoimentos curados (vazio é ok)
  const { data: depoimentos } = await supabase
    .from("depoimentos")
    .select("id, nome_publico, texto, perfil_resumo")
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(3);

  return (
    <>
      {/* HERO */}
      <section className="border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16 md:py-24">
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-6xl">
            Cuidado todo dia.
            <br />
            Onde você já está.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
            O Kolo Família organiza a rotina das famílias atípicas — TEA, TDAH,
            dislexia, AH/SD. Acolhimento e orientação no WhatsApp, conteúdo
            personalizado no app, e relatórios prontos pra terapeutas e escola.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={ctaPrincipalHref}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              {ctaPrincipalLabel}
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
              )}
            >
              Já tenho conta
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            {gateBeta
              ? "Estamos em beta fechado. Entre na lista pra receber código quando abrirmos vagas."
              : "Sem cartão de crédito. Cancela quando quiser."}{" "}
            O Kolo Família não substitui profissionais da saúde.
          </p>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Como funciona
          </h2>
          <p className="mt-2 text-muted-foreground">
            Três peças trabalhando juntas. Você não precisa escolher por qual
            canal vai falar com a IA.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">App (PWA)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Painel diário, perfil progressivo da família, aulas, galeria de
                imagens das brincadeiras e atividades.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ayla no WhatsApp</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                A Ayla pergunta como foi o dia, organiza o registro e percebe
                padrões. Acolhe primeiro, organiza depois.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Especialistas</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Quando você pergunta algo específico, o sistema escolhe quem
                responde — regulação, comunicação, sono — sem você ter que
                escolher canal.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* O QUE VOCÊ RECEBE */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            O que você recebe
          </h2>
          <ul className="mt-6 grid gap-4 text-sm md:grid-cols-2">
            {[
              [
                "Brincadeiras, atividades e crenças personalizadas",
                "Cada conteúdo é gerado pelo perfil vivo da sua família — não conteúdo genérico.",
              ],
              [
                "Histórias sociais e roteiros prontos",
                "Pra ajudar com transições, novidades e situações desafiadoras.",
              ],
              [
                "DASS-21 in-app",
                "Instrumento validado em PT-BR pra acompanhar como VOCÊ está, não só a criança.",
              ],
              [
                "Relatórios pra terapeuta e escola",
                "Link vivo ou PDF — comunicação clara e prática.",
              ],
              [
                "Adaptações reversíveis",
                "Sugestões automáticas que entram no seu Kolo Vivo só com seu OK; reverter é um clique.",
              ],
              [
                "Sem aula obrigatória",
                "Você não precisa estudar pra usar. O sistema entende e responde.",
              ],
            ].map(([titulo, texto]) => (
              <li key={titulo} className="rounded-md border bg-card p-4">
                <p className="font-medium">{titulo}</p>
                <p className="mt-1 text-muted-foreground">{texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      {depoimentos && depoimentos.length > 0 && (
        <section className="border-b">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              Quem usa
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {depoimentos.map((d) => (
                <figure
                  key={d.id}
                  className="rounded-md border bg-card p-4 text-sm"
                >
                  <blockquote className="italic text-muted-foreground">
                    “{d.texto}”
                  </blockquote>
                  <figcaption className="mt-3 font-medium">
                    {d.nome_publico}
                    {d.perfil_resumo && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {d.perfil_resumo}
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Perguntas frequentes
          </h2>
          <div className="mt-6 flex flex-col gap-3">
            {[
              [
                "É um diagnóstico?",
                "Não. O Kolo Família é apoio educacional e organizacional. Quem diagnostica é profissional de saúde — médico, psicólogo, terapeuta. O que entregamos são hipóteses e organização do dia, sempre revisadas por você.",
              ],
              [
                "Como funciona a Ayla no WhatsApp?",
                "Você autoriza a Ayla na primeira conversa. Ela manda no máximo 2 mensagens proativas por dia, respeita pausas e silêncio, e não insiste depois de 10 dias sem resposta. Você pode pausar, mudar horário ou sair quando quiser.",
              ],
              [
                "Os dados da minha família ficam seguros?",
                "Os dados são só da sua família — nem nossa equipe consulta o conteúdo do seu diário. Os relatórios pra terapeuta e escola só vão se você gerar o link e compartilhar. Tudo conforme a LGPD.",
              ],
              [
                "Quanto custa?",
                "Trial de 30 dias grátis sem cartão. Depois do trial, mensalidade única. Detalhes em /precos.",
              ],
              [
                "Posso cancelar?",
                "A qualquer momento. Você mantém acesso ao seu histórico e aos dados gerados.",
              ],
            ].map(([q, a]) => (
              <details
                key={q}
                className="rounded-md border bg-card px-4 py-3 text-sm"
              >
                <summary className="cursor-pointer font-medium">{q}</summary>
                <p className="mt-2 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-16 text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {gateBeta ? "Entre na lista de espera" : "Comece com 30 dias grátis"}
          </h2>
          <p className="text-muted-foreground">
            {gateBeta
              ? "Beta fechado. Te aviso por e-mail quando abrirem vagas."
              : "Sem cartão. Você decide se vale antes de pagar."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={ctaPrincipalHref}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              {ctaPrincipalLabel}
            </Link>
            <Link
              href="/contato"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
              )}
            >
              Falar com a gente
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
