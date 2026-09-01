"use client";

import { useRouter } from "next/navigation";
import { ConfirmarWhatsapp } from "@/components/confirmar-whatsapp";

/**
 * Trocar o WhatsApp nas Configurações — agora pelo MESMO caminho das outras
 * portas (Fase 2A).
 *
 * ⚠️ O QUE ESTE ARQUIVO ERA, ATÉ 21/08/2026: um formulário que gravava
 * `family_accounts.whatsapp_e164` direto, sem código nenhum. Era o bypass mais
 * silencioso dos quatro — ninguém procura por troca de número numa frente de
 * onboarding, e é exatamente daqui que a Ayla lê para escrever. Bastavam dois
 * cliques para apontar a Ayla ao telefone de um terceiro.
 *
 * Agora reusa `ConfirmarWhatsapp`: o número novo só entra depois de o código
 * chegar NAQUELE aparelho. Trocar de número é, de novo, provar que ele é seu.
 */
export function WhatsappForm({ initial }: { initial: string }) {
  const router = useRouter();
  return (
    <ConfirmarWhatsapp
      numeroInicial={initial || null}
      variante="painel"
      onConfirmado={() => router.refresh()}
    />
  );
}
