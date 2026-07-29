/**
 * Link que abre a conversa com a Ayla no WhatsApp, já com a primeira mensagem
 * escrita.
 *
 * Por que importa: dos 15 leads que concluíram o cadastro em julho, 7 nunca
 * escreveram pra Ayla — e nenhum deles ativou. A Ayla manda boas-vindas
 * sozinha, mas responder a um desconhecido é mais difícil do que tocar num
 * botão. Com a mensagem pré-preenchida, a mãe não precisa saber o que dizer, e
 * a conversa nasce iniciada por ela (o que também abre a janela de resposta do
 * WhatsApp).
 *
 * O número vem de `configuracao_geral.ayla_whatsapp` (a Z-API não expõe pro app
 * qual número está conectado na instância) e é lido no servidor, porque o admin
 * troca sem deploy. Sem número configurado, quem chama esconde o caminho —
 * melhor não oferecer do que oferecer um link quebrado.
 */

/** Monta o wa.me a partir do número JÁ resolvido (só dígitos). */
export function linkConversaAyla(numero: string | null, primeiraMensagem: string): string | null {
  const num = (numero ?? "").replace(/\D/g, "");
  if (num.length < 12) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(primeiraMensagem)}`;
}

/**
 * A primeira fala é da MÃE, não da Ayla — por isso é simples e sem promessa:
 * quem responde de verdade é a Ayla, do outro lado.
 */
export function primeiraMensagemDaMae(nomeCrianca: string): string {
  const n = nomeCrianca.trim();
  return n ? `Oi, Ayla! Acabei de me cadastrar. Quero falar sobre ${n}.` : "Oi, Ayla! Acabei de me cadastrar.";
}
