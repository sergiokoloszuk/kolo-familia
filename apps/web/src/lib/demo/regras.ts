import crypto from "node:crypto";
import { chaveTelefoneBR } from "@/lib/telefone";

/**
 * DEMONSTRAÇÃO DA AYLA NA LANDING — regras puras (PEND-259, 27/11/2026).
 *
 * A virada comercial (PEND-256) troca o teste de dias por UMA conversa guiada
 * com a Ayla, por até 20 minutos. Este arquivo só tem decisões testáveis sem
 * banco nem rede; quem grava e envia é `servico.ts`.
 */

/** "Você tem 20 minutos" — o pedido de qualidade de tempo da responsável. */
export const DURACAO_MIN = 20;
/** Teto de custo: uma conversa boa cabe aqui com folga. */
export const MAX_TURNOS = 30;
/** Uma mensagem de WhatsApp longa; acima disso é colagem, não conversa. */
export const MAX_CHARS_MENSAGEM = 1500;
/** Validade do código, tentativas e reenvios — os mesmos números de `verificacao.ts`. */
export const VALIDADE_CODIGO_MIN = 10;
export const MAX_TENTATIVAS = 5;
export const MAX_REENVIOS = 3;
export const COOLDOWN_REENVIO_SEG = 60;
/** Freio global: pedidos de código por hora, somando todos os números. */
export const MAX_PEDIDOS_POR_HORA = 60;

/**
 * WhatsApp brasileiro para E.164 (`+55DDDNÚMERO`), ou null.
 *
 * Aceita com ou sem país, com ou sem máscara. Exige celular (9 dígitos depois
 * do DDD, começando por 9): o resumo vai por WhatsApp, e fixo não recebe.
 */
export function whatsappParaE164(entrada: string | null | undefined): string | null {
  let d = (entrada ?? "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99 || d[2] !== "9") return null;
  return `+55${d}`;
}

/** A chave do "1 por número" — a mesma normalização do resto do produto. */
export function chaveDoTelefone(e164: string): string {
  return chaveTelefoneBR(e164);
}

export type DadosDaPessoa = { nome: string; email: string; telefoneE164: string };

export type ValidacaoDados =
  | { ok: true; dados: DadosDaPessoa }
  | { ok: false; campo: "nome" | "email" | "whatsapp" | "aceite" };

/** Nome, e-mail, WhatsApp e o aceite dos termos — tudo obrigatório. */
export function validarDados(entrada: {
  nome?: unknown;
  email?: unknown;
  whatsapp?: unknown;
  aceite?: unknown;
}): ValidacaoDados {
  const nome = String(entrada.nome ?? "").trim().replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 120) return { ok: false, campo: "nome" };
  const email = String(entrada.email ?? "").trim().toLowerCase();
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, campo: "email" };
  }
  const telefoneE164 = whatsappParaE164(String(entrada.whatsapp ?? ""));
  if (!telefoneE164) return { ok: false, campo: "whatsapp" };
  if (entrada.aceite !== true) return { ok: false, campo: "aceite" };
  return { ok: true, dados: { nome, email, telefoneE164 } };
}

/** sha256 — para o código e para o token. Nenhum dos dois é guardado puro. */
export function hash(valor: string): string {
  return crypto.createHash("sha256").update(valor).digest("hex");
}

/** 6 dígitos com gerador criptográfico. */
export function gerarCodigo(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Token da sessão de conversa: 32 bytes, só o navegador guarda. */
export function gerarToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function textoDoCodigo(codigo: string): string {
  return (
    `Seu código para conversar com a Ayla é: ${codigo}\n\n` +
    `Ele vale por ${VALIDADE_CODIGO_MIN} minutos. Se não foi você que pediu, pode ignorar esta mensagem.`
  );
}

/** Quanto falta, em segundos (nunca negativo). */
export function segundosRestantes(expiraEm: string | null, agora = Date.now()): number {
  if (!expiraEm) return 0;
  return Math.max(0, Math.floor((Date.parse(expiraEm) - agora) / 1000));
}

export type EstadoSessao = "ativa" | "tempo_esgotado" | "turnos_esgotados" | "encerrada";

/** O que esta sessão ainda permite. */
export function estadoDaSessao(
  linha: { encerrada_em: string | null; expira_em: string | null; turnos: number },
  agora = Date.now(),
): EstadoSessao {
  if (linha.encerrada_em) return "encerrada";
  if (segundosRestantes(linha.expira_em, agora) <= 0) return "tempo_esgotado";
  if (linha.turnos >= MAX_TURNOS) return "turnos_esgotados";
  return "ativa";
}

/**
 * As regras que NÃO são da condução — e por isso não moram no documento
 * editável. A responsável ajusta o tom e o caminho da demonstração no Admin
 * (documento `demonstracao`); o que está aqui é fronteira de produto.
 */
export const REGRAS_FIXAS_DEMONSTRACAO = `<demonstracao_regras>
Esta é uma DEMONSTRAÇÃO única da Kolo Família, na página do site. A pessoa ainda não é cliente e esta conversa dura no máximo ${DURACAO_MIN} minutos.
- Você não tem cadastro, histórico nem perfil desta família: use só o que a pessoa contar aqui. Nunca diga que já conhece a criança.
- Não ofereça teste grátis nem dias grátis: eles não existem. Para continuar depois da demonstração, a pessoa cria a conta e escolhe um plano.
- Não peça documentos, endereço, CPF nem dados de saúde além do que ela mesma trouxer.
- Se houver risco à vida ou violência, oriente procurar ajuda agora: CVV 188 (24 h), SAMU 192 ou Polícia 190.
- No fim, a pessoa recebe no WhatsApp um resumo desta conversa.
</demonstracao_regras>`;

/** O system da demonstração: Core → condução da responsável → fronteiras. */
export function montarSystemDemonstracao(params: {
  core: string;
  conducao: string;
  nomePessoa: string;
  segundosRestantes: number;
}): string {
  const minutos = Math.max(1, Math.ceil(params.segundosRestantes / 60));
  return [
    params.core,
    `<conducao_demonstracao>\n${params.conducao.trim()}\n</conducao_demonstracao>`,
    REGRAS_FIXAS_DEMONSTRACAO,
    `<turno>Quem conversa: ${params.nomePessoa}. Restam cerca de ${minutos} minuto(s) de demonstração.</turno>`,
  ].join("\n\n");
}

export const SYSTEM_RESUMO = `Você é a Ayla, da Kolo Família. Escreva o RESUMO de uma conversa de demonstração que acabou de acontecer, para ser enviado no WhatsApp da pessoa.
- No máximo 900 caracteres, em português do Brasil, com acolhimento e sem exagero.
- Diga em 2 a 4 tópicos curtos o que ela trouxe e o caminho que vocês começaram a desenhar.
- Não invente nada que não esteja na conversa. Não diagnostique.
- Não ofereça teste nem dias grátis. Não coloque link: o sistema acrescenta.
- Termine com uma frase que convide a continuar com a Kolo.`;

/** O texto final que vai ao WhatsApp: resumo + caminho para criar a conta. */
export function textoDoResumo(params: { nome: string; resumo: string; linkCadastro: string }): string {
  return (
    `Oi, ${params.nome}! Aqui é a Ayla, da Kolo Família 🌿\n\n` +
    `${params.resumo.trim()}\n\n` +
    `Para continuar de onde paramos, é só criar sua conta e escolher seu plano:\n${params.linkCadastro}`
  );
}
