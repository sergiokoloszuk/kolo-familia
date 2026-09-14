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
 * ⚠️ ESTE MÓDULO FOI ESCRITO EM 31/07/2026 E NUNCA CHEGOU À PRODUÇÃO. O commit
 * `5a69e89` ficou parado no branch `bia/ciclo-tecnico`, que não foi para a
 * main — então o silêncio que ele conserta seguiu acontecendo por 17 dias. Foi
 * recuperado em 17/08/2026 depois de um número (21 9xxxx-1351) escrever e não
 * receber nada. Código escrito não é código no ar: ver AI-ENGINEERING-PROTOCOL §18.
 *
 * Duas coisas mudam aqui, e a primeira vale mesmo sem a segunda:
 *
 * 1. O CONTATO FICA REGISTRADO. Sem isso não dá para responder "quantas mães
 *    já escreveram e foram ignoradas?" — a resposta estava sendo jogada fora
 *    em tempo real.
 * 2. ELA RECEBE UMA RESPOSTA, UMA VEZ SÓ. Ela escreveu primeiro; responder
 *    quem te procurou é atendimento, não abordagem — a distinção que torna
 *    isto seguro do ponto de vista de LGPD e de reputação do número. Se não se
 *    cadastrar, silêncio definitivo: nunca mais recebe nada.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, e é deliberado:
 *
 * - NÃO insiste. Uma mensagem por número, para sempre. Quem não se cadastrou
 *   não recebe lembrete: o convite é oferta, não cobrança.
 *
 * - NÃO chama IA. Número desconhecido não recebe agente conversacional: foi
 *   assim que uma criança acabou conversando sozinha com a Ayla. Uma mensagem
 *   fixa, uma vez, e ponto. (É por isso que o caminho novo/experimental não
 *   participa daqui: ele só existe depois de a família ser identificada.)
 * - NÃO convida a responder por aqui. Enquanto ela não se cadastrar, uma
 *   resposta dela cairia no mesmo silêncio — pedir que ela conte algo seria
 *   abrir uma porta que não existe.
 * - NÃO promete número de dias de teste. O ledger (`testes_usados`) hasheia o
 *   telefone sem normalizar país nem 9º dígito, então "esse número já usou o
 *   teste?" não é respondível com confiança daqui. A mensagem aponta o BOTÃO
 *   ("começar o teste"), que é navegação; quem diz a quantos dias ela tem
 *   direito é a página, que sabe.
 *
 * SEM TABELA NOVA, de propósito: `eventos_app` já aceita `family_account_id`
 * nulo e tem `payload jsonb` — serve, e o custo é o registro ficar num lugar
 * menos óbvio.
 */

/** Desligar em produção sem deploy: `AYLA_RESPOSTA_DESCONHECIDO=0`. */
const ENV_FLAG = "AYLA_RESPOSTA_DESCONHECIDO";

/**
 * UMA VEZ POR NÚMERO, PARA SEMPRE (regra de produto, Sérgio, 31/07/2026).
 *
 * Não existe janela de repetição, e é por isso que não existe constante de
 * janela aqui. Quem recebeu o convite e não se cadastrou entra em silêncio
 * definitivo: não recebe de novo no dia seguinte, nem em 7 dias, nem meses
 * depois.
 *
 * Insistir é justamente o que faz quem não foi atendida — transformar isso em
 * mensagem repetida seria a Ayla perseguindo quem já respondeu com o próprio
 * silêncio. O convite é uma oferta, não uma cobrança.
 *
 * ⚠️ ESTA REGRA JÁ TINHA SIDO DECIDIDA E SE PERDEU. Ela existe desde 31/07 no
 * commit `30fd849`, que ficou no branch `bia/ciclo-tecnico`. Em 17/08 o módulo
 * foi recuperado a partir do commit ANTERIOR (`5a69e89`), que ainda tinha a
 * janela de 7 dias, e a versão superada chegou a produção. Um teste abaixo
 * trava o `gte("created_at", …)` para que a repetição não volte em silêncio.
 */

const KIND_RECEBIDO = "ayla_inbound_desconhecido";
const KIND_RESPONDIDO = "ayla_desconhecido_respondido";

function habilitado(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env[ENV_FLAG] ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false"; // ligado por padrão
}

