/**
 * Link que abre a conversa com a Ayla no WhatsApp, já com a primeira mensagem
 * escrita.
 *
 * Por que importa: dos 15 leads que concluíram o cadastro em julho, 7 nunca
 * escreveram pra Ayla — e nenhum deles ativou. A Ayla manda boas-vindas sozinha,
 * mas responder a um desconhecido é mais difícil do que tocar num botão. Com a
 * mensagem pré-preenchida, a mãe não precisa saber o que dizer, e a conversa
 * nasce iniciada por ela (o que também abre a janela de resposta do WhatsApp).
 *
 * O número sai de NEXT_PUBLIC_AYLA_WHATSAPP (a Z-API não expõe o número da
 * instância pro app). Sem a variável, devolve null e quem chama esconde o
 * caminho — melhor não oferecer do que oferecer um link quebrado.
 */

/** Só dígitos, como o wa.me espera (sem +, sem espaço, sem parênteses). */
function digitos(v: string | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function linkConversaAyla(primeiraMensagem: string): string | null {
  const num = digitos(process.env.NEXT_PUBLIC_AYLA_WHATSAPP);
  // 12 = 55 + DDD + 8; abaixo disso é engano de configuração, não número.
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
