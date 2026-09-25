/**
 * Chave operacional única para suspender o artefato Plano no WhatsApp.
 *
 * O comportamento histórico continua ligado quando a variável não existe.
 * Produção desliga explicitamente com `AYLA_PLANOS_WHATSAPP=off`. Assim a
 * decisão é reversível sem apagar Planos antigos nem mexer na criação manual
 * dentro do app.
 */
export function planosWhatsappLigados(): boolean {
  try {
    const valor = (process.env.AYLA_PLANOS_WHATSAPP ?? "").trim().toLowerCase();
    return !["0", "false", "off"].includes(valor);
  } catch {
    // Falha de configuração não pode voltar a entregar um artefato suspenso.
    return false;
  }
}

/**
 * Suspender o artefato não suspende a ajuda. A família não precisa conhecer
 * uma decisão interna de produto nem receber uma promessa que o sistema
 * bloqueará logo depois.
 */
export const BLOCO_PLANO_WHATSAPP_SUSPENSO = `<plano_whatsapp_suspenso>
O artefato Plano está indisponível neste canal agora.

NÃO ofereça, prometa, gere ou envie Plano, PDF de Plano, link de Plano nem “plano estratégico”. Não diga que a funcionalidade foi suspensa e não mande a família esperar.

Se a família pedir um plano, entenda isso como um pedido de ajuda organizada: responda com a menor orientação útil para a situação atual, usando Perfil, histórico e repertório. Entregue uma ação concreta agora e, quando fizer sentido, ofereça somente experiências realmente disponíveis, como brincadeira, história ou rotina visual.
</plano_whatsapp_suspenso>`;
