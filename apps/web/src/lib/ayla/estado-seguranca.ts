import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";

/**
 * QUANDO A SEGURANÇA FICA ABERTA ENTRE UMA MENSAGEM E A SEGUINTE.
 *
 * Caso real (03/08/2026). Uma mãe relatou que a filha de 13 anos tinha tentado
 * suicídio e voltado a usar substância. A Ayla acertou o primeiro turno: parou
 * tudo, disse que era emergência de saúde, mandou avisar o especialista HOJE,
 * apontou o CAPS e o SAMU 192.
 *
 * E aí voltou a ser uma conversa comum.
 *
 * Cinco minutos depois estava organizando a rotina da casa em blocos. As 13
 * mensagens seguintes saíram todas com `tipo = "resposta_registro"` — o mesmo
 * tipo de qualquer conversa. SAMU e CAPS apareceram UMA vez e nunca mais.
 *
 * A causa não era o prompt: o PISO estava certo e foi obedecido. A causa é que
 * NÃO EXISTIA ESTADO. Cada mensagem reentrava no orquestrador do zero, e o
 * julgamento era feito só sobre o turno atual.
 *
 * Aqui o estado é INFERIDO DO HISTÓRICO, como `rotinaConversaPendente` já fazia
 * pra rotina — sem tabela nova, sem coluna nova, sem uma segunda Ayla. O que
 * marca é o `tipo` da mensagem que sai.
 */

/**
 * JANELA: 12 HORAS.
 *
 * Por quê não menos: a conversa da Adelly durou 35 minutos em fragmentos, e o
 * histórico que vai pro modelo são 6 turnos — nessa conversa, uns 4 minutos.
 * Qualquer janela curta perde a crise no meio dela mesma.
 *
 * Por quê não mais: uma situação de risco que passou de um dia é outra
 * conversa, e manter o bloqueio de artefatos indefinidamente puniria a família
 * pelo pior dia dela. Depois de 12h o estado não some em silêncio — o próximo
 * contato CHECA como ficou (ver `precisaChecar`), e só então libera o fluxo.
 */
const JANELA_MS = 12 * 60 * 60 * 1000;

/** Depois disto, mesmo aberto, o estado vira "cheque antes de liberar". */
const CHECAGEM_APOS_MS = 6 * 60 * 60 * 1000;

export type EstadoSeguranca = {
  /** Há situação de risco aberta. Bloqueia artefatos e prioriza a condução. */
  aberta: boolean;
  /** Quando a segurança foi acionada. */
  desde: string | null;
  /** Passou tempo demais: o próximo turno confirma antes de liberar. */
  precisaChecar: boolean;
};

const FECHADO: EstadoSeguranca = { aberta: false, desde: null, precisaChecar: false };

/**
 * O ATO DE ORIENTAR EMERGÊNCIA — é isto que a resposta faz quando o PISO
 * aciona. Determinístico de propósito: não é o gatilho sozinho (menção
 * histórica também cita CVV), é a primeira das duas condições.
 */
export function respostaOrientouEmergencia(texto: string): boolean {
  const t = (texto ?? "").toLowerCase();
  return (
    /\bcvv\b|\b188\b/.test(t) ||
    /\bsamu\b|\b192\b/.test(t) ||
    /\bcaps\b/.test(t) ||
    /pronto.?socorro|emerg[êe]ncia (m[ée]dica|de sa[úu]de)/.test(t)
  );
}

