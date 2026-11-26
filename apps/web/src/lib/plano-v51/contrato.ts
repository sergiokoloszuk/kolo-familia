import { z } from "zod";
import type { ConteudoPlano, PlanoV51 } from "./dominio";

const texto = z.string().trim().min(1).max(8000);
export const conteudoSchema = z.object({
  perguntas: z.array(z.object({ id: texto, texto, opcoes: z.array(texto).min(1).max(8), respondidaNoContexto: z.boolean().optional() })).max(10),
  olhares: z.array(z.object({ id: texto, titulo: texto, sobre: z.enum(["crianca", "adulto"]), origem: z.object({ tipo: z.enum(["relato_hoje", "cadastro"]), frase: texto }), blocos: z.array(z.object({ titulo: texto, texto })).min(1).max(8) })).max(12),
  objetivo: texto,
  estrategias: z.array(z.object({ id: texto, titulo: texto, porque: texto, como: z.array(texto).min(1).max(8), minima: texto })).min(1).max(8),
  dizer: z.array(z.object({ momento: texto, frase: texto, detalhe: texto })).max(12),
  evitar: z.array(z.object({ frase: texto, porque: texto })).max(12), observar: z.array(texto).max(10),
});
const acaoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("navegar"), passo: z.number().int().min(0).max(13) }),
  z.object({ tipo: z.literal("avancar") }),
  z.object({ tipo: z.literal("responder"), perguntaId: texto, resposta: texto }),
  z.object({ tipo: z.literal("contexto"), campo: z.enum(["sentimento", "bateria", "funciona", "objetivo"]), valor: z.string().max(2000) }),
  z.object({ tipo: z.literal("escolher"), estrategiaId: texto }),
  z.object({ tipo: z.literal("depois"), estrategiaId: texto }),
  z.object({ tipo: z.literal("frase"), indice: z.number().int().min(0).max(11) }),
  z.object({ tipo: z.literal("combinado"), campo: z.enum(["quando", "frequencia", "quem", "voltarEm"]), valor: z.string().max(500) }),
  z.object({ tipo: z.literal("confirmar") }),
  // Não aceitar autorização de envio do browser: não há transporte homologado nesta fatia.
  z.object({ tipo: z.literal("desligar_lembrete") }),
  z.object({ tipo: z.literal("pausar") }), z.object({ tipo: z.literal("encerrar") }), z.object({ tipo: z.literal("retomar") }),
  z.object({ tipo: z.literal("registrar"), registro: z.object({ id: z.string().uuid(), origem: z.literal("web"), tipo: z.enum(["tentativa", "sem_tentativa"]), estrategiaId: texto, relato: z.string().max(8000), resultado: z.enum(["ajudou", "parcial", "nao_mudou", "incerto"]).optional(), aprendizado: z.string().max(2000).optional() }) }),
  z.object({ tipo: z.literal("conquista"), registroId: z.string().uuid(), melhoria: texto, confirma: z.boolean() }),
  z.object({ tipo: z.literal("feedback"), nota: z.number().int().min(1).max(5), comentario: z.string().max(2000) }),
]);
export const loteSchema = z.object({ planoId: z.string().uuid(), membroId: z.string().uuid(), revisao: z.number().int().min(0), eventos: z.array(z.object({ id: z.string().uuid(), acao: acaoSchema })).min(1).max(30) });

export const MARCADOR_V51 = "__plano_web_v51__";
/** Extensão versionada SOMENTE em novos planos. Não converte o resultado agregado legado.
 * Usa o JSONB de seções já existente; não acrescenta tabela, coluna, índice ou memória. */
export function secoesDoPlano(p: PlanoV51) {
  return [{ tipo: MARCADOR_V51, titulo: "Plano de desenvolvimento", conteudo_markdown: "", versao: 1, revisao: p.revisao, plano: p }];
}
export function lerPlanoV51(secoes: unknown): PlanoV51 | null {
  if (!Array.isArray(secoes)) return null;
  const envelope = secoes.find(s => s && typeof s === "object" && s.tipo === MARCADOR_V51);
  if (!envelope) return null;
  if (envelope.versao !== 1 || !envelope.plano || envelope.revisao !== envelope.plano.revisao) throw new Error("Versão do plano não reconhecida.");
  const p = envelope.plano as PlanoV51;
  if (!p.id || !p.familyId || !p.membroId || !Number.isInteger(p.revisao) || !Array.isArray(p.eventos) || !Array.isArray(p.registros) || !p.combinado || !p.lembretes || !p.estados || !Number.isInteger(p.passo) || p.passo < 0 || p.passo > 13) throw new Error("Plano incompleto. Nenhuma atualização foi realizada.");
  conteudoSchema.parse(p.conteudo);
  return p;
}
export function lerConteudoGerado(raw: string): ConteudoPlano {
  const json = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  return conteudoSchema.parse(JSON.parse(json));
}
