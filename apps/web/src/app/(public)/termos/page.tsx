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
          Versão de 23 de outubro de 2026
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-lg font-semibold">1. Aceitação dos Termos</h2>
          <p>
            O Kolo Família é oferecido por Kolo Academy Ltda., CNPJ
            60.374.232/0001-31, Rua Nagel, 33, Apto 82 Bloco 2, Vila
            Leopoldina, São Paulo/SP, CEP 05315-030.
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
            artificial, fundamentação especializada, registro
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
            O teste normal é de 7 dias. Não é necessário cadastrar cartão para
            começar e o término do teste não gera cobrança automática.
          </p>
          <p>Na Black Friday 2026:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>o teste é de 15 dias completos;</li>
            <li>o plano promocional é mensal, por R$ 39,90;</li>
            <li>assinar durante o teste preserva os dias restantes e adia a primeira cobrança para o fim do teste;</li>
            <li>as demais condições constam no <a href="/black-friday-2026/regulamento" className="underline">Regulamento da Black Friday 2026</a>.</li>
          </ul>
          <p>
            A assinatura renova mensalmente até o cancelamento. O checkout
            apresenta preço, periodicidade e data da primeira cobrança antes da
            confirmação.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Cancelamento</h2>
          <p>
            O cancelamento é feito na plataforma, sem multa e sem necessidade de
            falar com o suporte. Ele impede cobranças futuras; quando já existe
            um período pago, o acesso permanece até o final dele.
          </p>
          <p>
            Depois do fim do acesso pago, os dados familiares são excluídos,
            ressalvados somente registros mínimos que precisem ser conservados
            por obrigação legal ou defesa de direitos. A pessoa pode exportar
            os dados disponíveis antes da exclusão.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Propriedade Intelectual</h2>
          <p>
            A contratação dá licença de acesso, não transfere o software, a
            marca ou materiais protegidos da Kolo e de seus licenciantes.
          </p>
          <p>
            A família pode baixar, imprimir e usar atividades e relatórios nas
            finalidades oferecidas, inclusive compartilhar o relatório da
            criança com profissionais autorizados. São proibidas a revenda, a
            distribuição comercial, a extração ilícita e a cópia indevida do
            software ou de materiais protegidos. Ideias gerais, conhecimentos
            públicos e criação independente lícita não são apropriados pela Kolo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Atualizações dos Termos</h2>
          <p>Mudanças relevantes serão informadas em linguagem simples e não retiram retroativamente condições já contratadas.</p>
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
