import { z } from "zod";

// Réplica EXATA do ParserSchema atual (parser.ts)
const ParserSchemaAtual = z.object({
  membro_atipico_id: z.string().uuid().nullable(),
  confianca_identificacao: z.number().min(0).max(100),
  conquista: z.string().nullable(),
  desafio: z.string().nullable(),
  emocao_mae: z.enum(["muito_bem", "bem", "neutro", "triste", "cansada", "ansiosa_estressada"]).nullable(),
  possivel_gatilho: z.string().nullable(),
  observacao_livre: z.string().nullable(),
  quem_estava: z.enum(["mae", "pai", "avo_a", "avo_o", "irmao_a", "baba", "professor_a", "outro"]).nullable(),
  estado_adulto: z.enum(["calmo", "firme", "cansado", "ansioso", "impaciente"]).nullable(),
  reacao_adulto: z.enum(["acolhedor", "esperou", "interveio", "impositivo", "chamou_ajuda", "outro"]).nullable(),
  confianca_camada_adulto: z.number().min(0).max(100),
  sugestao_kolo_vivo: z.boolean(),
  campo_kolo_vivo_sugerido: z.string().optional(),
  texto_kolo_vivo_sugerido: z.string().optional(),
  confianca: z.number().min(0).max(100),
  precisa_clarificar: z.string().optional(),
});

// Output REAL do Haiku pra "brócolis" (do meu diag anterior) — com nulls
const outputReal = {
  membro_atipico_id: "11111111-1111-1111-1111-111111111111",
  confianca_identificacao: 95,
  conquista: null,
  desafio: "recusa em comer brócolis",
  emocao_mae: "neutro",
  possivel_gatilho: null,
  observacao_livre: null,
  quem_estava: "mae",
  estado_adulto: null,
  reacao_adulto: null,
  confianca_camada_adulto: 0,
  sugestao_kolo_vivo: false,
  campo_kolo_vivo_sugerido: null,
  texto_kolo_vivo_sugerido: null,
  confianca: 60,
  precisa_clarificar: "Qual foi a reação da mãe?",
};

const r = ParserSchemaAtual.safeParse(outputReal);
console.log("Schema ATUAL aceita output real do Haiku?", r.success);
if (!r.success) {
  console.log("\nERROS (é por isso que o parser cai no fallback → bounce):");
  for (const issue of r.error.issues) console.log(`  - ${issue.path.join(".")}: ${issue.message}`);
}

// Schema corrigido (nullish nos campos opcionais)
const ParserSchemaFix = ParserSchemaAtual.extend({
  campo_kolo_vivo_sugerido: z.string().nullish(),
  texto_kolo_vivo_sugerido: z.string().nullish(),
  precisa_clarificar: z.string().nullish(),
});
const r2 = ParserSchemaFix.safeParse(outputReal);
console.log("\nSchema CORRIGIDO aceita?", r2.success);
