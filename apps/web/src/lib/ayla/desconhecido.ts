import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarTexto } from "./whatsappSender";
import { chaveTelefoneBR } from "@/lib/telefone";
import { logEvent } from "@/lib/log";

/**
 * QUEM ESCREVE SEM TER CADASTRO.
 *
 * Até 31/07/2026, mensagem de número não reconhecido morria assim:
 *
 *   if (!family) { console.warn("inbound de número não cadastrado"); return; }
 *
 * Silêncio absoluto, e a mensagem NÃO era guardada em lugar nenhum — nem em
 * `ayla_messages` (o retorno acontece antes de persistir), nem no CRM. Sobrava
 * uma linha de log que ninguém lê. O caso que revelou isso: uma mãe escreveu
 * "boa tarde" em dois dias seguidos e "tou tentando falar com vc sobre minha
 * filha", e esperou dois dias por nada. Só descobrimos por um print.
 *
 * Duas coisas mudam aqui, e a primeira vale mesmo sem a segunda:
 *
 * 1. O CONTATO FICA REGISTRADO. Sem isso não dá para responder "quantas mães
 *    já escreveram e foram ignoradas?" — a resposta estava sendo jogada fora
 *    em tempo real.
 * 2. ELA RECEBE UMA RESPOSTA, UMA VEZ SÓ. Ela escreveu primeiro; responder
 *    quem te procurou é atendimento, não abordagem — a distinção que torna
 *    isto seguro do ponto de vista de LGPD e de reputação do número. Se não
 *    se cadastrar, silêncio definitivo: nunca mais recebe nada.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, e é deliberado:
 *
 * - NÃO chama IA. Número desconhecido não recebe agente conversacional: foi
 *   assim que uma criança acabou conversando sozinha com a Ayla. Uma mensagem
 *   fixa, uma vez, e ponto.
 * - NÃO convida a responder por aqui. Enquanto ela não se cadastrar, uma
 *   resposta dela cairia no mesmo silêncio — pedir que ela conte algo seria
 *   abrir uma porta que não existe.
 * - NÃO insiste. Uma mensagem por número, para sempre. Quem não se cadastrou
 *   não recebe lembrete: o convite é oferta, não cobrança.
 * - NÃO promete o teste com número exato de dias. O ledger (`testes_usados`)
 *   hasheia o telefone sem normalizar país nem 9º dígito, então "esse número
 *   já usou o teste?" não é respondível com confiança daqui. Prometer 7 dias
 *   e o cadastro negar seria pior que silêncio. A página do cadastro informa.
 *
 * SEM TABELA NOVA, de propósito: migração não pode ser aplicada em produção
 * agora, e uma funcionalidade que depende de tabela inexistente não ajudaria
 * a próxima mãe. `eventos_app` já aceita `family_account_id` nulo e tem
 * `payload jsonb` — serve, e o custo é o registro ficar num lugar menos óbvio.
 */

/** Desligar em produção sem deploy: `AYLA_RESPOSTA_DESCONHECIDO=0`. */
const ENV_FLAG = "AYLA_RESPOSTA_DESCONHECIDO";

/**
 * UMA VEZ POR NÚMERO, PARA SEMPRE (regra de produto, Sérgio, 31/07/2026).
 *
 * Não há janela de repetição. Quem recebeu o convite e não se cadastrou entra
 * em silêncio definitivo: não recebe de novo e não é respondida em mais nada.
 *
 * Insistir é justamente o que faz quem não foi atendida — e transformar isso
 * em mensagem repetida seria a Ayla perseguindo quem já disse não com o
 * próprio silêncio. O convite é uma oferta, não uma cobrança.
 */

const KIND_RECEBIDO = "ayla_inbound_desconhecido";
const KIND_RESPONDIDO = "ayla_desconhecido_respondido";

function habilitado(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env[ENV_FLAG] ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false"; // ligado por padrão
}

/**
 * O app em produção. Fica aqui como QUEDA porque a alternativa é pior: sem
 * `NEXT_PUBLIC_APP_URL` a pessoa não receberia nada, e o motivo do silêncio
 * seria uma variável de ambiente. O endereço real manda; este é o piso.
 *
 * ⚠️ Trocar quando o app ganhar domínio próprio — hoje `kolofamilia.com.br` é
 * a landing da Base44, não o app.
 */