/**
 * TRIAGEM NA ENTRADA — só para quem o gate de acesso vai barrar.
 *
 * ⚠️ POR QUE ISTO PRECISOU EXISTIR (PEND-071, 15/08/2026). A detecção normal de
 * risco é EMERGENTE: `respostaOrientouEmergencia` olha a RESPOSTA já gerada, e
 * `riscoEhAtual` só roda depois dela. Isso funciona para quem tem acesso — e não
 * alcança quem o gate de assinatura barrou antes de existir resposta. Uma mãe
 * com o teste vencido escrevendo no meio de uma crise recebia "seu período
 * grátis acabou, é só assinar aqui", ou silêncio dentro do cooldown de 12h.
 *
 * ⚠️ ESTA FUNÇÃO NÃO SUBSTITUI NADA. Quem tem acesso continua pelo caminho de
 * sempre, com o classificador. Aqui é o piso de quem não tem — e o piso não
 * entrega serviço: entrega encaminhamento.
 *
 * ⚠️ NARROW DE PROPÓSITO, ao contrário de `riscoEhAtual`. Lá, "na dúvida
 * responda true" custa manter prioridade por mais tempo. Aqui um falso positivo
 * manda CVV e SAMU para quem perguntou sobre cobrança — assustar uma família
 * que não está em crise é dano real. Então: termos inequívocos, e o que escapar
 * cai no comportamento de hoje, que é o convite. Perder um caso é ruim; hoje
 * perdemos TODOS.
 */
const RISCO_INEQUIVOCO: RegExp[] = [
  /\bse\s+mat(ar|ou|ando)\b|\bme\s+mat(ar|o)\b|\bmatar\s+(ela|ele|meu filho|minha filha|a gente)\b/i,
  /\bsuic[íi]d/i,
  /\btirar\s+a\s+(pr[óo]pria\s+)?vida\b/i,
  /\bnão\s+quero\s+mais\s+viver\b|\bnao\s+quero\s+mais\s+viver\b/i,
  /\bnão\s+aguento\s+mais\s+viver\b|\bnao\s+aguento\s+mais\s+viver\b/i,
  /\bautomutila|\bse\s+cort(ar|ou|ando)\b|\bse\s+machuc(ar|ou|ando)\s+de\s+prop[óo]sito\b/i,
  /\btentou\s+(se\s+)?(matar|suic)/i,
  /\boverdose\b/i,
];

/**
 * A MENSAGEM, SOZINHA, JÁ PEDE ENCAMINHAMENTO DE EMERGÊNCIA?
 *
 * Determinística e sem IA — roda antes do gate, em toda mensagem de família
 * sem acesso, e não pode custar uma chamada de modelo por cobrança recebida.
 */
export function mensagemPedeSeguranca(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false;
  return RISCO_INEQUIVOCO.some((re) => re.test(t));
}

/**
 * O TEXTO QUE VAI PARA QUEM O GATE BARROU E ESTÁ EM RISCO.
 *
 * ⚠️ NÃO É ORIENTAÇÃO PARENTAL, e a diferença importa: não há estratégia, plano,
 * rotina nem análise. É acolhimento curto e encaminhamento — exatamente o que
 * não pode depender de assinatura. O convite comercial NÃO vai junto: cobrar no
 * meio disto seria pior do que o silêncio que isto corrige.
 */
export function textoSegurancaSemAcesso(nomeMae: string | null): string {
  const ola = nomeMae?.trim() ? `${nomeMae.trim()}, ` : "";
  return `${ola}eu li o que você escreveu, e isso é mais importante que qualquer outra coisa agora. 💛

Se houver risco à vida neste momento, ligue **192 (SAMU)**. Para falar com alguém agora, o **CVV atende 24h no 188** — ligação gratuita. E o **CAPS** da sua região faz acolhimento em crise, sem agendamento.

Por favor, não fique sozinha com isso. Procure um desses agora, ou alguém de confiança que possa ficar com você.`;
}

const SYSTEM_RISCO = `Você decide se uma conversa tem RISCO ATUAL à vida ou à integridade de alguém, ou se o assunto é histórico/hipotético.

RISCO ATUAL — a pessoa está em perigo AGORA ou nos próximos dias:
- tentativa recente, ideação presente, automutilação acontecendo;
- uso de substância em curso com risco;
- violência acontecendo;
- adulto dizendo que não aguenta mais viver.

NÃO É RISCO ATUAL:
- fato do passado com a pessoa estável hoje ("tentou há 5 anos, hoje está bem e acompanhada");
- assunto genérico (palestra na escola, campanha, notícia);
- desabafo pesado sem indício de perigo imediato;
- frase dramática que o próprio contexto já esclarece como segura.

Responda APENAS JSON: {"atual":true|false,"motivo":"uma frase curta"}
Na dúvida entre atual e histórico, responda true: subestimar risco é o erro caro.`;

