import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  Gamepad2,
  Lightbulb,
  MessageSquare,
  Route,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";

const ICONES: Record<string, LucideIcon> = {
  brincadeiras: Gamepad2,
  atividades: Sparkles,
  crencas: Lightbulb,
  o_que_fazer_diferente: Route,
  historias_sociais: BookOpen,
  frases_prontas: MessageSquare,
  rotinas: CalendarClock,
};

const DESCRICOES: Record<string, string> = {
  brincadeiras:
    "2 a 3 brincadeiras concretas, com materiais simples e duração estimada.",
  atividades:
    "Atividades do dia a dia que apoiam o neurodesenvolvimento.",
  crencas:
    "Crenças e mitos comuns sobre o tema, com contraposição prática — sem afirmar causas.",
  o_que_fazer_diferente:
    "Mudança concreta de abordagem para um desafio recorrente.",
  historias_sociais:
    "Mini-história em 3 a 5 cenas para preparar para uma situação específica.",
  frases_prontas:
    "5 a 8 frases para usar literalmente em momentos específicos.",
  rotinas:
    "Sugestão de rotina ou ajuste em uma rotina existente.",
};

export default async function ApoioPage() {
  const { supabase } = await loadFamilyContext();

  const { data: tipos } = await supabase
    .from("output_types")
    .select("key, label, icone, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Apoio</h1>
        <p className="text-sm text-muted-foreground">
          Atalhos para tipos específicos de resposta. Você não precisa ter uma pergunta —
          escolha o formato e o sistema gera com base no contexto da sua família.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {(tipos ?? []).map((t) => {
          const Icon = ICONES[t.key] ?? Sparkles;
          return (
            <li key={t.key}>
              <Link href={`/apoio/${t.key}`} className="block">
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardHeader className="flex flex-row items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Icon aria-hidden="true" className="size-5" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{t.label}</CardTitle>
                      <CardDescription>
                        {DESCRICOES[t.key] ?? ""}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Pedir →</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
