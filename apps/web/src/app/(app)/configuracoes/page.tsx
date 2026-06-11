import Link from "next/link";
import {
  ArrowRight,
  Bell,
  MessageCircle,
  Settings,
  Sparkles,
  User as UserIcon,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { AylaPrefsForm } from "./ayla-prefs-form";
import { OptOutsForm } from "./optouts-form";

export default async function ConfiguracoesPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: prefs }, { data: optouts }] = await Promise.all([
    supabase
      .from("ayla_preferences")
      .select(
        "desativada, consentimento_em, horario_preferido_inicio, horario_preferido_fim, frequencia, pausada_ate",
      )
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("categorias_optout")
      .select("categoria")
      .eq("family_account_id", familyId),
  ]);

  const optoutSet = new Set((optouts ?? []).map((o) => o.categoria as string));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <Settings aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Configurações</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Controle das{" "}
            <em className="not-italic text-brand-purple">comunicações</em>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Mensagens no WhatsApp, categorias que você recebe e tudo que afeta
            seu dia a dia.
          </p>
        </div>
      </header>

      {/* Forms inline — Ayla preferences. */}
      <Card className="rounded-3xl bg-white">
        <CardHeader>
          <div className="flex items-start gap-3">
            <IconCard tone="light" size="sm">
              <MessageCircle aria-hidden />
            </IconCard>
            <div>
              <CardTitle className="text-base">
                Acompanhamento no WhatsApp
              </CardTitle>
              <CardDescription>
                {prefs?.consentimento_em
                  ? "Você autorizou o acompanhamento. Ajuste o horário e a frequência aqui."
                  : "Você ainda não autorizou o acompanhamento. Marque na primeira pergunta no WhatsApp ou volte ao onboarding."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AylaPrefsForm
            inicial={{
              desativada: prefs?.desativada ?? true,
              horario_preferido_inicio:
                (prefs?.horario_preferido_inicio as string)?.slice(0, 5) ??
                "19:00",
              horario_preferido_fim:
                (prefs?.horario_preferido_fim as string)?.slice(0, 5) ??
                "21:00",
              frequencia:
                (prefs?.frequencia as
                  | "diaria"
                  | "3x_semana"
                  | "semanal") ?? "diaria",
            }}
            consentimento={Boolean(prefs?.consentimento_em)}
            pausadaAte={prefs?.pausada_ate as string | null | undefined}
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-white">
        <CardHeader>
          <div className="flex items-start gap-3">
            <IconCard tone="light" size="sm">
              <Bell aria-hidden />
            </IconCard>
            <div>
              <CardTitle className="text-base">
                Comunicações por categoria
              </CardTitle>
              <CardDescription>
                Manutenção e mudanças importantes sempre chegam — são as
                únicas que você não consegue silenciar.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OptOutsForm optoutSet={Array.from(optoutSet)} />
        </CardContent>
      </Card>

      {/* Atalhos pra sub-páginas. */}
      <section className="grid gap-4 md:grid-cols-2">
        <SubLink
          href="/configuracoes/membros"
          icon={UserIcon}
          titulo="Crianças e membros"
          descricao="Corrigir nome, data de nascimento e perfil dos membros atípicos cadastrados."
        />
        <SubLink
          href="/configuracoes/preferencias"
          icon={Sparkles}
          titulo="Gostos e preferências"
          descricao="Temas, personagens, materiais e músicas favoritos — pra histórias e brincadeiras personalizadas."
        />
        <SubLink
          href="/configuracoes/familia"
          icon={Users}
          titulo="Mapa familiar"
          descricao="Quem cuida do(s) filho(s) atípico(s) com você — pai, padrasto, avós, babá, professora, terapeuta."
        />
        <SubLink
          href="/configuracoes/regras"
          icon={Bell}
          titulo="Alertas e adaptações"
          descricao="Alertas automáticos (cansada, gatilho recorrente, DASS-21 elevada) e adaptações sugeridas. Você decide."
        />
        <SubLink
          href="/configuracoes/conta"
          icon={UserIcon}
          titulo="Minha conta"
          descricao="Mudar senha, exportar meus dados, excluir conta (LGPD)."
        />
      </section>
    </div>
  );
}

function SubLink({
  href,
  icon: Icon,
  titulo,
  descricao,
}: {
  href: string;
  icon: typeof Users;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-3xl bg-kolo-lilas-bg-2 p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <IconCard tone="light">
        <Icon aria-hidden />
      </IconCard>
      <h3 className="font-heading text-lg text-foreground">{titulo}</h3>
      <p className="text-sm text-muted-foreground">{descricao}</p>
      <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple transition-all group-hover:gap-2.5">
        Abrir
        <ArrowRight className="size-3" aria-hidden />
      </span>
    </Link>
  );
}
