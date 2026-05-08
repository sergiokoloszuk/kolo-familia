import Link from "next/link";
import { differenceInCalendarDays, formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadFamilyContext } from "@/lib/auth/require-user";

export default async function RegistrarPage() {
  const { supabase, family, user } = await loadFamilyContext();
  const familyId = family!.id;
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ data: checkinHoje }, { data: ultimoSemanal }, { data: ultimoDass21 }] =
    await Promise.all([
      supabase
        .from("check_ins_diarios")
        .select("id, data")
        .eq("family_account_id", familyId)
        .eq("data", hoje)
        .maybeSingle(),
      supabase
        .from("check_ins_semanais")
        .select("id, semana_inicio, created_at")
        .eq("family_account_id", familyId)
        .order("semana_inicio", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("dass21_aplicacoes")
        .select("id, data_aplicacao, created_at")
        .eq("user_id", user.id)
        .order("data_aplicacao", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const diasDesdeUltimaSemanal = ultimoSemanal
    ? differenceInCalendarDays(new Date(), new Date(ultimoSemanal.semana_inicio as string))
    : null;
  const diasDesdeUltimoDass = ultimoDass21
    ? differenceInCalendarDays(new Date(), new Date(ultimoDass21.data_aplicacao as string))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Registrar</h1>
        <p className="text-sm text-muted-foreground">
          Registros diários e periódicos. Quanto mais a Ayla e os especialistas têm de
          contexto, mais útil ficam as respostas.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-3">
        <li>
          <Link href="/registrar/diario" className="block h-full">
            <Card className="h-full transition-colors hover:bg-muted/30">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Hoje</CardTitle>
                  {checkinHoje ? (
                    <Badge variant="default">Feito</Badge>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                </div>
                <CardDescription>
                  Como você está + uma conquista/desafio do dia + quem estava e como
                  você reagiu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {checkinHoje
                    ? "Pode reabrir e completar o que faltou."
                    : "Leva 1 minuto. Pode ser uma frase só."}
                </p>
              </CardContent>
            </Card>
          </Link>
        </li>

        <li>
          <Link href="/registrar/semanal" className="block h-full">
            <Card className="h-full transition-colors hover:bg-muted/30">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Semanal</CardTitle>
                  {diasDesdeUltimaSemanal != null && diasDesdeUltimaSemanal < 7 ? (
                    <Badge variant="default">Feito</Badge>
                  ) : (
                    <Badge variant="outline">Recomendado</Badge>
                  )}
                </div>
                <CardDescription>
                  Como foi a semana — emocional + energia + reflexão sobre o que faria
                  diferente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {ultimoSemanal && diasDesdeUltimaSemanal != null
                    ? `Último: ${formatRelative(new Date(ultimoSemanal.semana_inicio as string), new Date(), { locale: ptBR })}`
                    : "Você ainda não fez nenhum check-in semanal."}
                </p>
              </CardContent>
            </Card>
          </Link>
        </li>

        <li>
          <Link href="/registrar/dass-21" className="block h-full">
            <Card className="h-full transition-colors hover:bg-muted/30">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Termômetro mensal</CardTitle>
                  {diasDesdeUltimoDass != null && diasDesdeUltimoDass < 30 ? (
                    <Badge variant="default">Feito</Badge>
                  ) : (
                    <Badge variant="outline">Mensal</Badge>
                  )}
                </div>
                <CardDescription>
                  21 perguntas sobre como você esteve na última semana. Termômetro,
                  não diagnóstico.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {ultimoDass21 && diasDesdeUltimoDass != null
                    ? `Último: ${formatRelative(new Date(ultimoDass21.data_aplicacao as string), new Date(), { locale: ptBR })}`
                    : "3-5 minutos. Quem diagnostica é profissional — isso aqui só ajuda você a calibrar."}
                </p>
              </CardContent>
            </Card>
          </Link>
        </li>
      </ul>
    </div>
  );
}
