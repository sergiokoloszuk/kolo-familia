import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { resolverLinkAcesso } from "@/lib/auth/acesso-link";
import { destinoDaFamilia, normalizarDestino } from "@/lib/auth/destino-link";

/**
 * Aterrissagem do link que a Ayla manda no WhatsApp.
 *
 * Ordem de tentativas (da mais confiável pra mais frágil):
 *  0) Robô de PREVIEW (WhatsApp/Facebook) faz GET pra montar o card — devolve
 *     página neutra SEM tocar em token, senão o preview consome o acesso.
 *  1) Já logada? Vai direto pro destino; token nem importa.
 *  2) `k` = token NOSSO (acessos_app). Vários valem ao mesmo tempo: o link de
 *     ontem continua abrindo. A sessão é mintada aqui, sem senha.
 *     ⚠️ A DURAÇÃO NÃO SE REPETE AQUI. Este comentário dizia "7 dias" enquanto
 *     o código gravava 24h — número decorado envelhece sozinho e passa a
 *     mentir. A validade tem um dono só: `VALIDADE_HORAS`, em
 *     `lib/auth/acesso-link.ts`.
 *  3) `token_hash` = magic-link do Supabase (links ANTIGOS, já enviados). Fica
 *     por compatibilidade — o GoTrue só mantém UM token por usuário, então
 *     esses links morrem quando outro é gerado. Era a causa de a mãe ficar
 *     trancada fora (22–26/07).
 *  4) Falhou tudo: página explicando que o link expirou, com o caminho de volta
 *     (pedir outro pra Ayla). NUNCA mais despejar no /login pedindo uma senha
 *     que ela não tem — era ali que a conversa morria.
 */

function paginaHtml(titulo: string, corpo: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo} — Kolo Família</title>
<style>
  :root { color-scheme: light dark }
  body { margin:0; min-height:100dvh; display:grid; place-items:center;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
         background:#faf7f2; color:#2c2a27; padding:24px }
  @media (prefers-color-scheme: dark) { body { background:#1a1917; color:#f2efe9 } }
  .card { max-width:22rem; text-align:center; line-height:1.55 }
  h1 { font-size:1.25rem; margin:0 0 .75rem; font-weight:600 }
  p { margin:0 0 1rem; font-size:.95rem; opacity:.9 }
  a.btn { display:inline-block; padding:.7rem 1.2rem; border-radius:999px;
          background:#6b4ea8; color:#fff; text-decoration:none; font-weight:600; font-size:.95rem }
</style></head><body><div class="card">${corpo}</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenNosso = searchParams.get("k");
  const tokenHash = searchParams.get("token_hash");
  const nextRaw = searchParams.get("next") ?? "/estrategias";
  const nextUrl = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/estrategias";

  // (0) Não deixe o robô de preview consumir nada.
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  const ehBot =
    /whatsapp|facebookexternalhit|facebot|telegrambot|bot\b|crawler|spider|preview|slurp|bingpreview|embedly|iframely|skypeuripreview|discordbot|twitterbot/.test(
      ua,
    );
  if (ehBot) {
    return paginaHtml("Kolo Família", "<h1>Kolo Família</h1><p>Abrindo o Kolo…</p>");
  }

  const supabase = await createClient();
  const admin = createServiceRoleClient();

  // O DESTINO MORA NO TOKEN, e é lido ANTES de qualquer coisa.
  //
  // Até 03/08/2026 este bloco ficava depois do "já logada", e o caminho de quem
  // tinha sessão ativa retornava com o `next` da QUERY STRING — que a Ayla não
  // manda. Sem `?next=`, caía no default `/estrategias`, e o destino gravado no
  // token nunca era lido. A mãe pedia o relatório, recebia o link certo
  // (`/evolucao/relatorio` estava salvo em `acessos_app`) e caía em Estratégias.
  //
  // O MESMO TOKEN PRECISA LEVAR AO MESMO LUGAR, com ou sem sessão.
  const acesso = tokenNosso ? await resolverLinkAcesso(admin, tokenNosso) : null;
  const destinoBruto = nextUrl !== "/estrategias" ? nextUrl : (acesso?.next ?? nextUrl);
  // E o artefato no destino precisa ser DESTA família — o token é da família, o
  // id dentro do caminho não era conferido por ninguém.
  const destino = acesso
    ? await destinoDaFamilia(admin, { destino: destinoBruto, familyId: acesso.familyId })
    : normalizarDestino(destinoBruto);

  // (1) Já logada: pula a autenticação, mas NÃO pula o destino.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(`${origin}${destino}`);

  // (2) Token nosso: troca por sessão. Como a gente gera e consome o magic-link
  //     do Supabase no MESMO request, não sobra token pendente pra ser morto por
  //     um link futuro.
  if (tokenNosso) {
    if (acesso) {
      const { data: fam } = await admin
        .from("family_accounts")
        .select("user_id")
        .eq("id", acesso.familyId)
        .maybeSingle();
      const userId = fam?.user_id as string | undefined;
      if (userId) {
        const { data: userData } = await admin.auth.admin.getUserById(userId);
        const email = userData?.user?.email;
        if (email) {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: { redirectTo: `${origin}/auth/wa` },
          });
          const hash = linkData?.properties?.hashed_token;
          if (hash) {
            const { error } = await supabase.auth.verifyOtp({
              type: "magiclink",
              token_hash: hash,
            });
            if (!error) {
              // Mesmo `destino` do caminho de sessão ativa — calculado uma vez.
              return NextResponse.redirect(`${origin}${destino}`);
            }
          }
        }
      }
    }
  }

  // (3) Link antigo (magic-link do Supabase).
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }

  // (4) Nada funcionou. Diz o que aconteceu e dá o caminho de volta.
  return paginaHtml(
    "Link expirado",
    `<h1>Esse link já expirou 🌿</h1>
     <p>É por segurança: os links de acesso valem por alguns dias. Pedir um novo é rápido —
     manda <strong>“quero entrar”</strong> pra Ayla no WhatsApp e ela te envia na hora.</p>
     <p><a class="btn" href="${origin}/login?next=${encodeURIComponent(nextUrl)}">Entrar com e-mail e senha</a></p>`,
  );
}
