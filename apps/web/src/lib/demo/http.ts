import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enviarTexto } from "@/lib/ayla/whatsappSender";
import { gerarConversacional } from "@/lib/ia/provider";
import { appUrlPublica } from "@/lib/auth/acesso-link";
import type { Dependencias } from "./servico";

/**
 * A casca HTTP de `/api/demo/*` (PEND-259).
 *
 * ⚠️ FAIL-CLOSED (§16 do protocolo): a demonstração consome modelo pago e
 * manda WhatsApp. Sem `DEMO_AYLA_HABILITADA=1` na Vercel, toda rota responde
 * 503 — ligar é um ato explícito, desligar é apagar a variável.
 *
 * ⚠️ CORS SÓ PARA A LANDING. A landing pode morar em outro domínio (Base44).
 * Origens aceitas: `DEMO_ORIGENS_PERMITIDAS`, separadas por vírgula, mais a
 * própria origem do app. Origem fora da lista não recebe o cabeçalho, e o
 * navegador bloqueia a leitura da resposta.
 */

export function demoHabilitada(): boolean {
  return process.env.DEMO_AYLA_HABILITADA === "1";
}

function origensPermitidas(): string[] {
  const extra = (process.env.DEMO_ORIGENS_PERMITIDAS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return [appUrlPublica(), ...extra];
}

function cabecalhosCors(req: NextRequest): Record<string, string> {
  const origem = req.headers.get("origin");
  if (!origem || !origensPermitidas().includes(origem)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function responder(req: NextRequest, corpo: unknown, status = 200): NextResponse {
  return NextResponse.json(corpo, { status, headers: { ...cabecalhosCors(req), "Cache-Control": "no-store" } });
}

export function preflight(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: cabecalhosCors(req) });
}

/** Corpo JSON com teto de tamanho — nada de colagem de megabytes. */
export async function lerCorpo(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const texto = await req.text();
    if (texto.length > 8_000) return null;
    const v = JSON.parse(texto) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Para onde o resumo e o fim da demonstração levam: cadastro, sem teste. */
export function linkCadastro(): string {
  return `${appUrlPublica()}/signup?de=demonstracao`;
}

export function dependenciasReais(): Dependencias {
  return {
    admin: createServiceRoleClient(),
    enviarWhatsApp: ({ phoneE164, texto }) => enviarTexto({ phoneE164, texto, delaySegundos: 1 }),
    gerar: gerarConversacional,
  };
}

/**
 * O envelope comum das quatro rotas: liga/desliga, corpo, status por motivo.
 * `executar` devolve o resultado do serviço; o status HTTP sai do `motivo`.
 */
export async function rotaDemo(
  req: NextRequest,
  executar: (corpo: Record<string, unknown>, deps: Dependencias) => Promise<{ ok: boolean; motivo?: string }>,
): Promise<NextResponse> {
  if (!demoHabilitada()) return responder(req, { ok: false, motivo: "desligada" }, 503);
  const corpo = await lerCorpo(req);
  if (!corpo) return responder(req, { ok: false, motivo: "corpo_invalido" }, 400);
  const r = await executar(corpo, dependenciasReais());
  return responder(req, r, r.ok ? 200 : statusDoMotivo(r.motivo));
}

export function statusDoMotivo(motivo: string | undefined): number {
  switch (motivo) {
    case "dados_invalidos":
    case "mensagem_invalida":
    case "codigo_errado":
      return 400;
    case "token_invalido":
      return 401;
    case "ja_usou":
    case "encerrada":
    case "tempo_esgotado":
    case "turnos_esgotados":
    case "concorrente":
      return 409;
    case "expirado":
    case "sem_pedido":
      return 410;
    case "cooldown":
    case "max_reenvios":
    case "max_tentativas":
    case "limite_global":
      return 429;
    case "indisponivel":
    case "envio_falhou":
      return 503;
    default:
      return 500;
  }
}
