"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const BETA_GATE = process.env.NEXT_PUBLIC_BETA_GATE_ENABLED === "true";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  codigo_convite: BETA_GATE
    ? z.string().trim().min(4, "Código de convite obrigatório").max(40)
    : z.string().optional(),
  aceito_termos: z.literal(true, {
    errorMap: () => ({
      message: "Você precisa aceitar termos e política pra continuar.",
    }),
  }),
});

type FormValues = z.infer<typeof schema>;

/** Empurra a conversão pro dataLayer do GTM (o container vive no layout de auth). */
function pushFormSubmit() {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: "form_submit" });
  } catch {
    // tracking nunca pode quebrar o cadastro
  }
}

export default function SignupPage() {
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const [reenvioMsg, setReenvioMsg] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setAuthError(null);

    // Beta gate: valida convite ANTES de criar conta
    if (BETA_GATE) {
      const codigo = values.codigo_convite?.trim() ?? "";
      const r = await fetch("/api/beta/validar-convite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const j = await r.json();
      if (!j.ok) {
        setSubmitting(false);
        setAuthError(j.motivo ?? "Convite inválido.");
        return;
      }
      // Guarda o código pra consumir pós-onboarding
      try {
        localStorage.setItem("beta_codigo_pendente", codigo);
      } catch {
        // Privacy mode pode bloquear localStorage — segue sem persistir
      }
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setSubmitting(false);
    if (error) {
      setAuthError(traduzirErro(error.message));
      return;
    }

    // E-mail JÁ cadastrado: com confirmação de e-mail ligada, o Supabase NÃO dá
    // erro — devolve um usuário "fantasma" (identities vazio) por segurança
    // (anti-enumeração). Se seguir, o track-utm dispara com um id que não casa
    // com nenhuma família e a origem se perde ("Direto"). Detecta e para aqui.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setAuthError("Esse e-mail já tem conta. Tenta entrar, ou use outro e-mail.");
      return;
    }

    // Conversão (GTM/agência de tráfego): a conta foi criada.
    pushFormSubmit();

    // Captura de UTM ROBUSTA: grava a origem do anúncio na conta recém-criada
    // JÁ (sem depender do cookie sobreviver nem de terminar o onboarding). O
    // atribuirUtm no onboarding continua como reforço. Best-effort.
    try {
      const p = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
        const v = p.get(k);
        if (v) utm[k] = v;
      }
      // Idioma por origem: a landing em espanhol adiciona ?lang=es aos botões
      // do cadastro (a landing PT não põe nada → padrão pt). Fica dormente até
      // a landing ES existir; enquanto isso todo mundo cai em pt.
      const langRaw = (p.get("lang") ?? "").toLowerCase();
      const idioma = langRaw === "es" || langRaw === "en" ? langRaw : null;
      if (data.user?.id && (utm.utm_source || idioma)) {
        // keepalive + await: garante que a gravação COMPLETE mesmo se a página
        // navegar logo depois (senão o navegador cancela a requisição).
        await fetch("/api/track-utm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: data.user.id, utm, idioma }),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* tracking nunca quebra o cadastro */
    }

    // Aceite de termos: guarda timestamp pra ser persistido após login
    const aceitoEm = new Date().toISOString();
    try {
      localStorage.setItem("termos_aceitos_em_pendente", aceitoEm);
    } catch {
      // privacy mode bloqueia; aceito é tentado de novo via banner pós-login
    }

    // Quando email confirmation está ON no Supabase, session vem null e precisa confirmar.
    // Quando está OFF, session vem preenchida e o usuário já entra.
    if (!data.session) {
      setNeedsConfirm(values.email);
    } else {
      // Tenta persistir agora (best-effort; consumer também tenta)
      try {
        await fetch("/api/me/aceitar-termos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ aceitos_em: aceitoEm }),
        });
      } catch {
        /* consumer cuida */
      }
      window.location.href = "/onboarding";
    }
  }

  if (needsConfirm) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Confirme seu e-mail</CardTitle>
          <CardDescription>
            Enviamos um código (e um link) para <strong>{needsConfirm}</strong>. Digite o código do
            e-mail aqui pra continuar sem sair desta tela — ou clique no link do e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {verifyError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {verifyError}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setVerificando(true);
              setVerifyError(null);
              const supabase = createClient();
              const { error } = await supabase.auth.verifyOtp({
                email: needsConfirm,
                token: codigo.trim(),
                type: "signup",
              });
              setVerificando(false);
              if (error) {
                setVerifyError(traduzirErro(error.message));
                return;
              }
              window.location.href = "/onboarding";
            }}
            className="flex flex-col gap-2"
          >
            <Label htmlFor="codigo">Código do e-mail</Label>
            <Input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.4em]"
            />
            <Button type="submit" disabled={verificando || codigo.length < 6}>
              {verificando ? "Confirmando..." : "Confirmar e continuar"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            Não chegou? Verifica spam ou{" "}
            <button
              type="button"
              onClick={async () => {
                setReenviando(true);
                setReenvioMsg(null);
                const supabase = createClient();
                const { error } = await supabase.auth.resend({
                  type: "signup",
                  email: needsConfirm,
                });
                setReenviando(false);
                setReenvioMsg(
                  error
                    ? `Falha ao reenviar: ${error.message}`
                    : "Reenviei. Aguarde uns minutos e confira o spam.",
                );
              }}
              disabled={reenviando}
              className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              {reenviando ? "reenviando..." : "reenvia o link"}
            </button>
            .
          </p>
          {reenvioMsg && (
            <p className="text-xs text-muted-foreground">{reenvioMsg}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Ou{" "}
            <button
              type="button"
              onClick={() => setNeedsConfirm(null)}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              tente com outro e-mail
            </button>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Começar 7 dias grátis</CardTitle>
        <CardDescription>Sem cartão. Cancela quando quiser.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {authError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && (
              <span className="text-xs text-destructive">{errors.email.message}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && (
              <span className="text-xs text-destructive">{errors.password.message}</span>
            )}
          </div>
          {BETA_GATE && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="codigo_convite">Código de convite</Label>
              <Input
                id="codigo_convite"
                type="text"
                autoComplete="off"
                spellCheck={false}
                style={{ textTransform: "uppercase" }}
                placeholder="Ex: ABCD2345"
                {...register("codigo_convite")}
              />
              {errors.codigo_convite && (
                <span className="text-xs text-destructive">
                  {errors.codigo_convite.message}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Estamos em beta fechado. Quem te convidou te passou um código.
              </span>
            </div>
          )}
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              {...register("aceito_termos")}
              className="mt-0.5"
            />
            <span>
              Li e aceito os{" "}
              <Link
                href="/termos"
                target="_blank"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                termos de uso
              </Link>{" "}
              e a{" "}
              <Link
                href="/privacidade"
                target="_blank"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                política de privacidade
              </Link>
              . Entendo que o Kolo Família não substitui profissionais de
              saúde.
            </span>
          </label>
          {errors.aceito_termos && (
            <span className="text-xs text-destructive">
              {errors.aceito_termos.message}
            </span>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Ao continuar você concorda com os termos de uso e a política de privacidade. O Kolo
          Família não substitui profissionais da saúde.
        </p>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function traduzirErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists"))
    return "Esse e-mail já tem conta. Tenta entrar.";
  if (m.includes("password should be")) return "Senha muito curta. Use pelo menos 8 caracteres.";
  if (m.includes("expired") || m.includes("invalid") || m.includes("token"))
    return "Código inválido ou expirado. Confira o e-mail ou reenvie o link.";
  return message;
}
