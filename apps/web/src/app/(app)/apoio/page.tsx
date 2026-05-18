import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Gamepad2,
  Heart,
  Lightbulb,
  MessageSquare,
  Route,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
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
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <Heart aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Apoio</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Atalhos pra{" "}
            <em className="not-italic text-brand-purple">tipos específicos</em>{" "}
            de resposta
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Você não precisa ter uma pergunta. Escolha o formato e o sistema
            gera com base no contexto da sua família.
          </p>
        </div>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {(tipos ?? []).map((t) => {
          const Icon = ICONES[t.key] ?? Sparkles;
          return (
            <li key={t.key}>
              <Link
                href={`/apoio/${t.key}`}
                className="group flex h-full flex-col gap-3 rounded-3xl border border-kolo-linha bg-white p-6 transition-all hover:-translate-y-1 hover:border-brand-purple hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <IconCard tone="light">
                    <Icon aria-hidden />
                  </IconCard>
                  <div className="flex-1">
                    <h3 className="font-heading text-lg text-foreground">
                      {t.label}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {DESCRICOES[t.key] ?? ""}
                    </p>
                  </div>
                </div>
                <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple transition-all group-hover:gap-2.5">
                  Pedir
                  <ArrowRight className="size-3" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
