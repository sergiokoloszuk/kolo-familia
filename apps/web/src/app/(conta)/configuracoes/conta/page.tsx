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
import { createServiceRoleClient } from "@/lib/supabase/server";
import { assinaturaLiberada } from "@/lib/auth/assinatura";
import { pendenteDeEmail } from "@/lib/email/verificacao-email";
import { ExcluirContaForm } from "./excluir-form";
import { PerfilForm } from "./perfil-form";
import { WhatsappForm } from "./whatsapp-form";
import { EmailForm } from "./email-form";
import { SenhaForm } from "./senha-form";
import { IdiomaForm, type Idioma } from "./idioma-form";

/**
 * MINHA CONTA — a página que uma pessoa autenticada sempre alcança.
 *
 * ⚠️ ELA NÃO EXIGE ASSINATURA, e é isso que a fez sair de `(app)` para
 * `(conta)` em 01/09/2026. Cuidar do próprio e-mail, da própria senha e da
 * própria assinatura não pode depender de ter assinatura — era um nó, e
 * prendia justamente quem precisava desfazê-lo.
 *
 * O que ela lê: `family_profiles` (nome) e `family_accounts` (whatsapp,
 * idioma). **Nenhum dado de criança** — nem nome, nem idade, nem perfil. Foi
 * conferido tabela por tabela antes da mudança, e é o que permite esta página
 * viver fora do gate sem vazar o produto.
 */
export default async function MinhaContaPage() {
  const { user, supabase, family } = await loadFamilyContext();
  const admin = createServiceRoleClient();
  const [{ data: profile }, { data: conta }, { data: sub }, emailPendente] =
    await Promise.all([
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
      family
        ? supabase
            .from("subscription_accesses")
            .select("status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em")
            .eq("family_account_id", family.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      pendenteDeEmail(admin, user.id),
    ]);

  const idioma = ((conta?.idioma as Idioma | null) ?? "pt") as Idioma;
  // ⚠️ LEITURA, não portão. Serve só para não oferecer um link que levaria ao
  // paywall: mandar quem está sem acesso para `/configuracoes` produzia
  // exatamente o beco que esta frente veio fechar.
  const temAcesso = assinaturaLiberada(sub);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        {temAcesso && (
          <Link
            href="/configuracoes"
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" className="size-3" />
            Configurações
          </Link>
        )}
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Minha conta
        </h1>
        <p className="text-sm text-muted-foreground">
          Seus dados de acesso. É por aqui que você entra na Kolo.
        </p>
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
            O e-mail que você usa pra entrar — e para onde mandamos o link se
            você esquecer a senha. Se estiver errado, dá pra corrigir aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailForm atual={user.email ?? ""} pendente={emailPendente} />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinatura</CardTitle>
          <CardDescription>
            {temAcesso
              ? "Seu plano, a cobrança e o cancelamento."
              : "Seu acesso está pausado. Aqui você vê os planos e assina quando quiser."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/assinatura"
            className="inline-flex items-center rounded-xl border border-kolo-linha px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/60"
          >
            {temAcesso ? "Ver assinatura" : "Ver planos e assinar"}
          </Link>
        </CardContent>
      </Card>

      {/* Voltar e sair. O "voltar" só aparece para quem tem acesso — para quem
          não tem, ele levaria ao paywall e seria mais um beco. */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {temAcesso && (
          <Link
            href="/painel"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Voltar para a Kolo
          </Link>
        )}
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sair da conta
          </button>
        </form>
      </div>

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
