import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Aterrissagem do magic-link enviado pela Ayla no WhatsApp (Fase 3).
 *
 * A Ayla manda `/auth/wa?token_hash=...&next=/historias/criar`. Aqui
 * verificamos o token (verifyOtp grava a sessão nos cookies via SSR) e
 * mandamos a pessoa pro destino, já logada.
 *
 * Robustez (13/07): o token do Supabase é de USO ÚNICO e expira. Dois
 * problemas reais no WhatsApp:
 *  1) O robô de PRÉ-VISUALIZAÇÃO (WhatsApp/Facebook) faz um GET no link pra
 *     montar o preview e ISSO consome o token antes de a pessoa clicar. Então,
 *     pra user-agents de bot, devolvemos uma página simples SEM tocar no token.
 *  2) Se a pessoa JÁ está logada (celular dela), o token nem importa — vai
 *     direto pro destino. (Antes, token morto + sessão viva caía no /login, que
 *     ignorava o next e jogava na home.)
 *
 * Degradação graciosa: sem sessão e sem token válido → /login preservando o
 * `next` (o /login agora respeita o next). Nunca mostra erro cru.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const nextRaw = searchParams.get("next") ?? "/estrategias";
  // Só aceita caminho relativo interno (evita open-redirect).
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/estrategias";
  const dest = `${origin}${next}`;

  // (1) Não deixe o robô de preview consumir o token de uso único.
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  const ehBot =
    /whatsapp|facebookexternalhit|facebot|telegrambot|bot\b|crawler|spider|preview|slurp|bingpreview|embedly|iframely|skypeuripreview|discordbot|twitterbot/.test(
      ua,
    );
  if (ehBot) {
    return new NextResponse(
      "<!doctype html><meta charset='utf-8'><title>Kolo Família</title><body>Abrindo o Kolo Família…</body>",
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const supabase = await createClient();

  // (2) Já logada? O token não importa — vai direto pro destino.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(dest);
  }

  // (3) Sem sessão: tenta o token.
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(dest);
    }
  }

  // (4) Falhou tudo: login preservando o destino.
  return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}`);
}
