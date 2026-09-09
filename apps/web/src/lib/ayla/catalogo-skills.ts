import type { SkillDoCatalogo } from "./intent";
import { logEvent } from "@/lib/log";

/**
 * O CATÁLOGO DO CLASSIFICADOR — só as skills LIGADAS, só nome e keywords.
 *
 * Vive fora de `intent.ts` de propósito. Aquele módulo é classificação pura:
 * texto entra, quatro campos saem, e `entrega.test.ts` trava isso com
 * `expect(INTENT).not.toMatch(/from\("/)` — a garantia, de 02/08, de que o tema
 * ativo não trouxe dependência de banco junto. Somar um `select` lá dentro
 * quebraria essa propriedade por conveniência.
 *
 * `ativo=false` não chega ao prompt, então uma skill desligada não tem como ser
 * roteada pra família real. É a trava na origem: não depende de ninguém lembrar
 * de filtrar depois.
 *
 * Cacheado em memória por 5 minutos porque isto roda a cada mensagem e a lista
 * muda uma vez por mês. Não é chamada de LLM — é um select de duas colunas —
 * mas somar uma ida ao banco por turno no caminho mais quente do produto seria
 * pagar caro por um dado praticamente estático.
 */

/**
 * ⚠️ FALHA E VAZIO SÃO COISAS DIFERENTES — PEND-184, 09/09/2026.
 *
 * A versão anterior devolvia `[]` nos dois casos. Consequência medida no
 * primeiro turno humano do Gate B: `decidirTurno` só monta o bloco
 * `<catalogo_de_skills>` quando a lista não está vazia, e o contrato manda
 * "SOMENTE nomes do catálogo oferecido. Se nada do catálogo servir, devolva
 * []". Sem o bloco, o modelo obedece e devolve vazio — **com razão**.
 *
 * Medido em bancada com o decisor real: com o bloco presente, 0 de 25
 * execuções devolveram vazio; sem o bloco, 5 de 5. O modelo nunca errou. O que
 * havia era um fail-open que apagava, de uma vez, a lacuna do Gate B e o
 * repertório de Boas Práticas — sem erro, sem log persistido, sem rastro.
 *
 * ⚠️ E O VAZIO LEGÍTIMO CONTINUA EXISTINDO. Se alguém desativar as 13 skills no
 * Admin, o select tem sucesso e devolve zero linhas. Isso é um estado real do
 * produto, e não pode ser confundido com indisponibilidade: por isso
 * `{ estado: "ok", skills: [] }` é uma resposta possível e distinta.
 */
export type CatalogoSkills =
  | { estado: "ok"; skills: SkillDoCatalogo[] }
  | { estado: "indisponivel"; motivo: string };

let _cache: { em: number; skills: SkillDoCatalogo[] } | null = null;
const TTL_MS = 5 * 60_000;

/**
 * Freio do alarme — no máximo um evento por minuto POR INSTÂNCIA.
 *
 * ⚠️ Serverless: cada invocação pode ser um processo novo, então isto não
 * garante um evento por minuto no sistema todo. Não é coordenação — é só evitar
 * que uma indisponibilidade prolongada no caminho mais quente do produto
 * escreva milhares de linhas em `eventos_app`. O primeiro evento de cada
 * instância sempre sai, que é o que importa para descobrir a falha.
 */
let _ultimoAlarme = 0;
const ALARME_MIN_MS = 60_000;

export async function carregarCatalogoSkills(
  supabase: { from: (t: string) => any },
  familyId?: string | null,
): Promise<CatalogoSkills> {
  if (_cache && Date.now() - _cache.em < TTL_MS) {
    return { estado: "ok", skills: _cache.skills };
  }
  try {
    const { data, error } = await supabase
      .from("specialist_prompt_templates")
      .select("name, routing_keywords")
      .eq("ativo", true);
    if (error) throw new Error(error.message);
    const skills = ((data ?? []) as Array<{ name: string; routing_keywords: unknown }>)
      .map((s) => ({
        name: String(s.name),
        routing_keywords: Array.isArray(s.routing_keywords)
          ? (s.routing_keywords as unknown[]).map(String)
          : [],
      }))
      .filter((s) => s.name);
    // ⚠️ SÓ O SUCESSO É CACHEADO. Guardar uma falha por cinco minutos
    // multiplicaria por sessenta o estrago de uma indisponibilidade de um
    // segundo — que foi exatamente o risco que a PEND-184 expôs.
    _cache = { em: Date.now(), skills };
    return { estado: "ok", skills };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.warn("[ayla:catalogo] skills não carregaram:", motivo);
    // ⚠️ O EVENTO É PERSISTIDO. Antes só havia este `console.warn`, que some com
    // a retenção da Vercel — então a causa do turno da Karina (09/09/2026) não
    // estava guardada em lugar nenhum e teve que ser reconstruída por bancada.
    // Nenhum dado da família entra aqui: só o id, que já é a chave de
    // correlação usada por todo o resto da observabilidade.
    const agora = Date.now();
    if (agora - _ultimoAlarme >= ALARME_MIN_MS) {
      _ultimoAlarme = agora;
      void logEvent({
        kind: "catalogo_skills_indisponivel",
        severity: "error",
        family_account_id: familyId ?? null,
        message: `catálogo de skills não carregou: ${motivo.slice(0, 200)}`,
        payload: {
          sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
          motivo: motivo.slice(0, 400),
          // O que fica sem entrada quando isto acontece — para quem lê o evento
          // não precisar saber o mapa de cabeça.
          consumidores_afetados: ["skills_do_turno", "boas_praticas", "lacuna_decisiva"],
          cache_valido: Boolean(_cache),
        },
        persistir: true,
      });
    }
    // Sem catálogo a conversa NÃO PARA — mas quem chama passa a saber que a
    // ausência é falha, e não decisão.
    return { estado: "indisponivel", motivo: motivo.slice(0, 200) };
  }
}

/** Só para teste: esquece o catálogo em memória. */
export function _limparCacheDeSkills(): void {
  _cache = null;
  _ultimoAlarme = 0;
}
