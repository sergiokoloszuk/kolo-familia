"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { iniciarCheckoutComDadosFiscais } from "./actions";

type Props = { plano: "mensal" | "anual"; emailFiscalInicial: string };

const inputClass = "rounded-md border bg-white px-3 py-2";

export function DadosFiscaisForm({ plano, emailFiscalInicial }: Props) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(form: FormData) {
    setErro(null);
    startTransition(async () => {
      const resultado = await iniciarCheckoutComDadosFiscais({
        plano,
        nomeFiscal: String(form.get("nomeFiscal") ?? ""),
        emailFiscal: String(form.get("emailFiscal") ?? ""),
        cpf: String(form.get("cpf") ?? ""),
        cep: String(form.get("cep") ?? ""),
        logradouro: String(form.get("logradouro") ?? ""),
        numero: String(form.get("numero") ?? ""),
        complemento: String(form.get("complemento") ?? ""),
        bairro: String(form.get("bairro") ?? ""),
        cidade: String(form.get("cidade") ?? ""),
        estado: String(form.get("estado") ?? ""),
      });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      window.location.assign(resultado.url);
    });
  }

  return (
    <form action={enviar} className="mt-4 grid gap-4 rounded-2xl border border-kolo-linha bg-kolo-lilas-bg-2 p-4">
      <div>
        <h3 className="font-medium">Dados para sua nota fiscal</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Precisamos destes dados antes do pagamento. Eles ficam na Stripe e não entram no Perfil Vivo nem nas conversas com a Ayla.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Campo rotulo="Nome completo" nome="nomeFiscal" autoComplete="name" className="md:col-span-2" />
        <Campo rotulo="CPF" nome="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" />
        <Campo rotulo="E-mail da nota" nome="emailFiscal" type="email" autoComplete="email" defaultValue={emailFiscalInicial} />
        <Campo rotulo="CEP" nome="cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
        <Campo rotulo="Logradouro" nome="logradouro" autoComplete="address-line1" placeholder="Rua, avenida..." />
        <Campo rotulo="Número" nome="numero" autoComplete="address-line2" />
        <Campo rotulo="Complemento (opcional)" nome="complemento" required={false} autoComplete="address-line2" />
        <Campo rotulo="Bairro" nome="bairro" />
        <Campo rotulo="Cidade" nome="cidade" autoComplete="address-level2" />
        <Campo rotulo="Estado (UF)" nome="estado" autoComplete="address-level1" maxLength={2} placeholder="SP" />
      </div>

      {erro && <p aria-live="polite" className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Abrindo pagamento..." : "Continuar para o pagamento"}
      </Button>
    </form>
  );
}

function Campo({
  rotulo,
  nome,
  className = "",
  required = true,
  ...inputProps
}: {
  rotulo: string;
  nome: string;
  className?: string;
  required?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "required">) {
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      {rotulo}
      <input
        {...inputProps}
        required={required}
        name={nome}
        className={inputClass}
      />
    </label>
  );
}
