import { randomBytes } from "node:crypto";
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
 * 24h — a mesma ordem de grandeza dos magic-links de mercado.
 *
 * O link É a credencial: quem abrir, entra (vale pro Slack, Notion, Substack e
 * qualquer outro). Então o que protege é a JANELA ser curta, não o link ser
 * eterno. 24h cobre o caso real ("recebi de manhã, abri de noite") sem deixar
 * uma chave viva na conversa por uma semana. Expirou? Ela toca, lê que expirou,
 * e a Ayla manda outro na hora — a conveniência vem da reposição instantânea.
 */
const VALIDADE_HORAS = 24;

function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Só caminho interno — nunca deixa virar redirect pra fora. */
function destinoSeguro(next: string | null | undefined): string {
  const n = (next ?? "").trim();
  return n.startsWith("/") && !n.startsWith("//") ? n : "/painel";
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
