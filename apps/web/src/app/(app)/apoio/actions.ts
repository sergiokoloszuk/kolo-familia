"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { respondAsOutputType } from "@/lib/ia/engine";

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

const gerarSchema = z.object({
  outputTypeKey: z.string().min(1),
  membroAtipicoId: z.string().uuid().nullable(),
  pedido: z.string().trim().min(3, "Descreva pelo menos um pouco do contexto").max(2000),
});

export type GerarApoioResultado = {
  texto: string;
  skillsAcionadas: Array<{ name: string; display_name: string }>;
  validacaoOk: boolean;
  validacaoMotivo?: string;
};

export async function gerarApoio(
  input: z.infer<typeof gerarSchema>,
): Promise<GerarApoioResultado> {
  const { outputTypeKey, membroAtipicoId, pedido } = gerarSchema.parse(input);
  const { supabase, family } = await requireFamily();

  const { data: tipo, error } = await supabase
    .from("output_types")
    .select("key, label, prompt_template")
    .eq("key", outputTypeKey)
    .eq("ativo", true)
    .maybeSingle();
  if (error || !tipo) {
    throw new Error(`Tipo de apoio "${outputTypeKey}" não encontrado.`);
  }

  const resposta = await respondAsOutputType({
    supabase,
    familyId: family.id,
    membroAtipicoId,
    outputType: {
      key: tipo.key,
      label: tipo.label,
      prompt_template: tipo.prompt_template,
    },
    pedido,
  });

  return {
    texto: resposta.texto,
    skillsAcionadas: resposta.skillsAcionadas.map((s) => ({
      name: s.name,
      display_name: s.display_name,
    })),
    validacaoOk: resposta.validacao.ok,
    validacaoMotivo: resposta.validacao.ok ? undefined : resposta.validacao.motivo,
  };
}
