import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Cookies · Kolo Família",
  description:
    "Quais cookies o Kolo Família usa e como controlar suas preferências.",
};

export default function CookiesPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Política de Cookies
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: 8 de maio de 2026
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-lg font-semibold">O que são</h2>
          <p>
            Cookies são pequenos arquivos guardados no seu navegador que
            permitem o site funcionar e lembrar preferências.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Cookies que usamos</h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Essenciais (sempre ativos):</strong> autenticação
              (sessão Supabase), preferências de tema, registro de aceite de
              termos. Sem eles o site não funciona.
            </li>
            <li>
              <strong>Funcionais:</strong> lembrar o último membro foco,
              estado de banners (NPS, lembretes). Você pode limpar pelo
              navegador a qualquer hora.
            </li>
            <li>
              <strong>Análise de performance (opcional):</strong> métricas
              agregadas de uso pra melhorar a plataforma. Não armazenamos
              identificador pessoal sem consentimento.
            </li>
          </ul>
          <p>
            <strong>Não usamos cookies de publicidade ou rastreamento de
            terceiros.</strong>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Como controlar</h2>
          <p>
            Você pode bloquear ou apagar cookies pelas configurações do seu
            navegador. Bloquear cookies essenciais quebra o login. Bloquear
            funcionais pode tirar pequenas conveniências, mas o serviço
            continua operando.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Mais informações</h2>
          <p>
            Ver também{" "}
            <a href="/privacidade" className="underline underline-offset-2">
              Política de Privacidade
            </a>{" "}
            e{" "}
            <a href="/termos" className="underline underline-offset-2">
              Termos de Uso
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
