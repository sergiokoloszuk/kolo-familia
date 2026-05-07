import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <PublicLanding />;

  // Logado: por enquanto mostra o card de boas-vindas. Painel real entra na Fase 3.
  return <LoggedInHome email={user.email ?? "—"} />;
}

function PublicLanding() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-6xl">
            Kolo Família
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            Estratégia personalizada para o dia a dia da família atípica, com mais
            clareza e leveza, em qualquer hora do dia — porque a orientação para a
            inclusão acontece onde a família já está: no WhatsApp.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
              Começar 30 dias grátis
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Já tenho conta
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Sem cartão. Cancela quando quiser. Não substitui profissionais da saúde.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Como funciona</CardTitle>
            <CardDescription>
              Três peças trabalhando juntas — app, Ayla no WhatsApp e especialistas que
              respondem por contexto.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="font-medium">App (PWA)</p>
              <p className="text-muted-foreground">
                Painel diário, perfil progressivo da família, aulas, galeria.
              </p>
            </div>
            <div>
              <p className="font-medium">Ayla no WhatsApp</p>
              <p className="text-muted-foreground">
                Acolhimento, registro do dia, sugestões — onde você já está.
              </p>
            </div>
            <div>
              <p className="font-medium">Especialistas</p>
              <p className="text-muted-foreground">
                Respondem pelo contexto, sem você escolher por qual canal.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function LoggedInHome({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bem-vinda</CardTitle>
          <CardDescription>{email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Painel completo entra na próxima fase. Por enquanto, sua conta está ativa.
          </p>
          <form action="/auth/logout" method="post">
            <Button type="submit" variant="outline" className="w-full">
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

