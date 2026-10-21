import { paraWhatsApp } from "@/lib/ayla/apresentacao";

/** A sugestão é um rascunho; somente o Admin pode copiá-la para o texto final. */
export const PROMPT_REDACAO_CAMPANHA = `Você ajuda Karina a redigir comunicados da Kolo Família para WhatsApp.

Escreva UMA mensagem pronta para revisão humana, em português brasileiro.
Voz próxima e empática, sem exagero, sem jargão e sem promessas de resultado.
Use blocos curtos, linhas em branco, títulos úteis e *negrito* pontual no padrão WhatsApp.
Organize em tópicos quando houver mais de uma informação. Deixe claro o convite ou próximo passo.
Use apenas fatos, datas, horários, valores, nomes e links fornecidos pela Karina; nunca os invente.
Não adicione assinatura, urgência, desconto ou link que ela não pediu.
Se houver texto anterior e pedido de ajuste, preserve os fatos do texto anterior e altere somente o solicitado.
Não inclua comentários sobre o processo, aspas envolvendo a mensagem nem alternativas numeradas.`;

export type PedidoRedacaoCampanha = {
  objetivo: string;
  textoAtual?: string;
  ajuste?: string;
};

export function montarPedidoRedacaoCampanha(p: PedidoRedacaoCampanha): string {
  return [
    `Objetivo e informações confirmadas por Karina:\n${p.objetivo.trim()}`,
    p.textoAtual?.trim() ? `Rascunho atual:\n${p.textoAtual.trim()}` : "",
    p.ajuste?.trim() ? `Ajuste solicitado:\n${p.ajuste.trim()}` : "",
    "Devolva apenas a mensagem sugerida para WhatsApp.",
  ].filter(Boolean).join("\n\n");
}

/** Normaliza a saída e impede que a IA acrescente um destino não informado. */
export function validarSugestaoCampanha(texto: string, entrada: PedidoRedacaoCampanha): string {
  const normalizado = paraWhatsApp(texto).trim();
  if (normalizado.length < 20 || normalizado.length > 4000) {
    throw new Error("A sugestão veio vazia ou longa demais. Peça uma nova redação.");
  }
  const fontes = `${entrada.objetivo}\n${entrada.textoAtual ?? ""}\n${entrada.ajuste ?? ""}`;
  const links = normalizado.match(/https?:\/\/[^\s<>]+/gi) ?? [];
  if (links.some((link) => !fontes.includes(link.replace(/[.,;!?]+$/, "")))) {
    throw new Error("A sugestão incluiu um link não informado. Peça uma nova redação.");
  }
  return normalizado;
}
