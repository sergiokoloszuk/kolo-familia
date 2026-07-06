import { NextResponse } from "next/server";

/**
 * Atalho de teste do onboarding NOVO: seta o cookie kolo_onb=novo (no servidor,
 * então funciona até em aba anônima) e manda pro /signup. Quem abrir este
 * endereço vê o fluxo novo ao se cadastrar (se o modo estiver em "Teste"); os
 * leads reais, que chegam direto pelo anúncio, seguem no cadastro antigo.
 */
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(new URL("/signup", origin));
  res.cookies.set("kolo_onb", "novo", { path: "/", maxAge: 60 * 60 });
  return res;
}
