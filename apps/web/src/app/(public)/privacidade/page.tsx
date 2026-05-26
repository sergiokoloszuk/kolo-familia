import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Política de Privacidade · Kolo Família",
  description:
    "Como o Kolo Família coleta, usa, compartilha e protege os dados das famílias. Em conformidade com a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="mb-10 border-b border-kolo-linha pb-8">
        <Eyebrow>Documento legal</Eyebrow>
        <h1 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
          Política de{" "}
          <em className="not-italic text-brand-purple">Privacidade</em>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última atualização: 23 de maio de 2026
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-lg font-semibold">1. Compromisso com a Privacidade</h2>
          <p>
            A Kolo compromete-se com a privacidade, segurança e proteção dos
            dados compartilhados pelas famílias, em conformidade com a{" "}
            <strong>Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018)</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Quais dados coletamos?</h2>
          <p>
            Coletamos apenas informações necessárias para funcionamento e
            personalização do serviço.
          </p>
          <p className="font-medium">Dados do responsável:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>nome;</li>
            <li>telefone (WhatsApp);</li>
            <li>e-mail.</li>
          </ul>
          <p className="font-medium">Dados da criança (quando compartilhados):</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>primeiro nome;</li>
            <li>idade;</li>
            <li>rotina;</li>
            <li>preferências;</li>
            <li>desenvolvimento;</li>
            <li>
              informações sobre comportamento ou desafios relatados pelo
              responsável.
            </li>
          </ul>
          <p>
            Esses dados podem incluir informações classificadas como{" "}
            <strong>dados pessoais sensíveis</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Para que utilizamos os dados?</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Personalização:</strong> adaptar respostas considerando
              histórico e contexto compartilhado.
            </li>
            <li>
              <strong>Prestação do serviço:</strong> fornecer suporte e
              funcionamento da plataforma.
            </li>
            <li>
              <strong>Comunicação:</strong> enviar mensagens relacionadas ao uso
              do Kolo Família.
            </li>
            <li>
              <strong>Melhoria:</strong> aprimorar a qualidade da experiência por
              meio de análises agregadas ou anonimizadas.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Compartilhamento de Dados</h2>
          <p>
            Os dados não são vendidos nem compartilhados para fins publicitários.
          </p>
          <p>
            Podemos utilizar fornecedores tecnológicos necessários para operação
            do serviço (como infraestrutura ou processamento técnico da IA),
            adotando medidas de proteção adequadas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Armazenamento e Segurança</h2>
          <p>
            Adotamos medidas técnicas e administrativas para reduzir riscos
            relacionados a acesso indevido, alteração, perda ou uso não
            autorizado.
          </p>
          <p>
            Embora utilizemos mecanismos de segurança, nenhum sistema é
            totalmente imune a riscos. Mas proteção de dados faz parte do
            compromisso da Kolo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Direitos do Usuário (LGPD)</h2>
          <p>Você pode solicitar:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>confirmação do tratamento;</li>
            <li>acesso aos dados;</li>
            <li>correção;</li>
            <li>exclusão;</li>
            <li>revogação de consentimento;</li>
            <li>informações sobre compartilhamento;</li>
            <li>demais direitos previstos pela LGPD.</li>
          </ul>
          <p>Solicitações podem ser feitas pelos canais oficiais de suporte.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Exclusão de Dados</h2>
          <p>
            Você pode solicitar a exclusão dos seus dados enviando:{" "}
            <strong>&quot;Excluir meus dados&quot;</strong>.
          </p>
          <p>A exclusão ocorrerá conforme exigências legais aplicáveis.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Contato</h2>
          <p>
            Para dúvidas, solicitações ou exercício dos direitos previstos na
            LGPD:{" "}
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
