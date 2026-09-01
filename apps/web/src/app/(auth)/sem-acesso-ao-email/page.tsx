import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Não tenho acesso a este e-mail — Kolo Família",
};

/**
 * A SAÍDA QUE FALTAVA NO LOGIN.
 *
 * ⚠️ ESTA PÁGINA NÃO AUTENTICA NINGUÉM. É texto. Ela não cria sessão, não
 * manda código, não recebe formulário e não aceita e-mail nem telefone — de
 * propósito: aceitar um telefone aqui e tratá-lo como prova da conta seria
 * abrir uma porta de recuperação para quem apenas *diz* ser a dona.
 *
 * Quem prova a posse é a Ayla, no número que já está na conta da família. A
 * pessoa pede por lá; o link chega no WhatsApp dela e em mais lugar nenhum.
 *
 * MEDIDO EM 31/08/2026: 78 de 244 contas nunca confirmaram o e-mail. Desde que
 * a confirmação saiu do cadastro — decisão de produto, porque o portão
 * derrubava 32% dos cadastros —, quem digita o endereço errado entra
 * normalmente e só descobre no dia em que esquece a senha. Sem esta página,
 * essa pessoa não tinha caminho nenhum de volta.
 *
 * Vocabulário: nada de "magic link", "token", "OTP" ou "entitlement". A mãe lê
 * o que ela faria de qualquer forma — mandar mensagem para a Ayla.
 */
export default function SemAcessoAoEmailPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Não tenho acesso a este e-mail</CardTitle>
        <CardDescription>
          Acontece — às vezes o endereço sai com um erro de digitação no
          cadastro. Dá pra resolver pelo WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
        <ol className="flex flex-col gap-3">
          <li>
            <strong className="text-foreground">1.</strong> Abra a conversa com
            a <strong className="text-foreground">Ayla</strong> no WhatsApp — o
            mesmo número onde vocês já conversam.
          </li>
          <li>
            <strong className="text-foreground">2.</strong> Escreva{" "}
            <strong className="text-foreground">&ldquo;quero entrar&rdquo;</strong>.
            Ela te manda um acesso na hora.
          </li>
          <li>
            <strong className="text-foreground">3.</strong> Toque no que ela
            enviar e vá em <strong className="text-foreground">Minha conta</strong>{" "}
            para corrigir seu e-mail e sua senha.
          </li>
        </ol>

        <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs">
          Depois de corrigir, o &ldquo;Esqueci minha senha&rdquo; volta a
          funcionar normalmente — o link passa a chegar no endereço certo.
        </p>

        <p className="text-xs">
          Ainda não conversou com a Ayla pelo WhatsApp? Então esse caminho não
          está disponível para a sua conta.{" "}
          <Link
            href="/contato"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Fale com a gente
          </Link>{" "}
          que a gente resolve junto.
        </p>

        <p className="text-center">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
