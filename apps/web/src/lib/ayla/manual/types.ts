/**
 * Ayla v2 — vocabulário central.
 *
 * Single source of truth pros tipos usados pela arquitetura comportamental
 * derivada do Manual Operacional. NÃO duplicar essas uniões em outros lugares.
 *
 * Referência: Manual Operacional da Ayla §1, §4, §5, §7, §11, §15.
 *
 * Convive com `../types.ts` (Ayla v1 transacional, PRD §12). Os dois sistemas
 * têm vocabulários distintos:
 *
 *   - v1 lida com `tipo: rotina | engajamento_2dias | trial_d3 | ...` —
 *     identificadores transacionais de templates específicos
 *   - v2 lida com `modo: acolhimento | orientacao | ...` — abstração
 *     comportamental que se aplica a múltiplos templates
 */

/**
 * Os 5 modos operacionais da Ayla (§5).
 * A Ayla alterna entre eles dinamicamente conforme contexto e intent detectados.
 */
export type AylaMode =
  | "acolhimento"   // §5.1 — mãe cansada/frustrada/culpada/sobrecarregada
  | "orientacao"    // §5.2 — desafio específico, busca ação prática
  | "investigacao"  // §5.3 — falta contexto, hipótese a explorar
  | "follow_up"     // §5.4 — continuidade, memória viva, sem cobrança
  | "registro";     // §5.5 — padrão recorrente / mudança / conquista

/**
 * Intenção detectada na mensagem da mãe (§7).
 * Vocabulário fechado — adicionar item exige decisão de produto.
 */
export type AylaIntent =
  | "desabafo"
  | "pergunta_pratica"
  | "conquista"
  | "crise"
  | "atualizacao"
  | "duvida";

/**
 * Estado emocional percebido (§5.1, §7, §10).
 * Inferido pelo classifier — não vai à mãe como afirmação, só guia tom interno.
 *
 * Nota: a v1 (`ayla_daily_checkins.emocao_mae`) tem um vocabulário próximo mas
 * menor: 'muito_bem' | 'bem' | 'neutro' | 'triste' | 'cansada' |
 * 'ansiosa_estressada'. O bridge (futuro) precisa mapear entre os dois.
 */
export type EstadoEmocional =
  | "estavel"
  | "cansada"
  | "frustrada"
  | "culpada"
  | "sobrecarregada"
  | "aliviada"
  | "feliz";

export type Intensidade = "baixa" | "media" | "alta";
export type Urgencia = "baixa" | "media" | "alta";

/**
 * Domínios cobertos pelo Kolo Vivo (§12). Vocabulário controlado — o
 * classifier escolhe um subconjunto destes pra cada turno. Adições exigem
 * coordenação com o schema do `perfil_vivo_membro` (jsonb bag) e com a
 * taxonomia das skills/boas-práticas.
 *
 * Categorias estendidas vivem no `perfil_vivo_membro.categorias_extras` (26
 * categorias, Adendo PRD v1 §6) — a interseção dessas categorias com este
 * vocabulário é coordenada via tabela `dominio_skill_categoria` (futura).
 */
export type DominioKolo =
  | "sono"
  | "alimentacao"
  | "comunicacao"
  | "socializacao"
  | "sensorial"
  | "regulacao_emocional"   // engloba meltdown/shutdown (§18) como manifestações
  | "hiperfocos"
  | "rotina"
  | "transicoes"            // §19 — progressão gradual
  | "autonomia"
  | "auto_cuidado_mae"
  | "familia"
  | "escola"
  | "saude";

/**
 * NOTA SOBRE meltdown/shutdown:
 * São TIPOS DE EVENTO (manifestações agudas), não domínios estruturais.
 * O domínio onde uma crise se manifesta é tipicamente `regulacao_emocional`.
 * Eventos `meltdown_relatado` e `shutdown_relatado` ficam em
 * `lib/ayla/manual/memory.ts` (TipoEvento).
 */

/**
 * Hierarquia operacional (§6). Ordem de prioridade quando a Ayla decide
 * a que responde primeiro. Necessidade emocional vem antes da técnica.
 */
export type NecessidadePrincipal =
  | "regular"        // §6.1 — regulação emocional (acolher)
  | "interpretar"    // §6.2 — leitura neurofuncional do que está acontecendo
  | "orientar"       // §6.3 — direção prática
  | "aprofundar"     // §6.4 — entender melhor antes de orientar
  | "registrar";     // §6.5 — capturar / alimentar Kolo Vivo

/**
 * Canais (§11) — WhatsApp e app são contextos diferentes com regras distintas.
 */
export type Canal = "whatsapp" | "app";

/**
 * Score de confiança (0..1) — usado em padrões emergentes e em sugestões de
 * atualização do perfil. Determina como o dado aparece na interface:
 *
 * - `>= 0.8`  : mostrar sem disclaimer
 * - `>= 0.5`  : prefixar "parece que..." ou similar
 * - `<  0.5`  : NÃO usar em resposta; ficar como sugestão pendente
 *
 * Ver `./guardrails.ts` para uso prático.
 */
export type Confianca = number;

/**
 * Identificadores tipados pra cruzar referências entre módulos.
 * Usar tipos nominal (branded) ajuda a evitar passar id errado em chamadas.
 *
 * Construção: ids vêm como string do Supabase — use `as FamilyAccountId`
 * apenas em fronteiras de tipo (onde lemos do banco / da API).
 */
export type FamilyAccountId = string & { readonly __brand: "FamilyAccountId" };
export type MembroAtipicoId = string & { readonly __brand: "MembroAtipicoId" };
export type ConversaId = string & { readonly __brand: "ConversaId" };
export type EventoId = string & { readonly __brand: "EventoId" };
export type PadraoId = string & { readonly __brand: "PadraoId" };
