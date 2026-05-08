import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { validarConvite } from "@/lib/beta/gate";
import { isBetaGateAtivo } from "@/lib/beta/codigos";

/**
 * Endpoint público (sem auth) — só valida se um código de convite é
 * aceitável agora. Não consome. Volume controlado pelo gate ativo +
 * formato curto do código.
 */
const schema = z.object({
  codigo: z.string().trim().min(1).max(40),
});

export async function POST(request: NextRequest) {
  if (!isBetaGateAtivo()) {
    return NextResponse.json({
      ok: true,
      gate_ativo: false,
      motivo: "Gate desativado.",
    });
  }

  let body: { codigo: string };
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, motivo: "Body inválido." },
      { status: 400 },
    );
  }

  const r = await validarConvite(body.codigo);
  if (r.ok) {
    return NextResponse.json({ ok: true, gate_ativo: true });
  }
  return NextResponse.json(
    { ok: false, gate_ativo: true, motivo: r.motivo },
    { status: 400 },
  );
}
