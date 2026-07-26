import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { ExcluirContaForm } from "./excluir-form";
import { PerfilForm } from "./perfil-form";
import { WhatsappForm } from "./whatsapp-form";
import { EmailForm } from "./email-form";
import { SenhaForm } from "./senha-form";
import { IdiomaForm, type Idioma } from "./idioma-form";

export default async function MinhaContaPage() {
  const { user, supabase, family } = await loadFamilyContext();
  const [{ data: profile }, { data: conta }] = await Promise.all([
    family
      ? supabase
          .from("family_profiles")
          .select("nome_mae, como_chamar")
          .eq("family_account_id", family.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    family
      ? supabase
          .from("family_accounts")
          .select("whatsapp_e164, idioma")
          .eq("id", family.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const idioma = ((conta?.idioma as Idioma | null) ?? "pt") as Idioma;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/configuracoes"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Configurações
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Minha conta
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seu nome</CardTitle>
          <CardDescription>
            Como você quer ser chamado(a) no app — é o nome que aparece no
            início e no menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PerfilForm
            initial={{
              nome_mae: profile?.nome_mae ?? "",
              como_chamar: profile?.como_chamar ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Idioma</CardTitle>
          <CardDescription>
            A língua da plataforma e das mensagens que a Ayla te envia. Quando
            você escreve pra ela, a Ayla já responde no seu idioma de qualquer
            forma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IdiomaForm initial={idioma} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp</CardTitle>
          <CardDescription>
            O número por onde a Ayla fala com você. Mantenha atualizado pra não
            perder as mensagens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsappForm initial={(conta?.whatsapp_e164 as string | null) ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">E-mail de login</CardTitle>
          <CardDescription>
            O e-mail que você usa pra entrar. Trocar exige confirmar pelo link
            que mandamos pro novo e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailForm atual={user.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sua senha</CardTitle>
          <CardDescription>
            Define aqui mesmo, sem esperar e-mail. Serve tanto pra criar a
            primeira quanto pra trocar a que você já tem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SenhaForm />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Excluir minha conta
          </CardTitle>
          <CardDescription>
            Isso não tem volta: apaga todos os seus registros, cancela a
            assinatura e encerra o acesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExcluirContaForm />
        </CardContent>
      </Card>
    </div>
  );
}
