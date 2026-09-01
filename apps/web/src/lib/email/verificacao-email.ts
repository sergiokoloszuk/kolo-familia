import "server-only";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { send } from "./mailer";
import { logEvent, logServerError } from "@/lib/log";

/**
 * PROVAR O E-MAIL NOVO — sem nunca pedir o antigo.
 *
 * ── por que isto existe ───────────────────────────────────────────────────
 *
 * PROVEI POR EXECUÇÃO (31/08/2026, produção): `SECURE_EMAIL_CHANGE` está
 * ligado. `updateUser({ email })` manda DUAS mensagens — antigo e novo — e
 * confirmar só a nova devolve, do próprio GoTrue, *"Please proceed to confirm
 * link sent to the other email"*, com o campo `email` intacto. O caminho
 * nativo exige o endereço antigo, que é exatamente o que falta a quem digitou
 * errado: o fluxo de correção era inalcançável para quem precisava dele.
 *
 * ── o que este arquivo é ──────────────────────────────────────────────────
 *
 * O MESMO padrão de `lib/whatsapp/verificacao.ts`, aplicado a e-mail: código
 * de 6 dígitos, só o hash no banco, validade curta, teto de tentativas, teto
 * de reenvios, cooldown, e uma linha viva por usuário. Reutilizar aqui é usar
 * o padrão — não forçar a tabela do WhatsApp a carregar semântica de e-mail
 * (§4 do protocolo).
 *
 * ── as três regras que não podem cair ─────────────────────────────────────
 *
 * 1. **O `userId` vem SEMPRE da sessão, nunca do cliente.** Nenhuma função
 *    aqui aceita um id que o navegador tenha escolhido. É o que impede alguém
 *    de trocar o e-mail de outra pessoa.
 * 2. **O endereço novo só chega em `auth.users` DEPOIS da prova.** Até lá ele
 *    mora em `verificacoes_email.email_novo`, que não é o e-mail de login nem
 *    o endereço de recuperação.
 * 3. **A confirmação é reserva-primeiro.** Marcar `confirmado_em` é um UPDATE
 *    condicional (`is null`) que devolve linhas; só quem levou a linha troca o
 *    e-mail. Duas confirmações simultâneas não aplicam a troca duas vezes.
 */

/** 6 dígitos — o mesmo formato do código do WhatsApp e do e-mail do GoTrue. */
const DIGITOS = 6;
/**
 * Tempo de sair do app, abrir a caixa de e-mail e voltar. Maior que os 10
 * minutos do WhatsApp de propósito: e-mail demora mais para chegar, e aqui a
 * pessoa pode precisar entrar numa caixa que ela quase não usa.
 */
export const VALIDADE_MIN = 30;
/** 1 em 200 mil por palpite; 5 erros é digitação, não ataque. */
export const MAX_TENTATIVAS = 5;
/** Acima disso o problema é o endereço, e o caminho certo é corrigi-lo. */
export const MAX_REENVIOS = 3;
/** Evita rajada no SMTP e o duplo clique. */
export const COOLDOWN_REENVIO_SEG = 60;

export type ResultadoSolicitacao =
  | { ok: true }
  | { ok: false; motivo: "cooldown"; segundosRestantes: number }
  | {
      ok: false;
      motivo:
        | "max_reenvios"
        | "envio_falhou"
        | "erro"
        | "invalido"
        | "em_uso"
        | "igual_atual";
    };

export type ResultadoConfirmacao =
  | { ok: true; email: string }
  | {
      ok: false;
      motivo:
        | "sem_pedido"
        | "expirado"
        | "max_tentativas"
        | "codigo_errado"
        | "em_uso"
        | "erro";
    };

/** sha256 do código. O código em texto puro não é persistido em lugar nenhum. */
export function hashCodigo(codigo: string): string {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

/** 6 dígitos com gerador criptográfico — nunca um pseudoaleatório comum. */
export function gerarCodigo(): string {
  return String(crypto.randomInt(0, 10 ** DIGITOS)).padStart(DIGITOS, "0");
}

/** Normalização única do endereço. Comparar e gravar usam esta e só esta. */
export function normalizarEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Validação conservadora — o mailer e o GoTrue são os juízes finais. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && email.length <= 254;
}

/**
 * A mensagem. Curta, sem marketing, e SEM LINK.
 *
 * ⚠️ A ausência de link é decisão, não esquecimento. Um link clicável aqui
 * treinaria a família a clicar em links de e-mail que falam da conta dela —
 * que é a forma de todo phishing. Código digitado exige que a pessoa esteja na
 * tela que ela mesma abriu.
 */
