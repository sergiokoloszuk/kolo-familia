/**
 * Mailer — envio de emails transacionais customizados pelo app Next.
 *
 * Quando usar:
 *   - Emails do PRODUTO (convites, lembretes, notificações de conta etc)
 *
 * Quando NÃO usar:
 *   - Emails de AUTH (signup/confirmação, recuperar senha, magic link).
 *     Esses são enviados pelo Supabase Auth (GoTrue) usando o SMTP
 *     configurado nas envs `GOTRUE_SMTP_*` do serviço Auth no Easypanel.
 *     A app Next não controla esse fluxo.
 *
 * Configuração — envs no Vercel (production) e .env.local (dev):
 *   SMTP_HOST   — ex: smtp-relay.brevo.com
 *   SMTP_PORT   — ex: 587 (STARTTLS) ou 465 (TLS implícito)
 *   SMTP_USER   — login SMTP do provedor
 *   SMTP_PASS   — chave/senha SMTP do provedor
 *   SMTP_FROM   — sender verificado no provedor, ex: "Kolo Família <no-reply@kolofamilia.com.br>"
 */

import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// ============================================================
// Validação de envs (lazy — só quando o transporter for usado)
// ============================================================

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function readSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  const faltando: string[] = [];
  if (!host) faltando.push("SMTP_HOST");
  if (!portRaw) faltando.push("SMTP_PORT");
  if (!user) faltando.push("SMTP_USER");
  if (!pass) faltando.push("SMTP_PASS");
  if (!from) faltando.push("SMTP_FROM");

  if (faltando.length > 0) {
    throw new Error(
      `Mailer: envs ausentes — ${faltando.join(", ")}. Configure em .env.local (dev) e Vercel (prod).`,
    );
  }

  const port = Number.parseInt(portRaw!, 10);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Mailer: SMTP_PORT inválido (${portRaw}).`);
  }

  return {
    host: host!,
    port,
    user: user!,
    pass: pass!,
    from: from!,
  };
}

// ============================================================
// Transporter cacheado (1 por processo)
// ============================================================

let cachedTransporter: Transporter | null = null;
let cachedFrom: string | null = null;

function getTransporter(): { transporter: Transporter; from: string } {
  if (cachedTransporter && cachedFrom) {
    return { transporter: cachedTransporter, from: cachedFrom };
  }

  const cfg = readSmtpConfig();

  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    // STARTTLS no 587, TLS direto no 465. Nodemailer infere por port,
    // mas explicitamos pra evitar surpresa em provedores variados.
    secure: cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
  cachedFrom = cfg.from;

  return { transporter: cachedTransporter, from: cachedFrom };
}

// ============================================================
// API pública
// ============================================================

export interface SendOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /**
   * Sobrescreve o SMTP_FROM apenas pra esta mensagem.
   * Útil pra emails que precisam sender específico (ex: suporte vs marketing).
   * O endereço usado precisa estar verificado no provedor.
   */
  from?: string;
  /**
   * Email de resposta — usado quando from é um no-reply mas você
   * quer permitir resposta humana.
   */
  replyTo?: string;
}

export interface SendResult {
  /** ID do message-id retornado pelo SMTP. */
  messageId: string;
  /** Resposta crua do SMTP (linha de status). */
  response: string;
  /** Destinatários aceitos pelo servidor. */
  accepted: string[];
  /** Destinatários rejeitados (ex: endereço inválido). */
  rejected: string[];
}

/**
 * Envia 1 email via SMTP configurado.
 *
 * Exige `html` OU `text` (ou ambos — recomendado, melhora entregabilidade).
 *
 * @throws Error se envs SMTP_* não estiverem configuradas, ou se o envio falhar.
 */
export async function send(opts: SendOptions): Promise<SendResult> {
  if (!opts.html && !opts.text) {
    throw new Error("Mailer: forneça pelo menos `html` ou `text`.");
  }

  const { transporter, from } = getTransporter();

  const info = await transporter.sendMail({
    from: opts.from ?? from,
    to: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  });

  return {
    messageId: info.messageId,
    response: info.response,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
  };
}

/**
 * Verifica conectividade SMTP — útil em healthcheck/diagnóstico.
 * Tenta conectar e autenticar sem enviar email.
 *
 * @throws Error se envs ausentes ou conexão falhar.
 */
export async function verify(): Promise<boolean> {
  const { transporter } = getTransporter();
  return transporter.verify();
}