/**
 * A SEGUNDA CONDIÇÃO. O texto orientar emergência não basta — a Ayla cita CVV
 * também ao falar de um fato passado. Quem separa "aconteceu agora" de
 * "aconteceu há cinco anos" é isto.
 *
 * Só roda quando `respostaOrientouEmergencia` já deu true, então o custo é
 * praticamente zero na conversa normal.
 */
export async function riscoEhAtual(params: {
  mensagem: string;
  conversa: string;
}): Promise<{ atual: boolean; motivo: string }> {
  try {
    const client = getAylaAnthropicClient();
    const r = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 120,
      system: SYSTEM_RISCO,
      messages: [
        {
          role: "user",
          content: `CONVERSA RECENTE:\n${params.conversa.slice(0, 3000)}\n\nMENSAGEM DE AGORA:\n"${params.mensagem.slice(0, 800)}"\n\nDecisão:`,
        },
      ],
    });
    const b = r.content[0];
    const m = (b?.type === "text" ? b.text : "").match(/\{[\s\S]*\}/);
    if (!m) return { atual: true, motivo: "sem JSON — assume atual" };
    const o = JSON.parse(m[0]) as { atual?: unknown; motivo?: unknown };
    return {
      atual: o.atual !== false,
      motivo: typeof o.motivo === "string" ? o.motivo : "-",
    };
  } catch {
    // Falha do classificador NÃO pode virar "sem risco".
    return { atual: true, motivo: "falha na avaliação — assume atual" };
  }
}

/**
 * HÁ SITUAÇÃO DE SEGURANÇA ABERTA?
 *
 * Aberta = existe uma outbound `seguranca` na janela, e nenhuma
 * `seguranca_encerrada` depois dela. Mesmo padrão de
 * `rotinaConversaPendente` — o estado é o histórico.
 */
export async function segurancaAberta(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date = new Date(),
): Promise<EstadoSeguranca> {
  try {
    const desde = new Date(agora.getTime() - JANELA_MS).toISOString();
    const { data } = await supabase
      .from("ayla_messages")
      .select("tipo, created_at")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .in("tipo", ["seguranca", "seguranca_encerrada"])
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(1);

    const ultima = data?.[0];
    if (!ultima || ultima.tipo !== "seguranca") return FECHADO;

    const quando = new Date(ultima.created_at as string);
    return {
      aberta: true,
      desde: ultima.created_at as string,
      precisaChecar: agora.getTime() - quando.getTime() > CHECAGEM_APOS_MS,
    };
  } catch {
    // Sem saber, NÃO assume aberta: travar artefatos de todas as famílias por
    // uma falha de consulta seria pior que o problema.
    return FECHADO;
  }
}

const SYSTEM_ENCERRAR = `Você decide se uma situação de RISCO À VIDA pode ser considerada ENCAMINHADA.

ENCAMINHADA (true) quando a família diz claramente que:
- conseguiu falar com o profissional, serviço ou emergência;
- a pessoa está sendo atendida, internada ou acompanhada agora;
- o atendimento foi marcado e a pessoa está segura até lá.

NÃO ENCAMINHADA (false) — e aqui está o erro que não pode acontecer:
- mudar de assunto NÃO encerra;
- falar da casa, da escola, do dia a dia, de medicação NÃO encerra;
- mensagem fragmentada, curta ou confusa NÃO encerra;
- responder outra pergunta NÃO encerra;
- silêncio NÃO encerra;
- "vou ver isso depois" NÃO encerra.

Responda APENAS JSON: {"encaminhada":true|false,"motivo":"uma frase curta"}
Na dúvida, responda false. Manter a prioridade por mais tempo custa pouco; soltar cedo demais custa muito.`;

