import type { NextRequest } from "next/server";
import { preflight, rotaDemo } from "@/lib/demo/http";
import { confirmarCodigo } from "@/lib/demo/servico";

// Demonstração da Ayla na landing (PEND-259). Ver `lib/demo/servico.ts`.
export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  return rotaDemo(req, (corpo, deps) => confirmarCodigo(deps, corpo));
}
