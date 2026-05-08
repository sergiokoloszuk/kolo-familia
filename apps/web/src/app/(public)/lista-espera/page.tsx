import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ListaEsperaForm } from "./lista-espera-form";

export const metadata: Metadata = {
  title: "Lista de espera · Kolo Família",
  description:
    "Estamos em beta fechado. Entre na lista pra receber convite quando abrirmos novas vagas.",
};

export default function ListaEsperaPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Lista de espera
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estamos em beta fechado por enquanto pra cuidar bem das primeiras
          famílias. Quando abrirmos novas vagas, você recebe o código por
          e-mail.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quero saber quando abrir</CardTitle>
          <CardDescription>
            O contexto da sua família é opcional, mas ajuda a gente a entender
            quem vem chegando.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListaEsperaForm />
        </CardContent>
      </Card>
    </div>
  );
}
