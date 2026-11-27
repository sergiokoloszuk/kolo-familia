"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { gerarConversacional } from "@/lib/ia/provider";
import { simularNoAdmin } from "@/lib/demo/servico";

/**
 * Simula a demonstração da landing com a MESMA montagem de prompt das rotas
 * `/api/demo/*`. Não grava linha, não pede código, não manda WhatsApp e não
 * conta como a demonstração de número nenhum — é aqui que a responsável testa
 * a condução livremente.
 */
export async function simularDemonstracao(entrada: {
  historico: Array<{ papel: "pessoa" | "ayla"; texto: string }>;
  texto: string;
  usarRascunho: boolean;
}) {
  await requireAdmin();
  return simularNoAdmin(
    {
      admin: createServiceRoleClient(),
      // A simulação nunca envia WhatsApp: qualquer tentativa é erro de código.
      enviarWhatsApp: async () => {
        throw new Error("simulação do Admin não envia WhatsApp");
      },
      gerar: gerarConversacional,
    },
    {
      historico: entrada.historico.filter((m) => m.papel === "pessoa" || m.papel === "ayla"),
      texto: String(entrada.texto ?? ""),
      usarRascunho: entrada.usarRascunho,
    },
  );
}
