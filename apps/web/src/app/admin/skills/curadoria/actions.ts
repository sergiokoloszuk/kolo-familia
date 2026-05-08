"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sugerirSkill, type SkillSuggestion } from "@/lib/admin/skill-suggestion";

const inputSchema = z.object({
  demanda: z.string().trim().min(15).max(2000),
});

export type AvaliarDemandaResult =
  | { ok: true; suggestion: SkillSuggestion }
  | { ok: false; erro: string };

export async function avaliarDemanda(
  input: z.infer<typeof inputSchema>,
): Promise<AvaliarDemandaResult> {
  const { demanda } = inputSchema.parse(input);
  const { supabase } = await requireAdmin();

  const { data: skills } = await supabase
    .from("specialist_prompt_templates")
    .select("name, display_name, objective, routing_keywords")
    .eq("ativo", true);

  if (!skills || skills.length === 0) {
    return { ok: false, erro: "Sem skills cadastradas pra comparar." };
  }

  const result = await sugerirSkill({
    demanda,
    skillsAtuais: skills.map((s) => ({
      name: s.name as string,
      display_name: s.display_name as string,
      objective: s.objective as string,
      routing_keywords: (s.routing_keywords as string[]) ?? [],
    })),
  });

  if ("erro" in result) {
    return { ok: false, erro: result.erro };
  }

  return { ok: true, suggestion: result };
}
