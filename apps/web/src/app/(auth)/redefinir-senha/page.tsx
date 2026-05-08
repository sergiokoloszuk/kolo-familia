"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    senha: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirmacao: z.string().min(8).max(72),
  })
  .refine((d) => d.senha === d.confirmacao, {
    message: "As senhas não conferem",
    path: ["confirmacao"],
  });

type FormValues = z.infer<typeof schema>;

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // O Supabase manda o usuário pra cá com #access_token=...&type=recovery
  // O cliente JS lê esses tokens automaticamente e cria a sessão.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      // Code do callback (PKCE) ou hash com tokens
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) {
          if (error) setErro(error.message);
          else setPronto(true);
        }
        return;
      }
      // Sessão já existente (vinda do hash, processada pelo SDK)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) {
        if (session) setPronto(true);
        else setErro("Link inválido ou expirado. Peça um novo em /recuperar-senha.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.senha });
    setSubmitting(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.replace("/painel");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Nova senha</CardTitle>
        <CardDescription>
          Crie uma senha nova com pelo menos 8 caracteres.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {erro && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </div>
        )}

        {pronto && !erro && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                {...register("senha")}
              />
              {errors.senha && (
                <span className="text-xs text-destructive">
                  {errors.senha.message}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmacao">Confirme</Label>
              <Input
                id="confirmacao"
                type="password"
                autoComplete="new-password"
                {...register("confirmacao")}
              />
              {errors.confirmacao && (
                <span className="text-xs text-destructive">
                  {errors.confirmacao.message}
                </span>
              )}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}

        {!pronto && !erro && (
          <p className="text-sm text-muted-foreground">Validando link...</p>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Voltar pra entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
