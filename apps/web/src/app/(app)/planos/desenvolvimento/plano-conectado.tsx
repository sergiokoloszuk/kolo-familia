"use client";

import { PlanoV51, type ServicosPlanoV51 } from "@/components/plano-v51/plano-v51";
import type { MembroPlano, PlanoV51 as Plano } from "@/lib/plano-v51/dominio";
import { iniciarPlanoAction, registrarEventosAction, conversarNoPlanoAction } from "./actions";

const servicos: ServicosPlanoV51 = {
  preparar: async () => { throw new Error("A criação deve ser confirmada pelo servidor."); },
  iniciar: iniciarPlanoAction,
  persistir: registrarEventosAction,
  conversar: p => conversarNoPlanoAction({ membroId: p.membroId, planoId: p.plano?.id, texto: p.texto, mensagens: p.mensagens }),
};
export function PlanoConectado(props: { familyId: string; nome: string; membros: MembroPlano[]; planos: Plano[]; planoInicialId?: string }) {
  return <PlanoV51 {...props} planosIniciais={props.planos} servicos={servicos} />;
}
