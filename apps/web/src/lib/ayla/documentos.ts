import type { SupabaseClient } from "@supabase/supabase-js";
import { AYLA_EXPERIMENTAL_PROMPT } from "./experimental-prompt";

/**
 * DE ONDE VEM A INTELIGÊNCIA DA AYLA — 15/08/2026, Passo 1 do Admin.
 *
 * O Core deixa de morar só no código e passa a poder ser editado no Admin,
 * versionado e publicado SEM DEPLOY. O que NÃO muda é o conteúdo: o documento
 * semeado é byte a byte o Core experimental já aprovado no QA.
 *
 * ⚠️ O CORE NUNCA PODE SUMIR. Banco fora do ar, linha ausente, conteúdo vazio,
 * publicação incompleta, migração não aplicada — em todos esses casos a Ayla
 * responde com o Core do código. É por isso que `AYLA_EXPERIMENTAL_PROMPT`
 * continua existindo e importado aqui: ele é o chão, não um resquício.
 *
 * ⚠️ UMA CONSULTA, NÃO UMA POR DOCUMENTO. MEDI que cada ida ao banco custa
 * ~390 ms em produção (função em `iad1`, Supabase em São Paulo — PEND-065).
 * Buscar Core, Trial e cada Artefato separadamente somaria segundos num turno
 * que hoje processa em 2,5 s. A leitura traz TODOS os ativos de uma vez, e o
 * Passo 2 entra sem custo novo.
 */

/**
 * OS DOCUMENTOS DA AYLA.
 *
 * ⚠️ CADASTRAR ≠ INJETAR. Estar aqui, e até estar ATIVO, não faz um documento
 * entrar no prompt. Hoje **só o `core`** é resolvido e injetado — os outros
 * quatro existem para serem administrados e revisados, e a decisão de quando
 * cada um entra na conversa é a orquestração seletiva, que é outra frente.
 * Um teste prende isso.
 */
export const CHAVES_DOCUMENTO = [
  "core",
  "trial",
  "plano",
  "cartoes_visuais",
  "fontes_confiaveis",
] as const;

export type ChaveDocumento = (typeof CHAVES_DOCUMENTO)[number];

/** Rótulo humano, para a tela do Admin. */
export const ROTULO_DOCUMENTO: Record<ChaveDocumento, string> = {
  core: "Core",
  trial: "Trial",
  plano: "Plano",
  cartoes_visuais: "Cartões Visuais",
  fontes_confiaveis: "Fontes Confiáveis",
};

export type DocumentoResolvido = {
  conteudo: string;
  /** De onde veio de fato — é isto que vai para a observabilidade. */
  origem: "admin" | "fallback";
  versao: number | null;
};

/**
 * O fallback de código — existe SÓ para o Core.
 *
 * ⚠️ Os outros documentos não têm (nem devem ter) versão no código: eles nascem
 * no Admin. Se um deles for pedido e não houver versão ativa, o resolvedor
 * devolve string vazia, e quem chamar decide o que fazer. Inventar um fallback
 * para eles seria criar uma segunda fonte de verdade — exatamente o que esta
 * tabela existe para acabar.
 */
const FALLBACK: Partial<Record<ChaveDocumento, string>> = {
  core: AYLA_EXPERIMENTAL_PROMPT,
};

type Linha = { chave: string; versao: number; conteudo: string; status: string };

/**
 * CACHE DE PROCESSO, CURTO — e o motivo de ser curto é honesto.
 *
 * ⚠️ Em serverless cada invocação pode ser um processo novo, então este cache
 * acerta MENOS do que acertaria num servidor comum: ele só ajuda quando a
 * mesma instância atende turnos seguidos. Ainda assim vale, porque quando
 * acerta economiza ~390 ms, e quando erra custa exatamente o que custaria sem
 * ele. O que ele NÃO faz é criar risco de conteúdo velho por muito tempo: 60 s
 * é o teto, e é o preço combinado para publicar sem deploy.
 *
 * ⚠️ TTL, e não invalidação por evento. Invalidar entre instâncias exigiria
 * canal de mensagem entre funções — complexidade que não se paga para uma
 * espera de no máximo um minuto.
 */
const TTL_MS = 60_000;
let cache: { em: number; linhas: Map<string, Linha> } | null = null;

/** Zera o cache — usado pelos testes e logo após publicar, na mesma instância. */
export function esquecerCacheDeDocumentos(): void {
  cache = null;
}

async function carregarAtivos(supabase: SupabaseClient): Promise<Map<string, Linha>> {
  const agora = Date.now();
  if (cache && agora - cache.em < TTL_MS) return cache.linhas;
  const mapa = new Map<string, Linha>();
  try {
    const { data, error } = await supabase
      .from("ayla_documentos")
      .select("chave, versao, conteudo, status")
      .eq("status", "ativo");
    // ⚠️ `error` CONFERIDO. No cliente Supabase o erro VOLTA, não é lançado —
    // um `await` sem checar seguiria com `data` nulo e chamaria isso de sucesso.
    if (error) throw new Error(error.message);
    for (const l of (data ?? []) as Linha[]) mapa.set(l.chave, l);
  } catch (e) {
    // Banco fora, tabela ausente (migração não aplicada), rede — todos aqui.
    console.warn(
      "[ayla:documentos] leitura falhou, usando fallback do código:",
      e instanceof Error ? e.message : e,
    );
    // ⚠️ NÃO cacheia a falha: o próximo turno tenta de novo. Cachear o vazio
    // manteria a Ayla no fallback por um minuto depois de o banco voltar.
    return mapa;
  }
  cache = { em: agora, linhas: mapa };
  return mapa;
}

/**
 * O DOCUMENTO QUE VALE AGORA — com a origem declarada.
 *
 * `rascunhoDe` faz o simulador do Admin preferir o rascunho; a conversa real
 * nunca passa esse parâmetro, então rascunho não vaza para família nenhuma.
 */
export async function resolverDocumento(
  supabase: SupabaseClient,
  chave: ChaveDocumento,
  rascunhoDe?: { conteudo: string; versao: number } | null,
): Promise<DocumentoResolvido> {
  if (rascunhoDe && rascunhoDe.conteudo.trim()) {
    return { conteudo: rascunhoDe.conteudo, origem: "admin", versao: rascunhoDe.versao };
  }
  const ativos = await carregarAtivos(supabase);
  const linha = ativos.get(chave);
  // Conteúdo vazio é tão inútil quanto linha ausente — mesma resposta.
  if (linha && linha.conteudo.trim().length > 0) {
    return { conteudo: linha.conteudo, origem: "admin", versao: linha.versao };
  }
  return { conteudo: FALLBACK[chave] ?? "", origem: "fallback", versao: null };
}

/** O rascunho de uma chave, para o simulador. `null` quando não há. */
export async function lerRascunho(
  supabase: SupabaseClient,
  chave: ChaveDocumento,
): Promise<{ conteudo: string; versao: number } | null> {
  try {
    const { data } = await supabase
      .from("ayla_documentos")
      .select("conteudo, versao")
      .eq("chave", chave)
      .eq("status", "rascunho")
      .maybeSingle();
    if (!data || !String(data.conteudo ?? "").trim()) return null;
    return { conteudo: data.conteudo as string, versao: data.versao as number };
  } catch {
    return null;
  }
}