export function textoDoCodigo(codigo: string): string {
  return (
    `Seu código para confirmar este e-mail na Kolo é: ${codigo}\n\n` +
    `Digite esse código na tela "Minha conta", que você deixou aberta. ` +
    `Ele expira em ${VALIDADE_MIN} minutos.\n\n` +
    `Se você não pediu essa alteração, ignore esta mensagem — nada muda ` +
    `enquanto o código não for usado.`
  );
}

function htmlDoCodigo(codigo: string): string {
  return [
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#2c2a27">`,
    `<p>Seu código para confirmar este e-mail na Kolo é:</p>`,
    `<p style="font-size:30px;letter-spacing:.3em;font-weight:600;margin:20px 0">${codigo}</p>`,
    `<p>Digite esse código na tela <strong>Minha conta</strong>, que você deixou aberta. Ele expira em ${VALIDADE_MIN} minutos.</p>`,
    `<p style="color:#6b6660;font-size:13px">Se você não pediu essa alteração, ignore esta mensagem — nada muda enquanto o código não for usado.</p>`,
    `</div>`,
  ].join("");
}

type Linha = {
  email_novo: string;
  expira_em: string;
  tentativas: number;
  reenvios: number;
  confirmado_em: string | null;
  updated_at: string;
};

/**
 * ⚠️ ESTA LEITURA LANÇA QUANDO O BANCO RECLAMA — e isso é o ponto.
 *
 * Engolir o erro aqui (`const { data } = ...`, que é o reflexo natural)
 * produziria o pior estado possível: com a migração 0085 ainda não aplicada, a
 * consulta falha, `atual` vira `null`, o fluxo segue como se não houvesse
 * desafio nenhum, **o e-mail com o código é enviado**, e só depois a gravação
 * falha. A pessoa receberia um código de 6 dígitos que não confirma nada, e o
 * endereço novo nunca poderia ser provado.
 *
 * Falhando aqui, a recusa acontece ANTES do envio.
 */
async function lerLinha(
  admin: SupabaseClient,
  userId: string,
): Promise<Linha | null> {
  const { data, error } = await admin
    .from("verificacoes_email")
    .select("email_novo, expira_em, tentativas, reenvios, confirmado_em, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`verificacoes_email indisponível: ${error.message}`);
  return (data as Linha | null) ?? null;
}

/**
 * O endereço já é de OUTRA conta?
 *
 * A Admin API do GoTrue filtra por e-mail exato (`?filter=`) — PROVEI POR
 * EXECUÇÃO em 01/09/2026 —, então isto é consulta pontual, não varredura que
 * envelhece mal quando a base cresce.
 *
 * ⚠️ A CHECAGEM VEM ANTES DO ENVIO, e não é economia de e-mail: mandar código
 * para um endereço que é de outra pessoa é incômodo contra terceiro. Mesma
 * decisão que `numeroDeOutraConta` tomou para o WhatsApp.
 *
 * Não é oráculo novo de enumeração: o `/signup` já responde "esse e-mail já
 * tem conta" para qualquer visitante, sem sessão nenhuma. Aqui exige sessão.
 */
async function emailDeOutraConta(
  email: string,
  userIdAtual: string,
): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !chave) throw new Error("Supabase não configurado no servidor.");

  const url =
    `${base.replace(/\/$/, "")}/auth/v1/admin/users` +
    `?filter=${encodeURIComponent(email)}&per_page=10`;
  const r = await fetch(url, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
    cache: "no-store",
  });
  // Fail-closed: sem saber responder, não deixa passar como "livre" — um falso
  // "está livre" mandaria código para a caixa de outra pessoa.
  if (!r.ok) throw new Error("Não consegui conferir o e-mail agora.");

  const j = (await r.json()) as { users?: Array<{ id: string; email?: string }> };
  return (j.users ?? []).some(
    (u) => normalizarEmail(u.email ?? "") === email && u.id !== userIdAtual,
  );
}

/**
 * Passo 1 — pedir o código para o endereço NOVO.
 *
 * ⚠️ O CÓDIGO NUNCA SAI DAQUI. Não vai no retorno, não vai em log, não vai em
 * evento. O único lugar onde ele existe em texto puro é a mensagem entregue ao
 * endereço que a pessoa informou.
 *
 * Reenviar ATUALIZA a linha (índice único por usuário): gera código novo,
 * invalida o anterior e zera as tentativas. Nunca cria um segundo desafio vivo
 * — é o que impede que retry ou duplo clique gerem estados paralelos.
 */
