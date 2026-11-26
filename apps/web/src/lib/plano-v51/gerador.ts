import type { SupabaseClient } from "@supabase/supabase-js";
import { montarContextoDeSecoes } from "@/lib/ia/engine";
import { assemblePrompt } from "@/lib/ia/prompt";
import { gerarConversacional, MODELO_CONVERSA } from "@/lib/ia/provider";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import { validateAntiCopy } from "@/lib/ia/validators";
import { logarUsoApi } from "@/lib/billing/logar";
import { lerConteudoGerado } from "./contrato";
import type { MembroPlano, PlanoV51 } from "./dominio";

const FORMATO = `Formato desta entrega Web V5.1: devolva apenas JSON, sem cercas de código.
{"perguntas":[{"id":"...","texto":"...","opcoes":["..."],"respondidaNoContexto":false}],"olhares":[{"id":"...","titulo":"...","sobre":"crianca|adulto","origem":{"tipo":"relato_hoje|cadastro","frase":"cópia exata da frase de origem disponível"},"blocos":[{"titulo":"...","texto":"..."}]}],"objetivo":"...","estrategias":[{"id":"...","titulo":"...","porque":"...","como":["..."],"minima":"..."}],"dizer":[{"momento":"...","frase":"...","detalhe":"..."}],"evitar":[{"frase":"...","porque":"..."}],"observar":["..."]}
Esta é uma devolutiva de plano, com conteúdo desenvolvido e não apenas uma mensagem breve.
Use o conhecimento pertinente já fornecido no contexto, sem inventar referências. Não exiba as fontes à família.
Perguntas só quando a resposta puder mudar a orientação e não estiver no Perfil/histórico/respostas.
Não crie um roteiro fixo. A interface apresenta uma pergunta de cada vez e aceita não sei.
Cada olhar é HIPÓTESE: ancore em uma frase EXATA do relato de hoje ou na lista explícita de cadastro fornecida.
Histórico e interesses ajudam INTERNAMENTE a personalizar e evitar repetições. Não narre episódios antigos,
semanas, conquistas ou tentativas como se tivessem sido trazidos hoje. Não atribua intenção, sentimento,
compreensão, habilidade, nascimento exato ou crença sem suporte. Se não houver âncora, não crie o olhar.
Desenvolva a compreensão, outras possibilidades e exemplos úteis nos blocos dos olhares.
Cada estratégia é UMA intervenção prioritária, com instruções para executá-la e uma versão mínima.
Alternativas ficam em cartões diferentes; os passos de uma estratégia não são uma lista de intervenções.
Se uma estratégia foi recusada ou não está disponível, adapte o apoio sem apagar conhecimento pertinente.
Não transforme tentativa sem resultado em fracasso nem resultado positivo em conquista. Não crie registros,
lembretes, mensagens enviadas ou memória. Essas ações pertencem ao aplicativo e à confirmação da família.
Nunca condicione compreensão a contato visual, force comunicação ou retenha objetos como exigência.
Texto claro, caloroso, criativo e fundamentado: traduzir, conectar, encantar, provocar e valorizar,
preservando fidelidade e segurança. Use parágrafos de texto simples dentro dos campos, sem HTML.
Olhares podem ser vazios se não houver base. Não faça diagnóstico. Situação urgente exige cuidado
imediato e não deve ser transformada em tarefa do plano. Não altere as proteções independentes do Core.`;

/** Adapta a SAÍDA. Contexto, roteamento, referências, voz e transporte continuam existentes.
 * O output_type antigo limita a 400 palavras/1200 tokens: insuficiente para este JSON completo.
 * Não alteramos esse contrato compartilhado; o formato V5.1 usa seu próprio teto no mesmo provider. */
export async function gerarParaPlano(p: {
  db: SupabaseClient; auditoria: SupabaseClient; familyId: string; membro: MembroPlano;
  titulo: string; relato: string; plano?: PlanoV51; conversa?: { papel: "user" | "assistant"; texto: string }[];
}) {
  const pedido = JSON.stringify({ assunto: p.titulo, relato_hoje: p.relato, cadastro_disponivel: p.membro.cadastro,
    respostas: p.plano?.respostas, sentimento_relatado: p.plano?.sentimento, bateria_relatada: p.plano?.bateria,
    funciona_relato: p.plano?.funciona, combinado: p.plano?.confirmado ? p.plano.combinado : undefined,
    registros_confirmados: p.plano?.registros, conversa_deste_plano: p.conversa });
  const contexto = await montarContextoDeSecoes(p.db, { familyId: p.familyId, membroAtipicoId: p.membro.id, pedido });
  if (contexto.ctx.membroFoco?.id !== p.membro.id) throw new Error("Não foi possível confirmar o membro no contexto da Ayla.");
  const prompt = assemblePrompt({ skills: contexto.roteadas.map(r => r.skill), ctx: contexto.ctx, userInput: pedido, modo: { kind: "conversa" } });
  const chat = p.conversa !== undefined;
  const r = await gerarConversacional({ provider: "openai", model: MODELO_CONVERSA.openai,
    system: [...prompt.system.map(s => s.text), chat ? "Converse naturalmente sobre o plano informado. Não afirme que salvou, enviou, confirmou uma conquista ou ativou lembretes. Não invente fatos. Responda ao último turno, sem repetir toda a ficha." : FORMATO].join("\n\n"),
    messages: prompt.messages, maxTokens: chat ? 2048 : 6000, cacheSystem: true, esforcoRaciocinio: "low" });
  // Registrar inclusive uma saída rejeitada. Nenhum relato ou telefone na telemetria.
  await logarUsoApi(p.auditoria, { family_account_id: p.familyId, provider: r.provider, model: r.model,
    feature: chat ? "plano_v51_conversa" : "plano_v51_conteudo", input_tokens: r.tokensIn, output_tokens: r.tokensOut,
    meta: { origem: "web_v51", duracao_ms: r.ms, referencias: contexto.ctx.boasPraticas.map(b => b.id), aceita: !fronteiraAtravessada(r.texto, contexto.ctx.membroFoco?.diagnosticoRegistrado ?? null) } });
  if (fronteiraAtravessada(r.texto, contexto.ctx.membroFoco?.diagnosticoRegistrado ?? null)) throw new Error("A orientação precisa ser revista antes de ser apresentada.");
  if (!validateAntiCopy(r.texto, contexto.ctx.boasPraticas).ok) throw new Error("A orientação precisa ser reformulada para preservar a fonte.");
  return chat ? { texto: r.texto, conteudo: null } : { texto: null, conteudo: lerConteudoGerado(r.texto) };
}
