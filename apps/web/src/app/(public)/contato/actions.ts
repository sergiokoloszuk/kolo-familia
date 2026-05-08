"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  mensagem: z.string().trim().min(10).max(2000),
});

export async function enviarContato(input: z.infer<typeof schema>): Promise<void> {
  const data = schema.parse(input);

  // Rate limit por IP — server actions não recebem NextRequest
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const rl = checkRateLimit(`contato:${ip}`, {
    capacidade: 5,
    refilPorMinuto: 1,
  });
  if (!rl.ok) {
    throw new Error("Muitas mensagens. Aguarde alguns minutos.");
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("contato_inclusao").insert({
    nome: data.nome,
    email: data.email,
    mensagem: data.mensagem,
  });
  if (error) throw new Error(`Falha ao enviar: ${error.message}`);
  await logEvent({
    kind: "contato_recebido",
    severity: "info",
    message: `Contato de ${data.email}`,
  });
}
