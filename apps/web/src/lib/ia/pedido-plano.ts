/**
 * Heurística NEUTRA (sem deps de servidor): a mensagem da mãe é um pedido
 * explícito de plano/roteiro?
 *
 * Fonte única usada pelos dois canais — a ponte do WhatsApp (orchestrator) e a
 * Estratégias no app (página da conversa) — pra que ambos reconheçam o pedido
 * do MESMO jeito. Se um canal alargar a lista de verbos, o outro acompanha.
 */
export function pedeUmPlano(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (!/\b(plano|roteiro|passo a passo|passo-a-passo)\b/.test(t)) return false;
  // Exige um verbo de pedido perto, pra não confundir com feedback
  // ("o plano funcionou", "valeu pelo plano"). Inclui tanto verbos de CRIAR
  // (faz, monta, elabora…) quanto de ENTREGAR (traz, manda, envia, mostra,
  // retoma…) — a mãe pode pedir "monta um plano" ou "traga/manda o plano".
  return /\b(quero|queria|preciso|gostaria|pode|poderia|consegue|tem como|me (faz|d[aá]|ajuda|monta|monte|prepara|traz|manda|mande|envia|envie|mostra|passa)|faz|fazer|monta|montar|cria|criar|prepara|preparar|elabora|elaborar|traz|trazer|traga|manda|mandar|mande|envia|enviar|envie|mostra|mostrar|mostre|passa|passar|retoma|retomar|retome)\b/.test(
    t,
  );
}
