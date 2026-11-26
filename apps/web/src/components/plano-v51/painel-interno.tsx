"use client";

import { PlanoV51 } from "./plano-v51";
import { conteudoDemonstrativo, MEMBROS_FICTICIOS } from "@/lib/plano-v51/demonstracao";

const servicos = { preparar: async ({ relato }: { relato: string }) => conteudoDemonstrativo(relato) };

/** Mesmo componente da experiência, com um transporte explicitamente demonstrativo. */
export function PainelPlanoV51() {
  return <PlanoV51 familyId="laboratorio-ficticio" nome="Karina" membros={MEMBROS_FICTICIOS} servicos={servicos} interno />;
}
