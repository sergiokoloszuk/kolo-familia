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
          Última atualização: 8 de maio de 2026
        </p>
      </header>

      <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-lg font-semibold">1. Quem somos</h2>
          <p>
            Kolo Família é uma plataforma de apoio educacional e organizacional
            para famílias com pelo menos um membro neurodivergente (TEA, TDAH,
            dislexia, AH/SD). Esta política descreve como tratamos seus dados
            em conformidade com a Lei Geral de Proteção de Dados (Lei
            13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Dados que coletamos</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Cadastro:</strong> e-mail e senha (criptografada).
            </li>
            <li>
              <strong>Perfil da família:</strong> nome, idade, características
              das pessoas atípicas, rotina, desafios e conquistas — só o que
              você decide registrar.
            </li>
            <li>
              <strong>Diários e check-ins:</strong> conteúdo voluntário que você
              registra no app ou via WhatsApp.
            </li>
            <li>
              <strong>WhatsApp:</strong> número e mensagens trocadas com a Ayla
              (apenas se você autorizar).
            </li>
            <li>
              <strong>DASS-21:</strong> respostas e pontuações (apenas se você
              optar por aplicar).
            </li>
            <li>
              <strong>Pagamento:</strong> processado pelo Stripe; nós não
              armazenamos dados de cartão.
            </li>
            <li>
              <strong>Operacional:</strong> logs de acesso, identificadores de
              dispositivo, navegador e endereço IP — para segurança e
              observabilidade.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Como usamos</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Personalizar o conteúdo (brincadeiras, atividades, etc.).</li>
            <li>
              Permitir que a Ayla converse com você no WhatsApp e organize seus
              registros.
            </li>
            <li>
              Gerar relatórios para terapeutas e escola — somente quando você
              cria e compartilha o link.
            </li>
            <li>
              Detectar padrões e propor adaptações reversíveis (sempre com seu
              OK explícito).
            </li>
            <li>
              Cobrar a assinatura e cumprir obrigações fiscais e legais.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Quem vê</h2>
          <p>
            <strong>Sua família.</strong> Nem nossa equipe consulta o conteúdo
            do seu diário, perfil vivo ou conversas com a Ayla. Acesso interno
            é restrito a casos de suporte ativamente solicitado por você.
          </p>
          <p>
            <strong>Terceiros operacionais:</strong> Supabase (banco de dados),
            Stripe (pagamentos), Z-API/WhatsApp (mensagens), Anthropic e OpenAI
            (modelos de IA), serviço de e-mail transacional. Cada um trata
            apenas o necessário pra prestar o serviço, sob contrato adequado.
          </p>
          <p>
            <strong>Profissionais que você escolhe:</strong> via link vivo de
            relatório que você gera e compartilha. Você pode revogar o link a
            qualquer hora.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Base legal</h2>
          <p>
            Tratamos dados com base no <strong>consentimento</strong> explícito
            (cadastro, registros, autorização da Ayla, geração de relatório),
            na <strong>execução do contrato</strong> (cobrança, entrega do
            serviço) e em <strong>obrigação legal</strong> (registros fiscais).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Crianças</h2>
          <p>
            O cadastro é feito por pais ou responsáveis. Nenhuma criança
            interage diretamente com a plataforma — você decide o que registrar
            sobre ela. Mesmo assim, evitamos dados sensíveis (CPF, endereço
            preciso) sempre que dá pra evitar.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Seus direitos</h2>
          <p>Você pode, a qualquer momento:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Acessar e exportar seus dados.</li>
            <li>Corrigir, anonimizar ou excluir.</li>
            <li>
              Revogar consentimento (Ayla, link vivo, opt-out de categorias).
            </li>
            <li>Cancelar a conta — basta nos contatar.</li>
          </ul>
          <p>
            Pra qualquer uma dessas solicitações, escreva pra{" "}
            <a
              href="mailto:contato@kolofamilia.com.br"
              className="underline underline-offset-2"
            >
              contato@kolofamilia.com.br
            </a>
            . Respondemos em até 15 dias.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Retenção</h2>
          <p>
            Mantemos seus dados enquanto a conta existir. Quando você cancela,
            arquivamos pelo prazo necessário pra obrigações legais (fiscal e
            jurídico, normalmente 5 anos) e excluímos o conteúdo livre
            (diários, perfil vivo) em até 90 dias.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Segurança</h2>
          <p>
            Usamos TLS em trânsito, criptografia em repouso para credenciais,
            controles de acesso por papel e Row Level Security no banco.
            Mesmo assim, nenhum sistema é 100% — se acontecer um incidente
            que afete seus dados, comunicamos você e a ANPD em até 72 horas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Mudanças</h2>
          <p>
            Atualizações desta política são publicadas aqui com a data
            revisada. Mudanças significativas são comunicadas por e-mail.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">11. Contato e DPO</h2>
          <p>
            Encarregada de Dados (DPO):{" "}
            <a
              href="mailto:dpo@kolofamilia.com.br"
              className="underline underline-offset-2"
            >
              dpo@kolofamilia.com.br
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
