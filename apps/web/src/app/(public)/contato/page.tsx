import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContatoForm } from "./contato-form";

export const metadata: Metadata = {
  title: "Contato · Kolo Família",
  description:
    "Fale com a equipe do Kolo Família. Dúvidas, sugestões, parcerias com escolas ou consultórios.",
};

export default function ContatoPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Contato
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A equipe lê tudo. Pra suporte de conta existente, acesse{" "}
          <a href="/login" className="underline">
            entrar
          </a>{" "}
          e use o link de ajuda dentro do app.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manda uma mensagem</CardTitle>
          <CardDescription>
            Pra dúvidas, sugestões ou parcerias com escolas/consultórios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContatoForm />
        </CardContent>
      </Card>

      <div className="mt-6 rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Outras formas de falar</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
          <li>
            Geral:{" "}
            <a
              href="mailto:contato@kolofamilia.com.br"
              className="underline underline-offset-2"
            >
              contato@kolofamilia.com.br
            </a>
          </li>
          <li>
            Privacidade / DPO:{" "}
            <a
              href="mailto:dpo@kolofamilia.com.br"
              className="underline underline-offset-2"
            >
              dpo@kolofamilia.com.br
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
