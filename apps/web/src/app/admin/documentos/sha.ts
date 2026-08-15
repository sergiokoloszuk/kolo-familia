import { createHash } from "node:crypto";

/**
 * SHA-256 do texto, em UTF-8.
 *
 * ⚠️ MORA FORA DE `actions.ts` de propósito: aquele arquivo é `"use server"`, e
 * o Next exige que TODO export dele seja função async. Um helper síncrono ali
 * derruba o build — e o erro só aparece no `npm run build`, não no `tsc`.
 */
export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