export async function solicitarCodigoEmail(
  admin: SupabaseClient,
  params: { userId: string; emailAtual: string | null; emailNovo: string },
): Promise<ResultadoSolicitacao> {
  const { userId } = params;
  const emailNovo = normalizarEmail(params.emailNovo);
  const emailAtual = normalizarEmail(params.emailAtual ?? "");

  if (!emailValido(emailNovo)) return { ok: false, motivo: "invalido" };
  if (emailNovo === emailAtual) return { ok: false, motivo: "igual_atual" };

  try {
    const atual = await lerLinha(admin, userId);

    // Cooldown e teto valem para o MESMO endereço. Trocar de endereço é
    // recomeçar: quem digitou errado duas vezes não pode ficar presa pelo
    // limite do endereço errado.
    const mesmoEmail = atual?.email_novo === emailNovo;
    if (atual && mesmoEmail) {
      const desdeUltimo =
        (Date.now() - new Date(atual.updated_at).getTime()) / 1000;
      if (desdeUltimo < COOLDOWN_REENVIO_SEG) {
        return {
          ok: false,
          motivo: "cooldown",
          segundosRestantes: Math.ceil(COOLDOWN_REENVIO_SEG - desdeUltimo),
        };
      }
      if (atual.reenvios >= MAX_REENVIOS) {
        return { ok: false, motivo: "max_reenvios" };
      }
    }

    if (await emailDeOutraConta(emailNovo, userId)) {
      return { ok: false, motivo: "em_uso" };
    }

    const codigo = gerarCodigo();
    const expira = new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString();
    const reenvios = atual && mesmoEmail ? atual.reenvios + 1 : 0;

    // ⚠️ MANDA ANTES DE GRAVAR. Se o SMTP falhar, a pessoa não fica com um
    // desafio vivo que ela nunca recebeu — e o contador de reenvios não é
    // consumido por uma mensagem que não saiu. Mesmo fail-closed de 0080.
    try {
      await send({
        to: emailNovo,
        subject: "Seu código da Kolo Família",
        text: textoDoCodigo(codigo),
        html: htmlDoCodigo(codigo),
      });
    } catch (e) {
      // O erro do SMTP pode trazer o envelope inteiro; nunca o repasse cru.
      await logServerError(
        "email_codigo_envio_falhou",
        new Error("SMTP recusou o envio"),
        { user_id: userId },
      );
      void e;
      return { ok: false, motivo: "envio_falhou" };
    }

    const { error } = await admin.from("verificacoes_email").upsert(
      {
        user_id: userId,
        email_novo: emailNovo,
        codigo_hash: hashCodigo(codigo),
        expira_em: expira,
        tentativas: 0,
        reenvios,
        confirmado_em: null,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      await logServerError("email_codigo_gravar_falhou", error, {
        user_id: userId,
      });
      return { ok: false, motivo: "erro" };
    }

    await logEvent({
      kind: "email_codigo_solicitado",
      severity: "info",
      persistir: true,
      message: `código de e-mail solicitado · reenvio ${reenvios}`,
      // Sem o endereço e sem o código: nenhum dos dois precisa estar aqui.
      payload: { reenvios, expira_em: expira },
    });
    return { ok: true };
  } catch (e) {
    await logServerError("email_codigo_solicitar_excecao", e, {
      user_id: userId,
    });
    return { ok: false, motivo: "erro" };
  }
}

/**
 * Passo 2 — conferir o código e, só então, trocar o e-mail.
 *
 * ⚠️ O ENDEREÇO FAZ PARTE DA CONFERÊNCIA, como o telefone em 0080: um código
 * pedido para um endereço não confirma outro, nem quando a pessoa troca o
 * campo entre pedir e confirmar.
 *
 * ⚠️ RESERVA PRIMEIRO. O `confirmado_em` é marcado por UPDATE condicional
 * (`.is("confirmado_em", null)`) que devolve as linhas afetadas. Quem não
 * recebe linha nenhuma perdeu a corrida e NÃO troca o e-mail — é o que faz o
 * uso único valer contra replay e contra duas abas confirmando junto.
 */
export async function confirmarCodigoEmail(
  admin: SupabaseClient,
  params: { userId: string; emailNovo: string; codigo: string },
): Promise<ResultadoConfirmacao> {
  const { userId } = params;
  const emailNovo = normalizarEmail(params.emailNovo);
  const codigo = (params.codigo ?? "").replace(/\D/g, "");

  try {
    const atual = await lerLinha(admin, userId);
    if (!atual || atual.email_novo !== emailNovo || atual.confirmado_em) {
      return { ok: false, motivo: "sem_pedido" };
    }
    if (new Date(atual.expira_em).getTime() <= Date.now()) {
      return { ok: false, motivo: "expirado" };
    }
    if (atual.tentativas >= MAX_TENTATIVAS) {
      return { ok: false, motivo: "max_tentativas" };
    }

    const { data: linha } = await admin
      .from("verificacoes_email")
      .select("codigo_hash")
      .eq("user_id", userId)
      .maybeSingle();
    const esperado = (linha?.codigo_hash as string | undefined) ?? "";
    const recebido = codigo.length === DIGITOS ? hashCodigo(codigo) : "";

    // Comparação em tempo constante. Os dois lados são sha256 em hex, então o
    // comprimento é sempre igual quando o formato está certo.
    const confere =
      esperado.length > 0 &&
      recebido.length === esperado.length &&
      crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));

    if (!confere) {
      // ⚠️ A TENTATIVA É CONTADA ANTES DE QUALQUER OUTRA COISA. Se a escrita do
      // contador falhar, a resposta continua sendo "errado" — nunca "certo".
      await admin
        .from("verificacoes_email")
        .update({ tentativas: atual.tentativas + 1 })
        .eq("user_id", userId);
      await logEvent({
        kind: "email_codigo_falhou",
        severity: "warn",
        message: `código de e-mail incorreto · tentativa ${
          atual.tentativas + 1
        }/${MAX_TENTATIVAS}`,
      });
      return { ok: false, motivo: "codigo_errado" };
    }

    // RESERVA: quem levar a linha é quem troca o e-mail. O uso único vive aqui.
    const agora = new Date().toISOString();
    const { data: reservadas, error: eReserva } = await admin
      .from("verificacoes_email")
      .update({ confirmado_em: agora })
      .eq("user_id", userId)
      .eq("email_novo", emailNovo)
      .is("confirmado_em", null)
      .select("user_id");
    if (eReserva) {
      await logServerError("email_reserva_falhou", eReserva, {
        user_id: userId,
      });
      return { ok: false, motivo: "erro" };
    }
    if (!reservadas || reservadas.length === 0) {
      // Outra requisição já consumiu este código. Não é erro: é o uso único
      // funcionando.
      return { ok: false, motivo: "sem_pedido" };
    }

    // ⚠️ ESCRITA CRÍTICA (§7): o cliente DEVOLVE o erro em vez de lançar. Sem
    // conferir, a tela diria "e-mail alterado" com o endereço antigo ainda no
    // lugar — e a mãe seguiria sem caminho de recuperação achando que tem um.
    const { error: eTroca } = await admin.auth.admin.updateUserById(userId, {
      email: emailNovo,
      // A posse já foi provada pelo código. Sem isto o GoTrue reabriria a
      // dupla confirmação que esta frente inteira existe para evitar.
      email_confirm: true,
    });

    if (eTroca) {
      const msg = (eTroca.message || "").toLowerCase();
      const conflito =
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists");
      await logServerError("email_troca_falhou", eTroca, { user_id: userId });
      // A reserva foi consumida por uma troca que não aconteceu. Devolve o
      // desafio, senão a pessoa fica travada por uma falha que não é dela.
      await admin
        .from("verificacoes_email")
        .update({ confirmado_em: null })
        .eq("user_id", userId);
      return { ok: false, motivo: conflito ? "em_uso" : "erro" };
    }

    // Desafio cumprido: some. Código gasto não fica vivo no banco.
    await admin.from("verificacoes_email").delete().eq("user_id", userId);

    await logEvent({
      kind: "email_alterado",
      severity: "info",
      persistir: true,
      message: "e-mail de login alterado e provado",
      // Sem o endereço: quem precisa dele lê da conta, com autorização.
      payload: { em: agora },
    });
    return { ok: true, email: emailNovo };
  } catch (e) {
    await logServerError("email_confirmar_excecao", e, { user_id: userId });
    return { ok: false, motivo: "erro" };
  }
}

/** O que a tela precisa saber para se desenhar sem perguntar de novo. */
export async function pendenteDeEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const atual = await lerLinha(admin, userId);
  if (!atual || atual.confirmado_em) return null;
  if (new Date(atual.expira_em).getTime() <= Date.now()) return null;
  return atual.email_novo;
}
