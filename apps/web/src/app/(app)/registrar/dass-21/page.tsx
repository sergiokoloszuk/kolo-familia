import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { DASS21Form } from "./dass21-form";

export default async function DASS21Page() {
  const { user, supabase } = await loadFamilyContext();

  // Histórico curto pra mostrar evolução
  const { data: historico } = await supabase
    .from("dass21_aplicacoes")
    .select(
      "id, data_aplicacao, score_depressao, score_ansiedade, score_estresse, faixa_depressao, faixa_ansiedade, faixa_estresse",
    )
    .eq("user_id", user.id)
    .order("data_aplicacao", { ascending: false })
    .limit(6);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/registrar"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Registrar
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Termômetro mensal
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Antes de começar</CardTitle>
          <CardDescription>
            Isto é um termômetro auto-aplicável (escala DASS-21). Não é um diagnóstico.
            Quem diagnostica é profissional de saúde mental. O resultado fica protegido
            — só você vê. Pode pular ou parar a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pense na <strong>última semana</strong> e responda quanto cada frase se
            aplicou a você. Leva 3 a 5 minutos.
          </p>
        </CardContent>
      </Card>

      <DASS21Form />

      {historico && historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seu histórico</CardTitle>
            <CardDescription>
              Aplicações anteriores (só você vê este histórico).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {historico.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <span className="font-medium">{h.data_aplicacao}</span>
                  <span className="text-xs text-muted-foreground">
                    D:{h.score_depressao} ({h.faixa_depressao}) · A:{h.score_ansiedade} (
                    {h.faixa_ansiedade}) · E:{h.score_estresse} ({h.faixa_estresse})
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
