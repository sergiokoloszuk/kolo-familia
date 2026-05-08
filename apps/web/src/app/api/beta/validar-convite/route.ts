import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { validarConvite } from "@/lib/beta/gate";
import { isBetaGateAtivo } from "@/lib/beta/codigos";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

/**
 * Endpoint público (sem auth) — só valida se um código de convite é
 * aceitável agora. Não consome. Volume controlado pelo gate ativo +
 * formato curto do código.
 */
const schema = z.object({
  codigo: z.string().trim().min(1).max(40),
});

export async function POST(request: NextRequest) {
  // Rate limit estreito: 10 tentativas/min por IP — defende contra
  // brute-force de códigos.
  const rl = checkRateLimit(clientKey(request, "beta_validar"), {
    capacidade: 10,
    refilPorMinuto: 10,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, motivo: "muitas tentativas, aguarde" },
      {
        status: 429,
        headers: rl.retry_after_s
          ? { "retry-after": String(rl.retry_after_s) }
          : undefined,
      },
    );
  }

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
