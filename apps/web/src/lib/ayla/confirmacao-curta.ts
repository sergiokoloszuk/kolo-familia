/** Fechamento de uma conversa já respondida; nunca interpreta um aceite como ação. */
export const TEXTO_FECHAMENTO_CURTO = "Combinado 🌿";
export const TEXTO_AGRADECIMENTO_CURTO = "Por nada 💛";

const FECHAMENTOS = new Set([
  "ok", "okay", "ta bom", "tudo bem", "certo", "entendi", "combinado",
  "obrigada", "obrigado", "valeu", "perfeito",
]);

export function ehFechamentoSocial(mensagem: string): boolean {
  const normalizada = mensagem.toLowerCase().normalize("NFD")
    .replace(/\p{Diacritic}/gu, "").replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ").trim();
  return FECHAMENTOS.has(normalizada);
}

export function textoFechamentoCurto(mensagem: string): string {
  return /^obrigad[ao]\b/iu.test(mensagem.trim()) ? TEXTO_AGRADECIMENTO_CURTO : TEXTO_FECHAMENTO_CURTO;
}

const PEDIDO_DE_CONTINUACAO =
  /\?|\b(?:se quiser|posso|quer que|responda|pode responder|escolha|confirme|toque em|clique em|gerar cart[oõ]es|montar (?:um |o )?plano)\b/iu;

export type DecisaoConfirmacaoCurta = "responder" | "silencio" | "seguir";

/**
 * Só fecha uma resposta comum e recente que não pediu decisão nem ação.
 * "Sim" fica deliberadamente fora: pode autorizar plano, história ou registro.
 * Falta de histórico confiável falha aberto para o fluxo conversacional.
 */
export function decidirConfirmacaoCurta(params: {
  mensagem: string;
  ultimaSaida: { texto: string | null; created_at: string; tipo: string | null } | null;
  agora: Date;
  perguntaPendente: boolean;
  artefatoPendente: boolean;
  segurancaAberta: boolean;
  rotinaPendente: boolean;
  ofertaFimDeSemanaPendente: boolean;
}): DecisaoConfirmacaoCurta {
  if (!ehFechamentoSocial(params.mensagem)) return "seguir";
  if (params.perguntaPendente || params.artefatoPendente || params.segurancaAberta ||
      params.rotinaPendente || params.ofertaFimDeSemanaPendente) return "seguir";
  const saida = params.ultimaSaida;
  if (!saida?.texto || !saida.created_at) return "seguir";
  if (!["resposta_registro", "confirmacao_curta"].includes(saida.tipo ?? "")) return "seguir";
  const idade = params.agora.getTime() - new Date(saida.created_at).getTime();
  if (!Number.isFinite(idade) || idade < 0 || idade > 2 * 60 * 60_000) return "seguir";
  if ([TEXTO_FECHAMENTO_CURTO, TEXTO_AGRADECIMENTO_CURTO].includes(saida.texto.trim())) return "silencio";
  if (PEDIDO_DE_CONTINUACAO.test(saida.texto)) return "seguir";
  return "responder";
}
