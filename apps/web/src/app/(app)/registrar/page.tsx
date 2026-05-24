import Link from "next/link";
import { differenceInCalendarDays, formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { hojeLocalISO } from "@/lib/idade";

export default async function RegistrarPage() {
  const { supabase, family, user } = await loadFamilyContext();
  const familyId = family!.id;
  const hoje = hojeLocalISO();

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
    ? differenceInCalendarDays(
        new Date(),
        new Date(ultimoSemanal.semana_inicio as string),
      )
    : null;
  const diasDesdeUltimoDass = ultimoDass21
    ? differenceInCalendarDays(
        new Date(),
        new Date(ultimoDass21.data_aplicacao as string),
      )
    : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Eyebrow>Registrar</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          O que{" "}
          <em className="not-italic text-brand-purple">aconteceu</em> hoje?
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Registros diários e periódicos. Quanto mais contexto você registrar,
          mais úteis ficam as respostas.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-3">
        <RegistroCard
          href="/registrar/diario"
          icon={CalendarDays}
          titulo="Hoje"
          descricao="Como você está + uma conquista/desafio do dia + quem estava e como você reagiu."
          badge={checkinHoje ? "feito" : "pendente"}
          rodape={
            checkinHoje
              ? "Pode reabrir e completar o que faltou."
              : "Leva 1 minuto. Pode ser uma frase só."
          }
        />

        <RegistroCard
          href="/registrar/semanal"
          icon={CalendarRange}
          titulo="Semanal"
          descricao="Como foi a semana — emocional + energia + reflexão sobre o que faria diferente."
          badge={
            diasDesdeUltimaSemanal != null && diasDesdeUltimaSemanal < 7
              ? "feito"
              : "recomendado"
          }
          rodape={
            ultimoSemanal && diasDesdeUltimaSemanal != null
              ? `Último: ${formatRelative(new Date(ultimoSemanal.semana_inicio as string), new Date(), { locale: ptBR })}`
              : "Você ainda não fez nenhum check-in semanal."
          }
        />

        <RegistroCard
          href="/registrar/dass-21"
          icon={ClipboardCheck}
          titulo="Termômetro mensal"
          descricao="21 perguntas sobre como você esteve na última semana. Termômetro, não diagnóstico."
          badge={
            diasDesdeUltimoDass != null && diasDesdeUltimoDass < 30
              ? "feito"
              : "mensal"
          }
          rodape={
            ultimoDass21 && diasDesdeUltimoDass != null
              ? `Último: ${formatRelative(new Date(ultimoDass21.data_aplicacao as string), new Date(), { locale: ptBR })}`
              : "3-5 minutos. Quem diagnostica é profissional — isso aqui só ajuda você a calibrar."
          }
        />
      </ul>
    </div>
  );
}

function RegistroCard({
  href,
  icon: Icon,
  titulo,
  descricao,
  badge,
  rodape,
}: {
  href: string;
  icon: typeof CalendarDays;
  titulo: string;
  descricao: string;
  badge: "feito" | "pendente" | "recomendado" | "mensal";
  rodape: string;
}) {
  const badgeLabel: Record<typeof badge, string> = {
    feito: "Feito",
    pendente: "Pendente",
    recomendado: "Recomendado",
    mensal: "Mensal",
  };
  return (
    <li>
      <Link
        href={href}
        className="group flex h-full flex-col gap-4 rounded-3xl bg-kolo-lilas-bg-2 p-6 transition-all hover:-translate-y-1 hover:shadow-lg md:p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <IconCard tone="light">
            <Icon aria-hidden />
          </IconCard>
          <Badge variant={badge === "feito" ? "default" : "outline"}>
            {badgeLabel[badge]}
          </Badge>
        </div>
        <h3 className="font-heading text-xl text-foreground">{titulo}</h3>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <p className="mt-auto flex items-center gap-2 text-xs text-brand-purple transition-all group-hover:gap-3">
          {rodape}
          <ArrowRight className="size-3" aria-hidden />
        </p>
      </Link>
    </li>
  );
}
