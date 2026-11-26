import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { gerarParaPlano } from "./gerador";
import { inserirPlanoV51, lerPlano } from "./repositorio";
import type { MembroPlano } from "./dominio";

export async function membroDoPlano(db: SupabaseClient, familyId: string, membroId: string): Promise<MembroPlano> {
  const { data, error } = await db.from("membros_atipicos").select("id,nome,perfil").eq("id", membroId).eq("family_account_id", familyId).eq("ativo", true).maybeSingle();
  if (error || !data) throw new Error("Escolha um membro desta família.");
  return { id: data.id, nome: data.nome, cadastro: data.perfil?.trim() ? [{ texto: data.perfil, origem: "Cadastro do membro" }] : [] };
}
const inicio = z.object({ membroId: z.string().uuid(), requisicaoId: z.string().uuid(), titulo: z.string().trim().min(1).max(100), relato: z.string().trim().min(1).max(12000) });
export async function iniciarPlano(db: SupabaseClient, auditoria: SupabaseClient, familyId: string, input: unknown) {
  const p = inicio.parse(input), membro = await membroDoPlano(db, familyId, p.membroId);
  // Repetir uma criação confirmada não repete a chamada ao modelo.
  const { data, error } = await db.from("planos").select("id").eq("id", p.requisicaoId).eq("family_account_id", familyId).eq("membro_atipico_id", p.membroId).maybeSingle();
  if (error) throw new Error("Não consegui verificar a criação anterior.");
  if (data) {
    const existente = await lerPlano(db, familyId, p.membroId, p.requisicaoId);
    if (existente.titulo !== p.titulo || existente.relatoHoje !== p.relato) throw new Error("Esta requisição já pertence a outro plano.");
    return existente;
  }
  const gerado = await gerarParaPlano({ db, auditoria, familyId, membro, titulo: p.titulo, relato: p.relato });
  if (!gerado.conteudo) throw new Error("A Ayla não devolveu o conteúdo do plano.");
  return inserirPlanoV51(db, { familyId, membro, requisicaoId: p.requisicaoId, titulo: p.titulo, relato: p.relato, conteudo: gerado.conteudo, agora: new Date().toISOString() });
}
