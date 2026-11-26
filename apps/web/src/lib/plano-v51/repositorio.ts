import type { SupabaseClient } from "@supabase/supabase-js";
import { aplicarPlano, criarPlanoV51, type ConteudoPlano, type MembroPlano, type PlanoV51 } from "./dominio";
import { lerPlanoV51, loteSchema, MARCADOR_V51, secoesDoPlano } from "./contrato";

const CAMPOS = "id,family_account_id,membro_atipico_id,titulo,tema,secoes,created_at,updated_at";
type Linha = { id: string; family_account_id: string; membro_atipico_id: string; secoes: unknown };
function conferir(linha: Linha, familyId: string, membroId?: string): PlanoV51 {
  const p = lerPlanoV51(linha.secoes);
  if (!p || linha.family_account_id !== familyId || (membroId && linha.membro_atipico_id !== membroId) || p.familyId !== linha.family_account_id || p.membroId !== linha.membro_atipico_id || p.id !== linha.id) throw new Error("Plano não encontrado para esta família e criança.");
  return p;
}
export async function lerPlano(db: SupabaseClient, familyId: string, membroId: string, id: string): Promise<PlanoV51> {
  const { data, error } = await db.from("planos").select(CAMPOS).eq("id", id).eq("family_account_id", familyId).eq("membro_atipico_id", membroId).maybeSingle();
  if (error || !data) throw new Error("Não foi possível ler este plano.");
  return conferir(data as Linha, familyId, membroId);
}
export async function listarPlanosV51(db: SupabaseClient, familyId: string): Promise<PlanoV51[]> {
  const { data, error } = await db.from("planos").select(CAMPOS).eq("family_account_id", familyId).contains("secoes", [{ tipo: MARCADOR_V51 }]).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Não foi possível carregar seus planos. Tente novamente.");
  return ((data ?? []) as Linha[]).map(l => conferir(l, familyId));
}
export async function inserirPlanoV51(db: SupabaseClient, p: {
  familyId: string; membro: MembroPlano; requisicaoId: string; titulo: string; relato: string; conteudo: ConteudoPlano; agora: string;
}): Promise<PlanoV51> {
  const novo = criarPlanoV51({ id: p.requisicaoId, familyId: p.familyId, membro: p.membro, titulo: p.titulo, relato: p.relato, conteudo: p.conteudo, agora: p.agora });
  const { error } = await db.from("planos").insert({ id: novo.id, family_account_id: p.familyId, membro_atipico_id: p.membro.id, titulo: novo.titulo, tema: novo.titulo, secoes: secoesDoPlano(novo), origem: "estrategias" }).select("id").single();
  if (error && error.code !== "23505") throw new Error("A criação do plano não foi confirmada.");
  // Ler de volta também cobre timeout depois de insert e ID repetido. Nunca aceitar outra família/assunto.
  const lido = await lerPlano(db, p.familyId, p.membro.id, novo.id);
  if (lido.relatoHoje !== p.relato || lido.titulo !== p.titulo.trim()) throw new Error("Esta requisição já pertence a outro plano.");
  return lido;
}
export async function gravarEventosPlano(db: SupabaseClient, familyId: string, input: unknown, agora: string,
  preparar?: (proximo: PlanoV51, anterior: PlanoV51) => Promise<PlanoV51>,
): Promise<PlanoV51> {
  const lote = loteSchema.parse(input);
  const anterior = await lerPlano(db, familyId, lote.membroId, lote.planoId);
  if (lote.eventos.every(e => anterior.eventos.some(a => a.id === e.id))) return anterior;
  if (anterior.revisao !== lote.revisao) throw new Error("O plano mudou em outra conversa. Recarregue antes de continuar.");
  let proximo = anterior;
  for (const evento of lote.eventos) {
    const r = aplicarPlano(proximo, { familyId, membroId: lote.membroId, eventoId: evento.id, agora, acao: evento.acao });
    if (!r.ok) throw new Error(r.erro);
    proximo = r.plano;
  }
  if (preparar) proximo = await preparar(proximo, anterior);
  if (proximo.id !== anterior.id || proximo.familyId !== familyId || proximo.membroId !== lote.membroId) throw new Error("O contexto devolveu outra identidade. Nenhuma atualização foi realizada.");
  proximo = { ...proximo, revisao: anterior.revisao + 1 };
  const { data, error } = await db.from("planos").update({ secoes: secoesDoPlano(proximo) })
    .eq("id", lote.planoId).eq("family_account_id", familyId).eq("membro_atipico_id", lote.membroId)
    .contains("secoes", [{ tipo: MARCADOR_V51, revisao: anterior.revisao }]).select("id").maybeSingle();
  if (error) throw new Error("Não consegui confirmar a gravação. Sua tentativa não foi marcada como salva.");
  const lido = await lerPlano(db, familyId, lote.membroId, lote.planoId);
  if (!data && lote.eventos.every(e => lido.eventos.some(a => a.id === e.id))) return lido;
  if (!data || lido.revisao < proximo.revisao || !lote.eventos.every(e => lido.eventos.some(a => a.id === e.id))) throw new Error("Gravação não confirmada: o plano pode ter sido atualizado em outra conversa.");
  return lido;
}
