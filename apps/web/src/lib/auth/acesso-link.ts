import { randomBytes } from "node:crypto";
import { normalizarDestino } from "./destino-link";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ACESSO da mãe pelo WhatsApp — token NOSSO (tabela `acessos_app`).
 *
 * O link da Ayla usava o magic-link do Supabase, e o GoTrue guarda UM token por
 * usuário: cada link novo matava os anteriores. Quem tocava num link de ontem
 * caía no /login pedindo uma senha que ela não tem — dois dias trancada fora,
 * no caso real que originou isto (22–26/07).
 *
 * Aqui o token é nosso: VÁRIOS valem ao mesmo tempo (mandar um link novo não
 * mata o anterior), cada um dura `VALIDADE_HORAS`, e o /auth/wa troca por
 * sessão. Nunca vai pro cliente: só o servidor (service-role) lê e escreve.
 */

/**
 * 30 DIAS — FONTE ÚNICA da validade de TODO magic link da Kolo.
 *
 * ⚠️ DECISÃO DE PRODUTO DE 27/08/2026, e ela reverte a régua anterior. Antes
 * eram 24h, com este raciocínio: *"o link É a credencial; o que protege é a
 * JANELA ser curta, não o link ser eterno. Expirou? A Ayla manda outro na
 * hora — a conveniência vem da reposição instantânea."*
 *
 * O que derrubou esse raciocínio foi o uso real. A reposição instantânea
 * pressupõe que a família **volte a escrever** para pedir outro link — e a
 * maior parte não volta. Uma mãe que abre o WhatsApp três dias depois, toca no
 * link que a Ayla mandou e lê "expirado" não pede outro: ela desiste. Vinte e
 * quatro horas protegiam contra um risco hipotético às custas de uma perda
 * observada.
 *
 * ⚠️ E O RISCO É REAL, não some por decisão: o link continua sendo a
 * credencial, e agora ele fica vivo por trinta dias numa conversa de WhatsApp
 * que pode ser encaminhada, aparecer num print ou ficar num aparelho
 * emprestado. O que segura a ponta é o que já existe e NÃO muda aqui: o token
 * é de UMA família, o destino é de uma allowlist, `destinoDaFamilia` confere
 * se o artefato é dela, e cada uso é contado (`usos`, `ultimo_uso_em`) para
 * auditoria. Se um dia isto precisar encolher, é este número — e só ele.
 *
 * Alterar aqui alcança TODOS os fluxos: D7 e D3, recuperação comercial, acesso
 * pedido na conversa, suporte. Nenhum chamador passa validade própria, e não
 * existe segundo mecanismo de link de acesso na Kolo — foi conferido.
 */
const VALIDADE_HORAS = 30 * 24;

function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Só caminho interno — nunca deixa virar redirect pra fora. */
function destinoSeguro(next: string | null | undefined): string {
  // A allowlist vive em `destino-link.ts`. Aceitar qualquer "/" bloqueava open
  // redirect externo — o risco grave — mas deixava passar rota interna que não
  // existe, e a família caía num 404 depois de clicar num link que a Ayla
  // prometeu. Destino inválido agora vira a volta mais próxima que existe.
  return normalizarDestino(next);
}

/**
 * Cria um link de acesso pro app, já apontando pro destino. Devolve null se não
 * conseguir gravar — o chamador decide o fallback (a Ayla segue sem link, nunca
 * quebra a conversa).
 */
export async function criarLinkAcesso(
  supabase: SupabaseClient,
  params: { familyId: string; next?: string | null; criadoPor?: "ayla" | "suporte" | "app" },
): Promise<string | null> {
  try {
    const token = novoToken();
    const next = destinoSeguro(params.next);
    const expira = new Date(Date.now() + VALIDADE_HORAS * 60 * 60 * 1000);

    const { error } = await supabase.from("acessos_app").insert({
      family_account_id: params.familyId,
      token,
      next,
      expira_em: expira.toISOString(),
      criado_por: params.criadoPor ?? "ayla",
    });
    if (error) {
      console.warn("[acesso-link] falha ao gravar:", error.message);
      return null;
    }
    return `${appUrl()}/auth/wa?k=${encodeURIComponent(token)}`;
  } catch (e) {
    console.warn("[acesso-link] erro:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * A mãe está dizendo que não consegue entrar? Aqui a régua é LARGA de propósito:
 * o custo de um falso positivo é mandar um link a mais (nenhum), e o de um falso
 * negativo é ela ficar trancada fora brigando com a escola sozinha.
 */
export function pedeAcessoAoApp(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (!t) return false;
  const naoConsegue =
    /\b(n[ãa]o (consigo|consegui|d[áa]|t[ée]m como|abre|abriu|entra|entrou|funciona|deu)|imposs[íi]vel|travad[oa]|trancad[oa])\b/.test(
      t,
    );
  const sobreEntrar =
    /\b(entrar|acessar|acesso|logar|login|abrir o app|no app|no site|plataforma|senha|e-?mail)\b/.test(
      t,
    );
  // "está/tá/é" no meio é comum na fala ("o e-mail ESTÁ inválido", "a senha TÁ
  // errada") — sem isso a frase real da mãe escapava.
  const senhaOuLink =
    /\b(esqueci a senha|senha (est[áa] |t[áa] |é )?(errada|inv[áa]lida|n[ãa]o funciona)|e-?mail (est[áa] |t[áa] |é |foi )?inv[áa]lido|link (n[ãa]o|expirou|venceu|morreu|velho)|manda(r)? (o|um) link|quero entrar|como (eu )?entro)\b/.test(
      t,
    );
  return senhaOuLink || (naoConsegue && sobreEntrar);
}

export type AcessoResolvido = { familyId: string; next: string };

/**
 * Troca o token pelo dono + destino, se ainda vale. NÃO invalida: dentro da
 * validade a mãe pode voltar no mesmo link (ela rola a conversa e toca de novo —
 * era o comportamento que faltava). Conta os usos pra auditoria.
 */
export async function resolverLinkAcesso(
  supabase: SupabaseClient,
  token: string | null | undefined,
): Promise<AcessoResolvido | null> {
  const t = (token ?? "").trim();
  if (!t || t.length < 20) return null;
  try {
    const { data } = await supabase
      .from("acessos_app")
      .select("id, family_account_id, next, expira_em, usos")
      .eq("token", t)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expira_em as string).getTime() <= Date.now()) return null;

    const agora = new Date().toISOString();
    const usos = ((data.usos as number | null) ?? 0) + 1;
    await supabase
      .from("acessos_app")
      .update({ usos, ultimo_uso_em: agora, ...(usos === 1 ? { usado_em: agora } : {}) })
      .eq("id", data.id as string);

    return {
      familyId: data.family_account_id as string,
      next: destinoSeguro(data.next as string | null),
    };
  } catch (e) {
    console.warn("[acesso-link] erro ao resolver:", e instanceof Error ? e.message : e);
    return null;
  }
}
