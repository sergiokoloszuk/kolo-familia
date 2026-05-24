"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { calcularDASS21, type DASS21Resultado } from "@/lib/dass21";
import { hojeLocalISO } from "@/lib/idade";

async function requireUserAndFamily() {
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

const schema = z.object({
  respostas: z.array(z.number().int().min(0).max(3)).length(21),
});

export type AplicarDASS21Result = {
  scores: DASS21Resultado["scores"];
  faixas: DASS21Resultado["faixas"];
  algumaSevera: boolean;
  algumaModeradaOuPior: boolean;
};

export async function aplicarDASS21(input: z.infer<typeof schema>): Promise<AplicarDASS21Result> {
  const { respostas } = schema.parse(input);
  const { supabase, user, family } = await requireUserAndFamily();

  const resultado = calcularDASS21(respostas);

  await supabase.from("dass21_aplicacoes").insert({
    user_id: user.id,
    family_account_id: family.id,
    data_aplicacao: hojeLocalISO(),
    respostas,
    score_depressao: resultado.scores.depressao,
    score_ansiedade: resultado.scores.ansiedade,
    score_estresse: resultado.scores.estresse,
    faixa_depressao: resultado.faixas.depressao,
    faixa_ansiedade: resultado.faixas.ansiedade,
    faixa_estresse: resultado.faixas.estresse,
  });

  revalidatePath("/registrar");
  revalidatePath("/registrar/dass-21");

  return {
    scores: resultado.scores,
    faixas: resultado.faixas,
    algumaSevera: resultado.algumaSevera,
    algumaModeradaOuPior: resultado.algumaModeradaOuPior,
  };
}
