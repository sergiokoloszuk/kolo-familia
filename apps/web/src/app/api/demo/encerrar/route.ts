import type { NextRequest } from "next/server";
import { preflight, rotaDemo, linkCadastro } from "@/lib/demo/http";
import { encerrar } from "@/lib/demo/servico";

// Demonstração da Ayla na landing (PEND-259). Ver `lib/demo/servico.ts`.
export const dynamic = "force-dynamic";
// Uma chamada ao modelo (e, no encerrar, o envio do resumo).
export const maxDuration = 60;

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  return rotaDemo(req, (corpo, deps) => encerrar(deps, { token: corpo.token, linkCadastro: linkCadastro() }));
}