/** A família confirmou que conseguiu atendimento? Só isso encerra. */
export async function segurancaFoiEncaminhada(params: {
  mensagem: string;
  conversa: string;
}): Promise<{ encaminhada: boolean; motivo: string }> {
  try {
    const client = getAylaAnthropicClient();
    const r = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 120,
      system: SYSTEM_ENCERRAR,
      messages: [
        {
          role: "user",
          content: `CONVERSA RECENTE:\n${params.conversa.slice(0, 3000)}\n\nMENSAGEM DE AGORA:\n"${params.mensagem.slice(0, 800)}"\n\nDecisão:`,
        },
      ],
    });
    const b = r.content[0];
    const m = (b?.type === "text" ? b.text : "").match(/\{[\s\S]*\}/);
    if (!m) return { encaminhada: false, motivo: "sem JSON" };
    const o = JSON.parse(m[0]) as { encaminhada?: unknown; motivo?: unknown };
    return {
      encaminhada: o.encaminhada === true,
      motivo: typeof o.motivo === "string" ? o.motivo : "-",
    };
  } catch {
    return { encaminhada: false, motivo: "falha na avaliação" };
  }
}

/**
 * A NOTA DO TURNO enquanto a segurança está aberta.
 *
 * Mantém PRIORIDADE, não repete texto. A orientação de emergência volta quando
 * for necessária pro próximo passo — não a cada mensagem, que viraria ruído e
 * faria a mãe parar de ler.
 */
export function notaDeSeguranca(params: { precisaChecar: boolean }): string {
  return [
    "# SITUAÇÃO DE SEGURANÇA ABERTA (prevalece sobre todo o resto)",
    "",
    "Nesta conversa há um risco à vida ou à integridade que AINDA NÃO foi encaminhado. Isso continua sendo a prioridade, mesmo que esta mensagem fale de outra coisa — casa, escola, medicação, desabafo. Mudar de assunto não resolve o risco.",
    "",
    "O QUE FAZER NESTE TURNO: responda o que ela trouxe, com acolhimento e em poucas linhas, e volte ao próximo passo concreto da segurança — se ela conseguiu falar com alguém, e se não, o que dá pra fazer agora. Ajude a EXECUTAR esse passo (escrever a mensagem pro profissional, achar o serviço, decidir quem liga).",
    "",
    "NÃO FAÇA AQUI: investigação longa de comportamento, análise da rotina da casa, plano, rotina, atividades, brincadeiras, explicações amplas de desenvolvimento. Nada disso é urgente agora, e ocupa o lugar do que é.",
    "",
    "SOBRE REPETIR A EMERGÊNCIA: você já orientou onde buscar ajuda. Repita CVV/SAMU/CAPS só se houver nova indicação de risco, se ela ainda não conseguiu ajuda, ou se for necessário pro próximo passo. Se ela está tentando executar, acompanhe a execução em vez de repetir.",
    "",
    "NÃO AVALIE A SUFICIÊNCIA DO TRATAMENTO dela. É proibido dizer que o que ela tem \"é muito menos do que ela precisa\" ou equivalente — isso é julgamento clínico e não é seu. Diga o que é seu: que o profissional precisa saber o que mudou.",
    "",
    "MEDICAÇÃO continua fora do seu alcance, com mais força ainda aqui. Não sugira qual começar, qual é mais fácil, nem como ajustar. A pergunta que você ajuda a mãe a fazer é neutra: contar que ela não está tomando o que foi prescrito e pedir orientação de como proceder.",
    params.precisaChecar
      ? '\nJÁ PASSARAM ALGUMAS HORAS: antes de seguir a conversa normalmente, confirme em UMA pergunta curta como ficou a situação de risco ("conseguiu falar com alguém sobre a Adelly?"). Só depois amplie.'
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
