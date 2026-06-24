"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setAuthError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setSubmitting(false);
      setAuthError(traduzirErro(error.message));
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Continue de onde parou.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(authError || errorParam) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {authError ?? traduzirErro(errorParam!)}
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
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && (
              <span className="text-xs text-destructive">{errors.password.message}</span>
            )}
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
          <Link
            href="/recuperar-senha"
            className="self-end text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Esqueci minha senha
          </Link>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Começar 7 dias grátis
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function traduzirErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("missing_code")) return "Link inválido ou expirado.";
  return message;
}
