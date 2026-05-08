import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExcluirContaForm } from "./excluir-form";

export default function MinhaContaPage() {
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
          <CardTitle className="text-base">Exportar meus dados</CardTitle>
          <CardDescription>
            Direito LGPD de acesso e portabilidade. Baixe um arquivo JSON
            com tudo que está registrado da sua família.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/api/me/exportar"
            className={cn(buttonVariants({ variant: "outline" }))}
            download
          >
            Baixar meus dados (.json)
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mudar senha</CardTitle>
          <CardDescription>
            Mando um link pro seu e-mail e você define uma nova senha lá.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/recuperar-senha"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Receber link de redefinição
          </Link>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Excluir minha conta
          </CardTitle>
          <CardDescription>
            Irreversível. Apaga todos os seus registros, cancela a
            assinatura ativa e remove o acesso. Direito LGPD de eliminação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExcluirContaForm />
        </CardContent>
      </Card>
    </div>
  );
}
