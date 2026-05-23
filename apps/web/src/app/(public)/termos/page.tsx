import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Termos de Uso · Kolo Família",
  description:
    "Termos de uso do Kolo Família — natureza e limites do serviço, uso de IA, dados de crianças, assinatura e cancelamento.",
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
          Última atualização: 23 de maio de 2026
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-lg font-semibold">1. Aceitação dos Termos</h2>
          <p>
            Ao iniciar ou utilizar o Kolo Família, você declara que leu,
            compreendeu e concorda com estes Termos de Uso.
          </p>
          <p>
            Ao utilizar a plataforma, você também declara ser maior de 18 anos
            ou responsável legal autorizado a compartilhar informações da
            criança acompanhada.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Natureza do Serviço</h2>
          <p>
            O Kolo Família é uma ferramenta prática de apoio diário para
            famílias de crianças neurodivergentes. Combina inteligência
            artificial treinada com fundamentação especializada, registro
            contextual e estratégias para transformar observações do dia a dia
            em direção concreta.
          </p>
          <p>
            O Kolo Família existe para que nenhuma família atravesse a jornada
            da inclusão sozinha, sem direção ou sem apoio disponível.
          </p>
          <p>
            O serviço pode ser disponibilizado via WhatsApp ou outros canais
            digitais da Kolo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">
            3. Limites do Serviço (Importante)
          </h2>
          <p>
            O Kolo Família foi criado para apoiar o cotidiano entre consultas,
            terapias e momentos de dúvida — onde muitas famílias ficam sem
            direção.
          </p>
          <p>O Kolo Família:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li><strong>NÃO</strong> realiza diagnósticos;</li>
            <li>
              <strong>NÃO</strong> substitui médicos, psicólogos,
              fonoaudiólogos, terapeutas ocupacionais, neuropsicólogos ou outros
              profissionais;
            </li>
            <li><strong>NÃO</strong> prescreve medicamentos ou tratamentos;</li>
            <li><strong>NÃO</strong> emite laudos clínicos;</li>
            <li>
              <strong>NÃO</strong> substitui terapias ou acompanhamento
              especializado.
            </li>
          </ul>
          <p>
            Em situações que envolvam risco, sofrimento intenso, autolesão ou
            emergência médica, procure atendimento profissional imediatamente.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">
            4. Uso da Inteligência Artificial
          </h2>
          <p>
            Ao utilizar o Kolo Família, você reconhece que interage com um
            sistema baseado em Inteligência Artificial.
          </p>
          <p>
            Embora treinada com fundamentação especializada, a IA pode
            apresentar limitações e nem toda sugestão será adequada para todos
            os contextos individuais.
          </p>
          <p>
            A decisão de aplicar qualquer orientação permanece sob
            responsabilidade do responsável legal da criança.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">
            5. Dados Compartilhados sobre Crianças
          </h2>
          <p>
            Ao inserir informações relacionadas à criança, o usuário declara
            possuir legitimidade para compartilhar esses dados e autoriza seu
            tratamento para personalização do serviço.
          </p>
          <p>
            A Kolo realiza o tratamento considerando o{" "}
            <strong>melhor interesse da criança</strong>, conforme a LGPD.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">
            6. Teste Gratuito e Assinaturas
          </h2>
          <p>
            O Kolo Família poderá oferecer períodos gratuitos ou promocionais.
          </p>
          <p>Após o término do período disponibilizado:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>o acesso poderá ser encerrado;</li>
            <li>poderá ser necessária assinatura paga;</li>
            <li>valores e condições poderão ser alterados futuramente.</li>
          </ul>
          <p>
            Mudanças relevantes serão comunicadas previamente quando aplicável.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Cancelamento</h2>
          <p>
            O usuário poderá solicitar o encerramento da utilização do serviço a
            qualquer momento pelos canais oficiais da Kolo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Propriedade Intelectual</h2>
          <p>
            A marca Kolo, metodologia, tecnologia, identidade visual, conteúdos
            e estrutura pertencem exclusivamente à Kolo.
          </p>
          <p>É proibida reprodução, distribuição ou uso comercial sem autorização.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Atualizações dos Termos</h2>
          <p>Os presentes Termos poderão ser atualizados periodicamente.</p>
          <p>A continuidade do uso representa concordância com as versões vigentes.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Contato</h2>
          <p>
            Dúvidas?{" "}
            <a
              href="mailto:kolosuporte@gmail.com"
              className="underline underline-offset-2"
            >
              kolosuporte@gmail.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
