import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClient } from "@/lib/stripe/client";
import { logEvent, logServerError } from "@/lib/log";

/**
 * APAGAR UMA FAMÍLIA — UM LUGAR SÓ.
 *
 * ── por que isto existe ───────────────────────────────────────────────────
 *
 * Havia DUAS implementações da operação mais perigosa do sistema:
 * `excluirContaAction` (a pessoa clica) e o cron de exclusão. Elas divergiam —
 * o cron pulava cortesia e a action não; nenhuma das duas isentava staff; e
 * **nenhuma das duas apagava os arquivos da criança**.
 *
 * A action não podia ser reusada como estava porque depende de `requireUser()`
 * — precisa de sessão de navegador, que o cron não tem. Daí a extração: a
 * regra vive aqui, e as duas portas chamam a mesma função.
 *
 * ── o que é apagado, e o que sobrevive de propósito ───────────────────────
 *
 * APAGA, por `on delete cascade` a partir de `auth.users`: conversas,
 * mensagens, diários, Perfil Vivo, membros, histórias, planos, rotinas,
 * desenhos, meditações, evolução, relatórios, check-ins, links de acesso, CRM.
 * E, desde 20/08, **os arquivos do bucket `imagens`** — PDFs de plano, cartões
 * de rotina, desenhos e avatares.
 *
 * SOBREVIVE, por `on delete set null`: `eventos_app`, `api_calls`, `feedbacks`,
 * `user_events`, ledger de telefone. Nenhum guarda conteúdo da criança, e é o
 * que permite auditar a exclusão depois que a família já não existe.
 *
 * SOBREVIVE de propósito: `testes_usados` — só o hash sha256 do e-mail e do
 * telefone, que fecha a brecha dos 7 dias infinitos.
 */

type AdminClient = SupabaseClient;

export type MotivoExclusao = "pedido_da_familia" | "trial" | "cancelamento" | "inadimplencia";

export type ResultadoExclusao = {
  ok: boolean;
  familyId: string;
  /** Quantos arquivos do bucket foram removidos. */
  arquivosRemovidos: number;
  /** O que impediu, quando `ok: false`. */
  erro: string | null;
};

/**
 * Remove TODOS os arquivos daquela família no bucket `imagens`.
 *
 * ⚠️ A SEGURANÇA VEM DO PREFIXO, e ele é convenção provada: os quatro
 * escritores do bucket gravam em `{family_account_id}/{tipo}/{uuid}.{ext}` —
 * `ludico/desenhos`, `ayla/ponte` (PDF do plano), `ayla/rotina-guiada` (PDF da
 * rotina) e `lib/imagem/generate`. É o MESMO prefixo que a RLS de leitura usa
 * desde a migração 0043, então apagar por prefixo obedece à mesma fronteira
 * que já protege a leitura entre famílias.
 *
 * `list` do Storage é paginado e NÃO é recursivo: precisa descer pasta por
 * pasta e paginar. Uma implementação ingênua deixaria arquivos para trás numa
 * família com muitos cartões de rotina — e "apagou quase tudo" é o pior
 * resultado possível aqui.
 */
