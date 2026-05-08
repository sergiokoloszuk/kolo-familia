"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

const schema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  contexto: z.string().trim().max(500).optional(),
});

export async function entrarNaListaEspera(
  input: z.infer<typeof schema>,
): Promise<void> {
  const data = schema.parse(input);
  const admin = createServiceRoleClient();
  const mensagem = data.contexto
    ? `[lista-espera] ${data.contexto}`
    : "[lista-espera] Quero ser notificada quando o beta fechado abrir vagas.";
  const { error } = await admin.from("contato_inclusao").insert({
    nome: data.nome,
    email: data.email,
    mensagem,
  });
  if (error) throw new Error(`Falha ao registrar: ${error.message}`);
  await logEvent({
    kind: "lista_espera",
    severity: "info",
    message: `Lista de espera: ${data.email}`,
  });
}
