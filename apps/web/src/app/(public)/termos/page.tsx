import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Termos de Uso · Kolo Família",
  description:
    "Termos de uso da plataforma Kolo Família. Direitos e deveres de usuárias, limites do serviço e regras de cancelamento.",
};

export default function TermosPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="mb-10 border-b border-kolo-linha pb-8">
        <Eyebrow>Documento legal</Eyebrow>
        <h1 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
          Termos de{" "}
          <em className="not-italic text-brand-purple">Uso</em>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 8 de maio de 2026
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-lg font-semibold">1. O que é o Kolo Família</h2>
          <p>
            O Kolo Família é uma plataforma de apoio educacional e
            organizacional para famílias com pelo menos um membro
            neurodivergente. Oferece registro do dia a dia, conteúdos
            personalizados, conversa via WhatsApp com a Ayla, e relatórios pra
            terapeutas e escola.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Não é serviço de saúde</h2>
          <p>
            <strong>O Kolo Família não diagnostica e não trata.</strong>{" "}
            Diagnóstico e tratamento são exclusivos de profissionais de saúde
            (médicos, psicólogos, terapeutas, fonoaudiólogos). Tudo que a
            plataforma entrega — incluindo padrões detectados, hipóteses e
            sugestões — é apoio educacional. Sempre revise com o profissional
            que acompanha a sua família.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Cadastro</h2>
          <p>
            Você é responsável pela veracidade do cadastro e pela guarda da
            sua senha. O cadastro é pessoal e intransferível. Você precisa ser
            maior de 18 anos pra criar conta. O serviço é destinado a pais ou
            responsáveis — não a crianças.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Trial e assinatura</h2>
          <p>
            O trial é de 30 dias sem cartão. Findo o trial, é necessária
            assinatura ativa pra continuar usando. Cancela a qualquer momento
            por <code>/assinatura</code>. Cobranças passadas não são
            reembolsadas, mas o acesso permanece até o fim do período pago.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Conduta</h2>
          <p>Você concorda em não:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Compartilhar conteúdo ilegal, ofensivo ou que infrinja direitos
              de terceiros.
            </li>
            <li>
              Fazer engenharia reversa, raspar dados em massa ou tentar
              comprometer a segurança do sistema.
            </li>
            <li>
              Usar a plataforma pra prestar serviços de saúde a terceiros sem
              autorização profissional adequada.
            </li>
          </ul>
          <p>
            Violações podem levar à suspensão da conta e, em casos graves, à
            comunicação às autoridades.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Conteúdo gerado</h2>
          <p>
            O conteúdo personalizado (brincadeiras, atividades, etc.) é
            licenciado pra uso pessoal e familiar. Você não pode revender,
            redistribuir comercialmente ou usar como serviço pra terceiros.
            Os textos da fundadora e a metodologia são protegidos por direito
            autoral.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. IA e geração automática</h2>
          <p>
            Parte do conteúdo é gerado por modelos de IA (Anthropic, OpenAI).
            Modelos podem cometer erros. Sugestões de adaptações sempre são
            apresentadas pra você revisar antes de qualquer mudança no seu
            Kolo Vivo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida pela lei, o Kolo Família não responde
            por danos indiretos, lucros cessantes ou decisões clínicas tomadas
            com base em conteúdo da plataforma. A responsabilidade total da
            plataforma fica limitada ao valor pago pela usuária nos últimos 12
            meses.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Mudanças no serviço</h2>
          <p>
            Podemos atualizar funcionalidades, preços e estes termos. Mudanças
            relevantes são avisadas por e-mail e ficam registradas aqui com a
            data atualizada. Se você não concordar com mudanças, pode cancelar
            sem penalidade.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Lei e foro</h2>
          <p>
            Este contrato é regido pelas leis da República Federativa do
            Brasil. Fica eleito o foro do domicílio da usuária pra resolver
            qualquer questão relativa a estes termos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">11. Contato</h2>
          <p>
            Dúvidas?{" "}
            <a
              href="mailto:contato@kolofamilia.com.br"
              className="underline underline-offset-2"
            >
              contato@kolofamilia.com.br
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
