"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { respond } from "@/lib/ia/engine";
import { requireActiveWrite } from "@/lib/auth/require-active-write";

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) throw new Error("Família não inicializada");
  return { supabase, user, family };
}

const enviarSchema = z.object({
  conversaId: z.string().uuid().nullable(),
  membroAtipicoId: z.string().uuid().nullable(),
  texto: z.string().trim().min(1, "Mensagem vazia").max(2000),
});

export async function enviarMensagem(input: z.infer<typeof enviarSchema>): Promise<{
  conversaId: string;
}> {
  const { conversaId, membroAtipicoId, texto } = enviarSchema.parse(input);
  const { supabase, family } = await requireFamily();

  // Gate de assinatura — bloqueia escrita em paused/canceled
  await requireActiveWrite(family.id);

  // 1. Cria a conversa se for primeira mensagem
  let conversaIdFinal: string;
  if (conversaId) {
    conversaIdFinal = conversaId;
  } else {
    const { data: nova, error } = await supabase
      .from("conversas")
      .insert({
        family_account_id: family.id,
        membro_atipico_id: membroAtipicoId,
        titulo: texto.slice(0, 80),
      })
      .select("id")
      .single();
    if (error || !nova) throw new Error(`Falha ao criar conversa: ${error?.message}`);
    conversaIdFinal = nova.id as string;
  }

  // 2. Persiste mensagem da mãe
  await supabase.from("mensagens_skill").insert({
    conversa_id: conversaIdFinal,
    family_account_id: family.id,
    papel: "user",
    conteudo: texto,
  });

  // 3. Chama o engine
  const resposta = await respond({
    supabase,
    familyId: family.id,
    membroAtipicoId,
    conversaId: conversaIdFinal,
    userInput: texto,
  });

  // 4. Persiste resposta do assistente
  await supabase.from("mensagens_skill").insert({
    conversa_id: conversaIdFinal,
    family_account_id: family.id,
    papel: "assistant",
    conteudo: resposta.texto,
    skills_acionadas: resposta.skillsAcionadas,
    metadata: { validacao: resposta.validacao },
    tokens_input: resposta.uso.tokens_input,
    tokens_output: resposta.uso.tokens_output,
  });

  revalidatePath("/conversar");
  if (conversaIdFinal !== conversaId) {
    revalidatePath(`/conversar/${conversaIdFinal}`);
  }

  return { conversaId: conversaIdFinal };
}
