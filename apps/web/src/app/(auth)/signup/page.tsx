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

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setAuthError(null);
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
    // Quando email confirmation está ON no Supabase, session vem null e precisa confirmar.
    // Quando está OFF, session vem preenchida e o usuário já entra.
    if (!data.session) {
      setNeedsConfirm(values.email);
    } else {
      window.location.href = "/onboarding";
    }
  }

  if (needsConfirm) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Falta um clique</CardTitle>
          <CardDescription>
            Enviamos um link de confirmação para <strong>{needsConfirm}</strong>. Abre o e-mail e
            clica para entrar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Não chegou? Verifica spam, ou{" "}
            <button
              type="button"
              onClick={() => setNeedsConfirm(null)}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              tenta com outro e-mail
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
        <CardTitle>Começar 30 dias grátis</CardTitle>
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
  return message;
}
