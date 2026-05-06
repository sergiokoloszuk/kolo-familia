import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Fase 1 — Setup do ambiente
          </span>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-6xl">
            Kolo Família
          </h1>
          <p className="text-lg text-muted-foreground">
            Estratégia personalizada para o dia a dia da família atípica, com
            mais clareza e leveza, em qualquer hora do dia.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Smoke test do design system</CardTitle>
            <CardDescription>
              Tailwind v4 + shadcn/ui rodando em Next.js 16. Componentes
              renderizados a partir de <code>src/components/ui/</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destrutivo</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próxima fase</CardTitle>
            <CardDescription>
              Fase 2 — Banco de dados e Autenticação. Migrações Supabase,
              RLS, autenticação por e-mail e Google OAuth.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
