import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";

export const metadata: Metadata = {
  title: "Regulamento Black Friday 2026 · Kolo Família",
  description: "Regras da oferta de novembro de 2026 da Kolo Família.",
};

export default function RegulamentoBlackFridayPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="mb-10 border-b border-kolo-linha pb-8">
        <Eyebrow>Regulamento</Eyebrow>
        <h1 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">Black Friday 2026</h1>
        <p className="mt-3 text-sm text-muted-foreground">Versão de 23 de outubro de 2026</p>
      </header>
      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-lg font-semibold">1. Quem promove e quando acontece</h2>
          <p>A oferta é promovida por Kolo Academy Ltda., CNPJ 60.374.232/0001-31, Rua Nagel, 33, Apto 82 Bloco 2, Vila Leopoldina, São Paulo/SP, CEP 05315-030.</p>
          <p>Novas ativações podem ocorrer de 1º de novembro de 2026, às 00h00, até 30 de novembro de 2026, às 23h59, sempre no horário de Brasília.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">2. O que a oferta inclui</h2>
          <p>São 15 dias completos de teste, sem cartão e sem cobrança automática ao final, mais a possibilidade de contratar o plano mensal por R$ 39,90.</p>
          <p>O plano anual fica oculto durante a campanha, sem mudar contratos que já existam.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">3. Dois prazos diferentes</h2>
          <p>Os 15 dias de acesso gratuito contam da ativação. O preço de R$ 39,90 pode ser contratado até o fim da data mais distante entre 30/11/2026 e o dia em que terminar o teste daquela conta.</p>
          <p>Não existem sete dias extras para testar nem sete dias adicionais para comprar. Depois que o teste acaba, o conteúdo pode ficar bloqueado mesmo que o preço promocional ainda esteja disponível.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">4. Quem é elegível</h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>Novo cadastro no período: 15 dias desde a ativação.</li>
            <li>Teste em curso na abertura: completa 15 dias totais, sem perder prazo maior já concedido.</li>
            <li>Teste encerrado ou ex-assinante: pode ativar voluntariamente 15 novos dias durante novembro, uma vez por conta.</li>
            <li>Assinantes ativos e cortesias mantêm suas condições e não recebem nova gratuidade.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold">5. Contratação e cobrança</h2>
          <p>Se a contratação ocorrer durante o teste, todos os dias gratuitos permanecem e a primeira cobrança fica para depois do término. Se ocorrer depois, a cobrança começa na contratação.</p>
          <p>Um checkout iniciado antes do prazo individual fica disponível por 30 minutos. Só abrir a página não reserva o preço. A confirmação do processador pode chegar depois, desde que a conclusão tenha ocorrido dentro dessa sessão.</p>
          <p>O preço promocional permanece como base enquanto a assinatura continuar ativa, sujeito aos reajustes contratuais. Se cancelar e contratar novamente, vale o preço disponível no retorno.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">6. Cancelamento e dados</h2>
          <p>Não há multa. O cancelamento impede novas renovações; quando já existe período pago, o acesso continua até o final dele. Se a contratação durante o teste for cancelada antes da primeira cobrança, a cobrança futura é cancelada e o teste já concedido permanece.</p>
          <p>Sem assinatura, o histórico do teste promocional é mantido por 30 dias após o prazo individual da oferta e depois excluído, ressalvados registros mínimos exigidos por lei. A exclusão pode ser pedida antes.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">7. Atendimento e demais documentos</h2>
          <p>Dúvidas e solicitações: <a href="mailto:kolosuporte@gmail.com" className="underline">kolosuporte@gmail.com</a>.</p>
          <p>Também se aplicam os <Link href="/termos" className="underline">Termos de Uso</Link>, a <Link href="/privacidade" className="underline">Política de Privacidade</Link> e os direitos previstos na legislação brasileira.</p>
        </section>
      </div>
    </article>
  );
}