export async function removerArquivosDaFamilia(
  admin: AdminClient,
  familyId: string,
): Promise<{ removidos: number; erro: string | null }> {
  if (!familyId) return { removidos: 0, erro: "familyId vazio" };

  const bucket = admin.storage.from("imagens");
  const PAGINA = 100;
  let removidos = 0;

  async function listarTudo(prefixo: string, profundidade: number): Promise<string[]> {
    // Trava de profundidade: a convenção tem 2 níveis ({familia}/{tipo}/arquivo).
    // Mais que isso é estrutura inesperada — para em vez de vasculhar sozinha.
    if (profundidade > 3) return [];
    const caminhos: string[] = [];
    for (let offset = 0; ; offset += PAGINA) {
      const { data, error } = await bucket.list(prefixo, { limit: PAGINA, offset });
      if (error) throw new Error(error.message);
      const itens = data ?? [];
      for (const it of itens) {
        const caminho = prefixo ? `${prefixo}/${it.name}` : it.name;
        // Pasta não tem `id` no retorno do Storage; arquivo tem.
        if (it.id) caminhos.push(caminho);
        else caminhos.push(...(await listarTudo(caminho, profundidade + 1)));
      }
      if (itens.length < PAGINA) break;
    }
    return caminhos;
  }

  try {
    const caminhos = await listarTudo(familyId, 1);
    if (caminhos.length === 0) return { removidos: 0, erro: null };

    // ⛔ CINTO DE SEGURANÇA. Mesmo com a listagem partindo do prefixo da
    // família, nada sai daqui sem começar por `{familyId}/`. Se um dia a
    // listagem mudar de forma, esta linha é o que impede apagar arquivo de
    // outra família — e é o que o teste morde.
    //
    // ⚠️ `startsWith` SOZINHO NÃO BASTA, e o teste provou: `{famA}/../{famB}/x`
    // começa com o prefixo da A e aponta para a B. Travessia de caminho é
    // exatamente o tipo de furo que só aparece quando alguém tenta. Por isso
    // nenhum segmento pode ser `..` — nem `.`, que também muda a resolução.
    const seguros = caminhos.filter((c) => {
      if (!c.startsWith(`${familyId}/`)) return false;
      const segmentos = c.split("/");
      return !segmentos.includes("..") && !segmentos.includes(".");
    });
    if (seguros.length !== caminhos.length) {
      return {
        removidos: 0,
        erro: `listagem devolveu ${caminhos.length - seguros.length} caminho(s) fora do prefixo da família — abortado`,
      };
    }

    for (let i = 0; i < seguros.length; i += PAGINA) {
      const lote = seguros.slice(i, i + PAGINA);
      const { error } = await bucket.remove(lote);
      if (error) throw new Error(error.message);
      removidos += lote.length;
    }
    return { removidos, erro: null };
  } catch (e) {
    return { removidos, erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Apaga a família inteira. Usada pelos DOIS caminhos: o pedido da própria
 * pessoa (imediato, direito LGPD §18 V) e o cron de retenção.
 *
 * Ordem, e o porquê de cada passo:
 *   1. cancela a assinatura no Stripe (best-effort — falhar aqui não pode
 *      impedir a exclusão, que é direito da pessoa);
 *   2. registra o hash do e-mail/telefone (senão quem sai volta amanhã com 7
 *      dias grátis novos);
 *   3. apaga os arquivos do bucket ANTES do banco — depois do `deleteUser` já
 *      não existe `family_account_id` para descobrir o prefixo;
 *   4. apaga o usuário → cascata;
 *   5. registra o evento, que sobrevive à exclusão por `set null`.
 *
 * Idempotente: chamar duas vezes não quebra — na segunda o usuário já não
 * existe e o `deleteUser` devolve erro tratado.
 */
export async function excluirFamilia(
  admin: AdminClient,
  params: {
    familyId: string;
    userId: string;
    motivo: MotivoExclusao;
    /** Para o registro: quando a retenção começou e quando venceu. */
    detalhe?: Record<string, unknown>;
  },
): Promise<ResultadoExclusao> {
  const { familyId, userId, motivo } = params;

  // 1. Stripe — best-effort.
  const { data: sub } = await admin
    .from("subscription_accesses")
    .select("stripe_subscription_id")
    .eq("family_account_id", familyId)
    .maybeSingle();
  const subId = (sub?.stripe_subscription_id as string | null) ?? null;
  if (subId) {
    try {
      await getStripeClient().subscriptions.cancel(subId);
    } catch (e) {
      await logServerError("excluir_familia_stripe", e, { family_account_id: familyId });
    }
  }

  // 2. Marca o teste como usado (só hash).
  const { data: conta } = await admin
    .from("family_accounts")
    .select("whatsapp_e164")
    .eq("id", familyId)
    .maybeSingle();
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const { error: errReg } = await admin.rpc("registrar_teste_usado", {
    p_email: u?.user?.email ?? null,
    p_whatsapp: (conta?.whatsapp_e164 as string | null) ?? null,
    p_origem: motivo === "pedido_da_familia" ? "exclusao" : motivo,
  });
  if (errReg) {
    // Não impede a exclusão (o direito da pessoa vem primeiro), mas não pode
    // sumir: sem isto, a brecha do teste infinito volta em silêncio.
    await logServerError("registrar_teste_usado_falhou", errReg, {
      user_id: userId,
      family_account_id: familyId,
    });
  }

  // 3. Arquivos — antes do banco.
  const arquivos = await removerArquivosDaFamilia(admin, familyId);
  if (arquivos.erro) {
    await logServerError("excluir_familia_arquivos", new Error(arquivos.erro), {
      family_account_id: familyId,
    });
  }

  // 4. Banco.
  const { error: errDel } = await admin.auth.admin.deleteUser(userId);
  if (errDel) {
    await logEvent({
      kind: "familia_excluida_falhou",
      severity: "error",
      user_id: userId,
      family_account_id: familyId,
      message: `[${motivo}] ${errDel.message}`,
    });
    return {
      ok: false,
      familyId,
      arquivosRemovidos: arquivos.removidos,
      erro: errDel.message,
    };
  }

  // 5. Registro que sobrevive à própria exclusão.
  await logEvent({
    kind: "familia_excluida",
    severity: "warn",
    user_id: userId,
    family_account_id: familyId,
    message: `[${motivo}] família apagada · ${arquivos.removidos} arquivo(s) removido(s)`,
    ...(params.detalhe ? { payload: params.detalhe } : {}),
  });

  return { ok: true, familyId, arquivosRemovidos: arquivos.removidos, erro: null };
}
