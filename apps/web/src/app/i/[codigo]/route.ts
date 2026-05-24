import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Link de indicação do afiliado: /i/CODIGO
 *
 * Loga o clique, grava o código num cookie (30 dias, last-click) e manda a
 * pessoa pra landing. No cadastro, o onboarding lê esse cookie e atribui a
 * família ao afiliado. Código inválido → só redireciona, sem cookie.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await ctx.params;
  const res = NextResponse.redirect(new URL("/", req.url));

  try {
    const admin = createServiceRoleClient();
    const { data: af } = await admin
      .from("afiliados")
      .select("id, ativo, janela_atribuicao_dias")
      .eq("codigo_unico", codigo)
      .eq("ativo", true)
      .maybeSingle();

    if (af) {
      await admin.from("afiliado_cliques").insert({
        afiliado_id: af.id,
        codigo,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
      });

      const dias = (af.janela_atribuicao_dias as number) || 30;
      res.cookies.set("kolo_ref", codigo, {
        maxAge: 60 * 60 * 24 * dias,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
  } catch {
    // best-effort: nunca quebrar o redirect por causa do tracking
  }

  return res;
}