/**
 * O app em produção. Fica aqui como QUEDA porque a alternativa é pior: sem
 * `NEXT_PUBLIC_APP_URL` a pessoa não receberia nada, e o motivo do silêncio de
 * uma mãe seria uma variável de ambiente. O endereço real manda; este é o piso.
 *
 * ⚠️ MEDIDO EM 17/08/2026: produção serve este endereço — conferido pelo
 * `sitemap.xml` público, que é montado a partir da mesma variável. Ou seja, o
 * piso está correto hoje e não é um palpite.
 *
 * ⚠️ Trocar quando o app ganhar domínio próprio — `kolofamilia.com.br` é a
 * landing da Base44, não o app.
 */
const APP_PADRAO = "https://kolo-familia-web.vercel.app";

function linkDeCadastro(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || APP_PADRAO).replace(/\/$/, "");
  return base ? `${base}/signup` : "";
}

/**
 * ISTO É UM CELULAR DE UMA PESSOA?
 *
 * ⚠️ GUARDA NOVA (17/08/2026), e ela não existia no módulo original porque o
 * módulo original nunca rodou. `parseZapiWebhook` filtra `fromMe`, mas NÃO
 * filtra GRUPO: uma mensagem de grupo chega com o id do grupo no campo
 * `phone`, não casa com família nenhuma, e cairia aqui.
 *
 * Enquanto a resposta era silêncio, isso era inócuo. Ligar a resposta sem esta
 * guarda criaria um vetor novo — a Ayla despejando convite de cadastro dentro
 * de grupo de WhatsApp, que é exatamente o tipo de envio que queima o número.
 *
 * O critério é o comprimento: E.164 vai até 15 dígitos, e id de grupo da Z-API
 * é bem maior (18+). Fail-closed: qualquer coisa fora do formato de telefone
 * não recebe mensagem — mas CONTINUA sendo registrada, porque saber que
 * aconteceu é o que permite decidir depois.
 */
export function pareceCelularPessoal(phoneE164: string | null | undefined): boolean {
  const bruto = (phoneE164 ?? "").trim();
  if (!ehTelefoneDeVerdade(bruto)) return false;
  const digitos = bruto.replace(/\D/g, "");
  return digitos.length >= 8 && digitos.length <= 15;
}

/**
 * ISTO É UM NÚMERO DE TELEFONE, OU OUTRA COISA QUE O WHATSAPP CHAMA DE "phone"?
 *
 * ⚠️ ESTA FUNÇÃO NASCEU DE UM DEFEITO EM PRODUÇÃO, 14/09/2026, E ELE ERA GRAVE.
 *
 * O WhatsApp passou a entregar, para parte dos remetentes, um LID
 * (`<digitos>@lid`) no lugar do telefone — é o identificador da era de
 * privacidade da Meta, e `parseZapiWebhook` o copia para `phoneE164` com um
 * "+" na frente. `chaveTelefoneBR` então **descarta os não-dígitos**, o `@lid`
 * evapora, e sobra uma chave de 14–15 dígitos que não casa com família
 * nenhuma. A consulta funciona, ninguém erra, e o sistema conclui que uma
 * família cadastrada não existe.
 *
 * A guarda antiga não pegava isso porque contava dígitos DEPOIS de limpar: um
 * LID de 15 dígitos passava exatamente como um telefone internacional.
 *
 * ⚠️ O CASO REAL. 14/09, 13:38. Barbara conversava com a Ayla havia 25 minutos
 * sobre o filho; às 13:32 ela relatou que o menino estava se batendo. Às
 * 13:38:13 e 13:38:44, no meio dessa conversa, duas mensagens dela chegaram com
 * LID e ela recebeu: *"Ainda não encontrei um cadastro com este número"*. Duas
 * vezes. Antes disso, em 19 e 21/08, outra mãe — que escreveu literalmente
 * *"Ayla eu tenho um cadastro criado uma conta"* — perdeu cinco mensagens pelo
 * mesmo caminho.
 *
 * MEDIDO em `eventos_app`: 7 mensagens de família perdidas e 3 falsos
 * "não encontrei cadastro" enviados, em 3 identificadores distintos — 6 eventos
 * em agosto e 4 na primeira metade de setembro. Está crescendo, porque a
 * migração do WhatsApp para LID é progressiva.
 *
 * ⚠️ ESTE PATCH NÃO RESOLVE O PROBLEMA INTEIRO, e isso precisa estar escrito: a
 * mensagem da família continua sem resposta, porque o LID não diz quem ela é.
 * O que ele impede é o PIOR dos dois danos — afirmar a uma família cadastrada,
 * em texto, que ela não existe. Silêncio é recuperável; a afirmação falsa, num
 * momento como o da Barbara, não é.
 *
 * O critério é o formato BRUTO, antes de qualquer limpeza: telefone tem dígitos,
 * "+", espaço, hífen e parênteses. `@` (LID, `@g.us` de grupo, `@broadcast`) e
 * letras não são telefone.
 */
