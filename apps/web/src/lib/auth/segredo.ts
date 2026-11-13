import { timingSafeEqual, createHash } from "node:crypto";

/**
 * Compara em tempo constante, sem vazar o segredo por tamanho. O hash iguala o
 * comprimento — `timingSafeEqual` estoura com buffers de tamanhos diferentes.
 * Mesmo padrão de `api/ludico/gerar-rotina` (que mantém a própria cópia: o
 * contrato daquela rota é provado por `rotina-contrato.test.ts`).
 */
export function segredoConfere(enviado: string | null, esperado: string): boolean {
  if (!enviado) return false;
  const a = createHash("sha256").update(enviado).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

/**
 * Autorização dos crons por `Authorization: Bearer <CRON_SECRET>`.
 *
 * FAIL-CLOSED: sem a variável no ambiente, ninguém passa. Era
 * `if (expectedSecret) {...}` em `/api/ayla/cron` e `/api/admin/uso/snapshot`:
 * se a variável sumisse num redeploy ou numa troca de hospedagem, disparo de
 * WhatsApp em massa, campanhas e rotina fiscal ficavam abertos a qualquer um.
 * `exclusao-pagamento` e `retencao-contas` já recusavam assim.
 */
export function cronAutorizado(
  authorization: string | null,
): "ok" | "sem_segredo" | "negado" {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return "sem_segredo";
  return segredoConfere(authorization, `Bearer ${segredo}`) ? "ok" : "negado";
}
