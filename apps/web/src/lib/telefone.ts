/**
 * Normalização de telefone BR pra COMPARAÇÃO (não pra exibição).
 *
 * Resolve a pegadinha do 9º dígito + variações de país/formato: dois
 * números que são "o mesmo WhatsApp" colapsam na mesma chave. Usado pra
 * casar inbound→família (orchestrator) e pra impedir duas famílias com o
 * mesmo número (validação no onboarding).
 *
 * Ex.: "+55 (11) 99477-0067", "5511994770067" e "1199770067" → "1199770067".
 */
export function chaveTelefoneBR(phone: string | null | undefined): string {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2); // remove país
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3); // remove 9º dígito
  return d;
}