export function ehTelefoneDeVerdade(identificador: string | null | undefined): boolean {
  const s = (identificador ?? "").trim();
  if (!s) return false;
  return /^\+?[\d\s().-]+$/.test(s);
}

/**
 * A mensagem. Fixa, curta, sem pergunta.
 *
 * Diz POR QUE houve silêncio (senão ela conclui que foi ignorada), dá o
 * caminho, aponta o botão, e pede o cadastro COM ESTE MESMO NÚMERO — que é a
 * única coisa que faz o WhatsApp funcionar depois. Sem essa linha, ela pode
 * cadastrar outro telefone e voltar ao mesmo silêncio por outro caminho.
 */
export function textoParaDesconhecido(link: string): string {
  return [
    "Oi! Aqui é a Ayla, do Kolo Família 🌿",
    "",
    "Ainda não encontrei um cadastro com este número, e foi por isso que você não teve resposta antes.",
    "",
    `O caminho de entrada é este: ${link}`,
    "",
    "Lá é só tocar no botão de começar o teste e criar a conta com este mesmo número de WhatsApp.",
    "",
    "Assim que terminar, é só me chamar aqui que a gente conversa.",
  ].join("\n");
}

/** Preview curto para o registro. O logger proíbe mensagem inteira; 60 chars
 *  é o teto que ele mesmo autoriza, e basta para reconhecer o assunto. */
const preview = (t: string | null | undefined) => (t ?? "").trim().slice(0, 60);

/**
 * Este número já recebeu o convite ALGUMA VEZ? Sem recorte de tempo.
 *
 * ⚠️ NÃO ACRESCENTE `gte("created_at", …)` AQUI. É a linha que transforma
 * "uma vez, para sempre" em "uma vez por janela", e a diferença não aparece em
 * lugar nenhum até uma mãe receber o mesmo convite pela segunda vez. Um teste
 * prende exatamente isto.
 */
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
  motivo?: "flag_desligada" | "sem_link" | "ja_respondido" | "envio_falhou" | "nao_e_pessoal";
};

/**
 * Registra o contato e, se este número NUNCA recebeu o convite, responde com
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

  // 1. REGISTRAR sempre — inclusive com a resposta desligada, e inclusive
  //    quando não é um celular pessoal. É o que transforma "achamos que é
  //    raro" em número.
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

  // Grupo, lista de transmissão, LID, id estranho — registra e não responde.
  if (!pareceCelularPessoal(inbound.phoneE164)) {
    /**
     * ⚠️ O EVENTO PRÓPRIO EXISTE PARA DESTRAVAR A CORREÇÃO DE VERDADE.
     *
     * Silenciar o falso "não encontrei cadastro" para o alívio imediato, e
     * ficar sem saber quantas famílias estão mudas, seria trocar um defeito
     * visível por um invisível. Enquanto o LID não for resolvido para a
     * família, CADA linha destas é uma mãe que escreveu e não teve resposta —
     * e o número precisa estar à vista para decidir a urgência do resto.
     *
     * Só o SUFIXO do identificador (`lid`, `g.us`, `broadcast`) e o tamanho: o
     * suficiente para separar grupo de LID sem guardar o identificador de
     * ninguém além do que o evento acima já registra.
     */
    const sufixo = (inbound.phoneE164 ?? "").split("@")[1] ?? "sem_arroba";
    await logEvent({
      kind: "ayla_identificador_nao_telefone",
      severity: "error",
      message: `inbound com identificador que não é telefone (${sufixo}) — família fica sem resposta`,
      payload: { chave, sufixo, digitos: (inbound.phoneE164 ?? "").replace(/\D/g, "").length },
    }).catch(() => {});
    return { registrado: true, respondido: false, motivo: "nao_e_pessoal" };
  }

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
