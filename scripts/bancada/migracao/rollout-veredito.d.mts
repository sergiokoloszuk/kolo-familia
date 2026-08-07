/**
 * Tipos do veredito de rollout.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE: o módulo é `.mjs` (roda no node, fora do
 * build do app) mas é testado pelo vitest, que é typechecked. Sem declaração,
 * a resolução do import mudava de plataforma — no Windows dava erro e no CI
 * Linux não, então um `@ts-expect-error` passava local e quebrava o CI com
 * "Unused '@ts-expect-error' directive". Tipo de verdade resolve nos dois.
 */

export type ChamadaApi = {
  family_account_id: string;
  provider: string;
  feature?: string;
  model?: string;
  custo_usd?: number | string | null;
};

export type ResumoFamilia = {
  openai: number;
  anthropic: number;
  usd: number;
  modelos: Set<string>;
  canais: Set<string>;
};

export type Veredito = {
  /** Família fora da allowlist atendida pelo GPT — o erro grave. */
  vazamentos: Array<[string, ResumoFamilia]>;
  /** Autorizada recebendo Claude — configuração que não valeu. */
  naoChegou: Array<[string, ResumoFamilia]>;
  /** Autorizada que ainda não conversou — silêncio, não falha. */
  semDado: string[];
};

export declare const FEATURES_CONVERSA: string[];
export declare function ehConversacional(feature?: string): boolean;
export declare function agruparPorFamilia(
  chamadas: readonly ChamadaApi[],
): Map<string, ResumoFamilia>;
export declare function veredito(
  porFamilia: Map<string, ResumoFamilia>,
  autorizadas: Set<string>,
): Veredito;