const APP_PADRAO = "https://kolo-familia-web.vercel.app";

function linkDeCadastro(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || APP_PADRAO).replace(/\/$/, "");
  return base ? `${base}/signup` : "";
}

/**
 * A mensagem. Fixa, curta, sem pergunta.
 *
 * Diz POR QUE houve silêncio (senão ela conclui que foi ignorada), dá o
 * caminho, e avisa que depois do cadastro o WhatsApp funciona — que é a única
 * expectativa que a gente consegue honrar hoje.
 */
export function textoParaDesconhecido(link: string): string {
  return [
    "Oi! Aqui é a Ayla, do Kolo Família 🌿",
    "",
    "Ainda não encontrei um cadastro com este número, e por isso não consegui te responder antes.",
    "",
    `É por aqui que você entra: ${link}`,
    "",
    "Depois de entrar, é só me chamar neste mesmo número que a gente conversa.",
  ].join("\n");
}

/** Preview curto para o registro. O logger proíbe mensagem inteira; 60 chars
 *  é o teto que ele mesmo autoriza, e basta para reconhecer o assunto. */
const preview = (t: string | null | undefined) => (t ?? "").trim().slice(0, 60);

/** Este número já recebeu o convite alguma vez? Sem recorte de tempo. */
async function jaRecebeuOConvite(
  supabase: SupabaseClient,
  chave: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("eventos_app")
      .select("id")
      .eq("kind", KIND_RESPONDIDO)
      .contains("payload", { chave })
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    // Na dúvida, NÃO responde. Repetir o convite para quem já recebeu é pior
    // que perder um envio — e o registro do contato acontece de qualquer forma.
    return true;
  }
}

export type ResultadoDesconhecido = {
  registrado: boolean;
  respondido: boolean;
  motivo?: "flag_desligada" | "sem_link" | "ja_respondido" | "envio_falhou";
};

/**
 * Registra o contato e, se este número nunca recebeu o convite, responde com
 * o link. Se já recebeu, registra e cala — para sempre.
 *
 * NUNCA lança: isto roda no caminho do webhook, e uma falha aqui não pode
 * derrubar o processamento de quem VEM depois na mesma execução.
 */
export async function atenderDesconhecido(
  supabase: SupabaseClient,
  inbound: { phoneE164: string; texto: string | null },
): Promise<ResultadoDesconhecido> {
  const chave = chaveTelefoneBR(inbound.phoneE164);

  // 1. REGISTRAR sempre — inclusive com a resposta desligada. É o que
  //    transforma "achamos que é raro" em número.
  await logEvent({
    kind: KIND_RECEBIDO,
    severity: "warn", // `warn` para persistir em eventos_app; ver lib/log.ts
    payload: {
      chave,
      phone: inbound.phoneE164,
      preview: preview(inbound.texto),
    },
  }).catch(() => {});

  if (!habilitado()) return { registrado: true, respondido: false, motivo: "flag_desligada" };

  const link = linkDeCadastro();
  if (!link) {
    // Sem `NEXT_PUBLIC_APP_URL` a mensagem seria um convite sem porta.
    await logEvent({
      kind: "ayla_desconhecido_sem_link",
      severity: "error",
      payload: { chave },
    }).catch(() => {});
    return { registrado: true, respondido: false, motivo: "sem_link" };
  }

  if (await jaRecebeuOConvite(supabase, chave)) {
    return { registrado: true, respondido: false, motivo: "ja_respondido" };
  }

  try {
    await enviarTexto({
      phoneE164: inbound.phoneE164,
      texto: textoParaDesconhecido(link),
      delaySegundos: 2,
    });
  } catch (e) {
    await logEvent({
      kind: "ayla_desconhecido_envio_falhou",
      severity: "error",
      payload: { chave, erro: e instanceof Error ? e.message : "desconhecido" },
    }).catch(() => {});
    return { registrado: true, respondido: false, motivo: "envio_falhou" };
  }

  // 2. MARCAR o envio — é este registro que a dedup lê na próxima mensagem.
  await logEvent({
    kind: KIND_RESPONDIDO,
    severity: "warn",
    payload: { chave, phone: inbound.phoneE164 },
  }).catch(() => {});

  return { registrado: true, respondido: true };
}
