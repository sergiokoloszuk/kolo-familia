"use server";

import { z } from "zod";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/require-admin";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { gravarEventosPlano, lerPlano } from "@/lib/plano-v51/repositorio";
import { iniciarPlano, membroDoPlano } from "@/lib/plano-v51/servico";
import { gerarParaPlano } from "@/lib/plano-v51/gerador";
import { loteSchema } from "@/lib/plano-v51/contrato";
import { criarPlanoV51 } from "@/lib/plano-v51/dominio";

async function contextoAutorizado() {
  // Conferir também em cada Server Action. O layout/menu não é autorização.
  await requireAdmin();
  const { supabase, family } = await loadFamilyContext();
  if (!family) throw new Error("Família não inicializada.");
  await requireActiveWrite(family.id);
  return { db: supabase, familyId: family.id as string };
}
export async function iniciarPlanoAction(input: unknown) {
  const { db, familyId } = await contextoAutorizado();
  return iniciarPlano(db, createServiceRoleClient(), familyId, input);
}
export async function registrarEventosAction(input: unknown) {
  const { db, familyId } = await contextoAutorizado();
  const lote = loteSchema.parse(input);
  const membro = await membroDoPlano(db, familyId, lote.membroId);
  return gravarEventosPlano(db, familyId, lote, new Date().toISOString(), async (proximo, anterior) => {
    // Desenvolver a devolutiva DEPOIS de investigar. Digitar/navegar não chama IA.
    if (anterior.confirmado || !(anterior.passo <= 2 && proximo.passo === 3 && lote.eventos.some(e => e.acao.tipo === "avancar"))) return proximo;
    const gerado = await gerarParaPlano({ db, auditoria: createServiceRoleClient(), familyId, membro, titulo: proximo.titulo, relato: proximo.relatoHoje, plano: proximo });
    if (!gerado.conteudo) throw new Error("A devolutiva não foi confirmada.");
    // A mesma validação de origem usada na criação. Não converter interpretação em relato.
    criarPlanoV51({ id: proximo.id, familyId, membro, titulo: proximo.titulo, relato: proximo.relatoHoje, conteudo: gerado.conteudo, agora: proximo.criadoEm });
    return { ...proximo, objetivo: proximo.objetivo === anterior.conteudo.objetivo ? gerado.conteudo.objetivo : proximo.objetivo,
      conteudo: { ...gerado.conteudo, perguntas: proximo.conteudo.perguntas },
      estrategiaId: null, depois: [], frases: [], alcance: 3,
      estados: Object.fromEntries(gerado.conteudo.estrategias.map(e => [e.id, "proposto" as const])) };
  });
}
export async function conversarNoPlanoAction(input: unknown) {
  const p = z.object({ membroId: z.string().uuid(), planoId: z.string().uuid().optional(), mensagens: z.array(z.object({ papel: z.enum(["user", "assistant"]), texto: z.string().max(8000) })).max(20), texto: z.string().trim().min(1).max(8000) }).parse(input);
  const { db, familyId } = await contextoAutorizado(), membro = await membroDoPlano(db, familyId, p.membroId);
  const plano = p.planoId ? await lerPlano(db, familyId, p.membroId, p.planoId) : undefined;
  const r = await gerarParaPlano({ db, auditoria: createServiceRoleClient(), familyId, membro, titulo: plano?.titulo ?? "Conversa livre", relato: plano?.relatoHoje ?? p.texto, plano, conversa: p.mensagens });
  if (!r.texto) throw new Error("A Ayla não devolveu uma resposta.");
  return r.texto;
}
