/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  AYLA OFICIAL DE PRODUÇÃO — É ESTE ARQUIVO QUE ATENDE AS FAMÍLIAS.       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ O NOME "EXPERIMENTAL" MENTE, E JÁ CUSTOU CARO. Desde 23/08/2026, com
 * `AYLA_EXPERIMENTAL_TODAS=true` no ambiente, **100% das conversas passam por
 * aqui**. PROVEI POR EXECUÇÃO em 28/08: `/api/health` devolve
 * `ayla_experimental_todas: true`.
 *
 * O arquivo se chama `experimental.ts` por razões históricas — ele nasceu como
 * o caminho novo, atrás de flag, para poucas famílias. Renomeá-lo hoje tocaria
 * importações, testes que leem o próprio código-fonte por caminho, e a
 * variável de ambiente — que, se renomeada por engano, **desliga a Ayla de
 * todas as famílias no turno seguinte**. Por isso o nome fica, e este
 * cabeçalho existe no lugar da renomeação.
 *
 * ⚠️ TODA MUDANÇA DE CONDUTA DA AYLA PASSA POR AQUI. Se você está corrigindo
 * como a Ayla responde, decide, pergunta ou orienta, o lugar é ESTE arquivo.
 * `responder.ts` é o LEGACY, e MEDI que ele atende **2,59%** dos turnos.
 *
 * ⚠️ ISTO JÁ DEU ERRADO TRÊS VEZES, e não são hipóteses:
 *   · 22/08 — a correção comercial foi só para `responder.ts`. Alcançava um
 *     turno em quarenta. `git log -S "FATOS_COMERCIAIS" -- experimental.ts`
 *     voltava VAZIO;
 *   · 26/08 — o D7 foi corrigido no template proativo e a conversa reativa
 *     continuou mandando `/precos` por mais um dia;
 *   · 27/08 — Karina escreveu "quero pagar, quero assinar" e recebeu a página
 *     que vende o teste, porque a regra vivia em dois arquivos.
 *
 * ⚠️ E HÁ UM SINAL QUE ENGANA QUEM CHEGA: `responder.ts` é importado por 8
 * arquivos; este, por 1. A contagem de importações sugere o contrário do que é
 * verdade. Não se guie por ela.
 *
 * Quando o Legacy for removido, este arquivo passa a se chamar `ayla.ts` e
 * este cabeçalho some junto. Até lá, ele é a placa na porta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { idadeAnos } from "@/lib/idade";
import { gerarConversacional, MODELO_CONVERSA } from "@/lib/ia/provider";
import { apurarEstadoDoTurno, blocoDeEstado } from "@/lib/conducao/estado-do-turno";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import {
  formaAtravessada,
  ehMenuDeAlternativas,
  naturezaDoTurno,
  perguntasReais,
  modoForma,
} from "@/lib/conducao/fronteiras-forma";
import { comRetentativaCurta } from "@/lib/conducao/retentativa";
import { logEvent } from "@/lib/log";
import {
  FORMATO_WHATSAPP,
  formasDeEntrega,
  pedeEntregaEstruturada,
  INTERESSE_COMO_VEICULO,
  A_CRIANCA_ANTES_DO_ROTULO,
  IDIOMA_DA_CONVERSA,
  notaDeProporcao,
} from "@/lib/conducao/formas";
import { FATOS_COMERCIAIS } from "@/lib/billing/fatos-comerciais";
import {
  ehPerguntaComercial,
  precisaDeHumano,
  notaComercial,
  notaSuporte,
} from "@/lib/billing/destino-comercial";
import { linkComercialAutenticado } from "@/lib/billing/link-comercial";
import { logarUsoApi } from "@/lib/billing/logar";
import { resolverDocumento } from "./documentos";
import {
  montarContextoBase,
  lerPerfilVivo,
  pareceInformacao,
  lerPerfilFamilia,
  blocoDaFamilia,
  rotulosConhecidos,
  fatosDisponiveis,
  interessesAtuais,
} from "./experimental-contexto";
import { pronomesPara, type Genero } from "./pronomes";
import { resolverFoco, blocoDeFoco, type Foco } from "./experimental-foco";
import { lerEventos, eventosRelevantes, blocoDeEventos } from "./experimental-memoria";
import { recuperarBoasPraticas, blocoBoasPraticas } from "@/lib/conhecimento/recuperar";
import { lerEstadoTrial } from "@/lib/trial/estado";
import { blocoDeContinuidade } from "@/lib/conducao/continuidade";
import {
  blocoDaJornada,
  lerEvidenciasJornada,
  EVIDENCIAS_VAZIAS,
  DIAS_DE_FECHAMENTO,
  blocoPosTrial,
  nivelDeEvidencia,
} from "@/lib/trial/jornada";

/**
 * A AYLA EXPERIMENTAL — uma porta AO LADO da Ayla atual, 15/08/2026.
 *
 * ⚠️ O QUE ISTO É, E O QUE NÃO É. Não é migração, não é refatoração e não
 * substitui nada. A Ayla atual continua inteira, intocada, e é o CONTROLE. Este
 * módulo existe para responder uma pergunta só:
 *
 *   "Como fica a experiência se a conversa passar direto por um prompt novo,
 *    curto, com o contexto essencial da criança e o histórico recente?"
 *
 * ⚠️ O CAMINHO É CURTO DE PROPÓSITO. Passar pela arquitetura atual e só trocar
 * o prompt no fim não testaria hipótese nenhuma — testaria o prompt dentro da
 * mesma condução. Aqui o turno PULA `classificarIntencao`, `parseInbound`, a
 * cascata de portões conversacionais, o núcleo de `diretrizes.ts`, as lentes e
 * a recuperação de Boas Práticas. O que ele pula está medido no relatório.
 *
 * ⚠️ O QUE **NÃO** É PULADO, e não pode ser: identidade da família, acesso,
 * idempotência do inbound, isolamento entre famílias e a REDE DE FRONTEIRAS na
 * saída. O streaming ingênuo não volta — a inspeção precisa do texto inteiro
 * em memória, e é por isso que ela existe.
 */

/**
 * QUEM ENTRA — allowlist explícita por `family_account_id`.
 *
 * ⚠️ FAIL CLOSED, e o formato é o mesmo de `familiasDeTeste()` em
 * `provider.ts`: variável ausente, vazia, id fora da lista, id não-string ou
 * qualquer erro → **false**, ou seja, Ayla atual. Nenhuma família entra por
 * inferência, por texto da mensagem, por nome ou por regex.
 *
 * A lista vazia significa "ninguém", nunca "todo mundo" — é o mesmo cuidado
 * documentado no seletor de provider: a variável não pode ser o que SEGURA o
 * rollout, senão apagá-la por engano promove todas as famílias.
 */
export function familiasExperimentais(): string[] {
  try {
    return (process.env.AYLA_EXPERIMENTAL_FAMILY_IDS ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * A LIBERAÇÃO GERAL — uma chave PRÓPRIA, e não a ausência da allowlist.
 *
 * ⚠️ POR QUE NÃO REUSAR A LISTA. O comentário acima é explícito: lista vazia
 * significa "ninguém", nunca "todo mundo", justamente para que apagar a
 * variável por engano não promova as 202 famílias de uma vez. Transformar
 * "lista vazia" em "todos" inverteria essa proteção — o erro mais barato de
 * cometer viraria o mais caro.
 *
 * Então a liberação geral é um SIM explícito, escrito à mão, e só os valores
 * `1` e `true` valem. Qualquer outra coisa — vazio, `0`, `sim`, um espaço, um
 * erro de digitação — é **false**, e a família continua na Ayla atual.
 *
 * ROLLBACK: apagar esta variável no ambiente. Volta todo mundo para o caminho
 * atual no turno seguinte, sem deploy de código.
 */
export function experimentalParaTodas(): boolean {
  try {
    const v = (process.env.AYLA_EXPERIMENTAL_TODAS ?? "").trim().toLowerCase();
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

/**
 * O MODO PÓS-TRIAL ESTÁ LIGADO? — `AYLA_POS_TRIAL`, 18/08/2026.
 *
 * ⚠️ DEFAULT DESLIGADO, e o desligado é o comportamento de hoje byte a byte:
 * convite fixo na primeira mensagem em 12h, silêncio depois. Mesmo formato de
 * `experimentalParaTodas` — um SIM explícito, escrito à mão, e só `1`/`true`
 * valem. Erro de digitação, vazio ou exceção ao ler NUNCA liga.
 *
 * ROLLBACK: apagar a variável no ambiente. Vale no turno seguinte, sem deploy.
 *
 * ⚠️ Enquanto isto estiver desligado, a campanha de recuperação NÃO pode ser
 * disparada: convidar a responder e devolver silêncio é pior que não convidar.
 */
export function posTrialAtivo(): boolean {
  try {
    const v = (process.env.AYLA_POS_TRIAL ?? "").trim().toLowerCase();
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

/**
 * Esta família conversa com a Ayla experimental?
 *
 * ⚠️ O QUE ESTE PORTÃO NÃO DECIDE — e é o que torna a liberação geral segura.
 * Ele roda DEPOIS do gate de acesso, da segurança, da identificação da família
 * e da criança e da idempotência do inbound (a descida C2, 15/08/2026). Abrir
 * este portão para todas não afrouxa nenhum dos anteriores: quem não tem
 * acesso continua sem acesso, e a crise continua vindo antes da cobrança.
 */
export function ehFamiliaExperimental(familyAccountId?: string | null): boolean {
  try {
    const id = typeof familyAccountId === "string" ? familyAccountId.trim() : "";
    if (!id) return false;
    // A família precisa existir de qualquer forma: id vazio nunca entra, nem
    // na liberação geral. O resto do turno depende de saber de quem se trata.
    if (experimentalParaTodas()) return true;
    return familiasExperimentais().includes(id);
  } catch {
    // Erro ao ler configuração NUNCA manda família real para o experimento.
    return false;
  }
}

type Membro = {
  id: string;
  nome: string | null;
  data_nascimento: string | null;
  perfil: string | null;
  diagnosticos_formais: string | null;
  /** Usado por `resolverFoco` para entender "minha filha" / "meu filho". */
  genero: string | null;
};

/** Uma fala do histórico, já com o dono resolvido. */
type Fala = { direcao: string; texto: string | null; membro_atipico_id: string | null };

export type TurnoExperimental = {
  texto: string;
  membroId: string | null;
  /** Medição do turno — ver `ayla_path` no relatório da PEND-064. */
  metrica: {
    consultasBanco: number;
    chamadasLLM: number;
    tokensEntrada: number;
    tokensSaida: number;
    msContexto: number;
    msModelo: number;
    msInspecao: number;
    msTotal: number;
    modelo: string;
    provider: string;
    fronteiraBarrou: boolean;
    foco: string;
    /** `admin` = documento publicado; `fallback` = Core do código. */
    coreOrigem: "admin" | "fallback";
    coreVersao: number | null;
    /**
     * ⚠️ AS TRÊS CAMADAS DO ACERVO, SEPARADAS DE PROPÓSITO.
     *
     * RECUPERAR ≠ INJETAR ≠ USAR, e confundir as três foi exatamente o erro da
     * auditoria de 30/07 — ela concluiu coisas sobre o acervo olhando o código,
     * não o prompt final. Aqui:
     *
     *   `bpRecuperadas` .. quantas o banco devolveu;
     *   `bpInjetadas` .... quantas entraram no system que foi ao modelo;
     *   `bpChars` ........ quanto o bloco engordou o prompt;
     *   `msBp` ........... quanto a consulta custou.
     *
     * A quarta camada — se a Ayla USOU — não se mede aqui: é julgamento sobre a
     * resposta, e é trabalho da bancada, nunca do runtime.
     */
    bpRecuperadas: number;
    bpInjetadas: number;
    bpChars: number;
    msBp: number;
    /** O dia do teste que a Ayla enxergava neste turno — null fora da jornada. */
    jornada_dia?: number | null;
    /** Este turno pôde cumprir função comercial (D4–D7)? */
    jornada_fechamento?: boolean;
    /** Quanto o bloco da jornada engordou o prompt. Zero = não entrou. */
    jornada_chars?: number;
    /** Quanto o documento do Trial engordou o prompt. Zero = não entrou. */
    trial_doc_chars?: number;
    /** `normal` ou `pos_trial` — o rastro que prova o modo em produção. */
    modo?: ModoTurno;
    /** Quanto o bloco pós-Trial engordou o prompt. Zero = não entrou. */
    pos_trial_chars?: number;
    /** A/B/C por evidência. `null` fora do pós-Trial. */
    pos_trial_nivel?: "A" | "B" | "C" | null;
    /** Quantos fatos de perfil existiam. `null` fora do pós-Trial. */
    pos_trial_fatos?: number | null;
    /** `off` | `sombra` | `ativo` — em que modo a rede de forma rodou. */
    forma_modo?: "off" | "sombra" | "ativo";
    /** Nome da fronteira de forma que disparou, ou `null` se nenhuma. */
    forma_disparou?: string | null;
    /**
     * ⚠️ O QUE `msBp` ERA E O QUE ELE É — 26/08/2026.
     *
     * Era o tempo do `Promise.all` inteiro (seis operações), ou seja, a mais
     * lenta delas. Passou a ser só a recuperação de repertório. `msParalelo`
     * carrega o significado antigo, para a série histórica não quebrar.
     */
    msParalelo?: number;
    /** `montarContexto` sozinho — a operação mais pesada do bloco paralelo. */
    msCtx?: number;
    /** Leitura do documento `core` (16-21 KB de texto). */
    msCore?: number;
    /** Estado + evidências + documento do Trial, somados. */
    msTrial?: number;
    /** As três ondas SEQUENCIAIS de `montarContexto`, separadas. */
    msOnda1?: number;
    msFoco?: number;
    msOnda3?: number;
  };
};

/**
 * O CONTEXTO ESSENCIAL — pequeno de propósito.
 *
 * ⚠️ NÃO é o Kolo Vivo inteiro. A instrução foi começar pequeno: nome de quem
 * cuida, nome e idade da criança, o que o perfil já diz dela, diagnóstico
 * registrado (que a rede de fronteiras também lê) e o histórico recente. Se
 * faltar alguma coisa que importe, isso vira ACHADO do experimento — não
 * motivo para carregar tudo "por precaução".
 */
/**
 * Um turno da conversa TEMPORÁRIA do simulador — existe só na memória do
 * navegador do Admin e no corpo desta requisição.
 *
 * ⚠️ NUNCA É PERSISTIDO. Não entra em `ayla_messages`, nem em `conversas`, nem
 * na memória, nem nos eventos. A sessão de QA morre quando a aba fecha. É por
 * isso que ela pode existir: um histórico de teste gravado no histórico real
 * contaminaria a família de QA para sempre — e a Ayla leria aquilo como se a
 * mãe tivesse dito.
 */
export type TurnoSimulado = { quem: "mae" | "ayla"; texto: string };

/**
 * POR QUE O TURNO NÃO PRODUZIU RESPOSTA.
 *
 * Nomes estáveis, para a tela de QA e para o log. `null` sozinho nunca disse
 * qual dos caminhos foi — e "resposta vazia, fronteira barrou, ou a família
 * não tem contexto", numa frase só, é um diagnóstico que não diagnostica.
 */
export type MotivoFalha =
  | "LLM_RESPOSTA_VAZIA"
  | "FRONTEIRA_BARROU"
  | "EXCECAO";

/**
 * O MODO DO TURNO — 18/08/2026, Onda 1.
 *
 * `pos_trial` NÃO é uma segunda Ayla: é a mesma conversa com o objetivo mudado e
 * com os produtores desligados. O que muda aqui dentro é só o CONTEXTO — entra
 * quem é a criança e os RÓTULOS do que sabemos; não entra o conteúdo dos
 * domínios, que é a matéria-prima de uma orientação nova.
 */
export type ModoTurno = "normal" | "pos_trial";

/**
 * O que `montarContexto` devolve.
 *
 * ⚠️ TIPO NOMEADO, E NÃO INLINE. Um objeto inline aqui fecha com `}` na coluna
 * zero, e `experimental.test.ts` recorta o CORPO da função pelo primeiro `\n}`
 * para conferir que toda consulta tem `.eq("family_account_id", familyId)` — o
 * recorte que impede vazamento entre famílias. Com o tipo inline, o corpo
 * medido virava a assinatura, o teste encontrava zero consultas e a proteção
 * passava a valer nada sem ninguém perceber.
 */
type ContextoDoTurno = {
  bloco: string;
  foco: Foco;
  diagnosticoRegistrado: string;
  consultas: number;
  /** Só no `pos_trial`: os assuntos sobre os quais existe informação. */
  rotulos: string[];
  /** Só no `pos_trial`: quantos fatos existem — decide o nível de linguagem. */
  fatos: number;
  /** Só no `pos_trial`: a criança em foco, para o bloco falar dela pelo nome. */
  nomeCrianca: string | null;
  /**
   * A IDADE DA CRIANÇA EM FOCO — para o filtro etário do repertório (PEND-163).
   *
   * ⚠️ `null` QUANDO NÃO HÁ UMA SÓ CRIANÇA EM FOCO. Com dois irmãos no turno não
   * existe "a idade": filtrar pela de um entregaria material impróprio para o
   * outro. `null` mantém o comportamento antigo (nenhum filtro) só nesse caso,
   * que hoje alcança 3 famílias — a trava de uma criança vale desde 08/08.
   */
  idadeFoco: number | null;
  /**
   * ESTA CONVERSA JÁ PRODUZIU ALGUMA AJUDA? — 26/08/2026, rede de forma.
   *
   * ⚠️ NÃO É "a conversa é longa". É "a família já recebeu algo aplicável". A
   * distinção decide duas coisas na rede de forma: se um menu é condução
   * legítima ou interrogatório (MEDI um caso real com SETE menus antes da
   * primeira orientação), e se uma mensagem de três palavras é um cumprimento
   * ou a continuação de um assunto que já está em pé.
   *
   * O sinal é determinístico e barato: uma fala anterior da Ayla, com corpo, que
   * não seja ela própria um menu. Sem modelo, sem consulta nova — o histórico já
   * está lido para montar `<conversa_recente>`.
   */
  jaHouveOrientacao: boolean;
  /**
   * ONDE O TEMPO DE `montarContexto` FOI GASTO — 26/08/2026.
   *
   * ⚠️ A INSTRUMENTAÇÃO ANTERIOR MENTIA, e custou uma conclusão errada. `msBp`
   * era medido em volta do `Promise.all` de SEIS operações e devolvia a mais
   * lenta delas — não o tempo das Boas Práticas. Como `msContexto` era medido
   * de `t0`, poucas linhas de código síncrono antes, os dois davam o mesmo
   * número em 98% dos turnos, e a leitura natural ("as BPs dominam o contexto")
   * era falsa.
   *
   * `montarContexto` faz TRÊS ondas em série. Medir cada uma é o que permite
   * dizer se achatá-las vale a pena — MEDI 1.799 ms em série contra 1.296 ms
   * com as sete consultas num `Promise.all` só.
   */
  msOndas: { onda1: number; foco: number; onda3: number };
};

async function montarContexto(
  supabase: SupabaseClient,
  familyId: string,
  mensagem: string,
  simulados: readonly TurnoSimulado[] = [],
  modo: ModoTurno = "normal",
  skills: readonly string[] = [],
): Promise<ContextoDoTurno> {
  // As três leituras de abertura não dependem uma da outra: vão juntas.
  // ⚠️ `lerPerfilFamilia` SUBIU PARA A ONDA 1 — 26/08/2026, quick win 3.
  //
  // Ela não depende de nada: só do `familyId`, que o turno já tem. Estava na
  // onda 3, atrás de `resolverFoco`, esperando uma resolução de criança que não
  // lhe diz respeito.
  //
  // ⚠️ O GANHO É PEQUENO, e digo o número para não vender o que não entrego:
  // MEDI 300 ms para esta consulta e 529 ms para a onda 3 inteira — ela não é a
  // mais lenta do grupo, então sair de lá economiza dezenas de ms, não centenas.
  // As outras duas da onda 3 (`lerPerfilVivo` e `lerEventos`) dependem DE FATO
  // do foco resolvido, e nenhuma reorganização honesta as sobe junto.
  //
  // A emulação que sugeriu 1.799 ms → 1.296 ms colocava as sete consultas num
  // `Promise.all` só, ignorando as dependências. Esse número era um teto
  // teórico, não uma promessa.
  const tOnda1 = Date.now();
  const [{ data: perfilFamilia }, { data: membros }, { data: falas }, perfilDaFamilia] =
    await Promise.all([
    supabase
      .from("family_profiles")
      .select("nome_mae, como_chamar")
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento, perfil, diagnosticos_formais, genero")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("ayla_messages")
      .select("direcao, texto, membro_atipico_id")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(12),
    // Só depende de `familyId` — nada aqui espera a criança ser resolvida.
    lerPerfilFamilia(supabase, familyId),
  ]);

  const lista = (membros ?? []) as Membro[];
  const msOnda1 = Date.now() - tOnda1;

  const tFoco = Date.now();
  const foco = await resolverFoco(supabase, familyId, mensagem, lista);
  const msFoco = Date.now() - tFoco;
  const emFoco = foco.membros;

  // Perfil Vivo, trajetória e perfil da FAMÍLIA — também em paralelo.
  //
  // ⚠️ O PERFIL DA FAMÍLIA ENTROU EM 15/08/2026. "Somos só eu e ela", "trabalho
  // em turno", "moramos com a avó" mudam a orientação tanto quanto uma
  // característica da criança: uma estratégia que depende de dois adultos é
  // inútil para quem cria sozinha. O Legacy já lia isto; era a última lacuna
  // real de contexto do caminho novo.
  const tOnda3 = Date.now();
  const [perfis, eventos] = await Promise.all([
    Promise.all(emFoco.map((m) => lerPerfilVivo(supabase, m.id))),
    lerEventos(supabase, familyId, emFoco.map((m) => m.id)),
  ]);
  const msOnda3 = Date.now() - tOnda3;

  const nomeResponsavelBruto =
    (perfilFamilia as { como_chamar?: string; nome_mae?: string } | null)?.como_chamar ||
    (perfilFamilia as { nome_mae?: string } | null)?.nome_mae ||
    null;
  const nomeResponsavel = pareceInformacao(nomeResponsavelBruto) ? nomeResponsavelBruto : null;

  // ⚠️ UM RETRATO POR CRIANÇA EM FOCO. No foco compartilhado são dois blocos
  // separados, cada um com o nome na frente — é isso que permite "uma
  // brincadeira para os dois" sem que a característica de um vire fato do outro.
  const retratos: string[] = [];
  const lacunas = new Set<string>();
  // ⚠️ NO PÓS-TRIAL O RETRATO É OUTRO. `montarContextoBase` monta o retrato
  // completo — desafios com texto, "como ela é", sensibilidades. É exatamente
  // esse conteúdo que permitiria montar uma estratégia nova, e é o que o teste
  // encerrado não paga mais. Aqui entra só identidade: quem é a criança.
  const rotulosPorMembro: string[] = [];
  let fatosDoTurno = 0;
  emFoco.forEach((m, i) => {
    const membroCompleto = lista.find((x) => x.id === m.id) ?? null;
    if (modo === "pos_trial") {
      const pv = perfis[i] ?? null;
      rotulosPorMembro.push(...rotulosConhecidos(pv));
      fatosDoTurno = Math.max(fatosDoTurno, fatosDisponiveis(pv));
      const idade = idadeAnos(membroCompleto?.data_nascimento ?? null);
      const p = pronomesPara(membroCompleto?.genero as Genero);
      const ident = [
        i === 0 && nomeResponsavel ? `Responsável: ${nomeResponsavel}` : "",
        `Criança: ${membroCompleto?.nome ?? "(sem nome)"}${idade != null ? `, ${idade} anos` : ""}`,
        p.generoDefinido ? `Como falar dela: ${p.sujeito}/${p.possessivo}` : "",
        interessesAtuais(pv).length ? `Interesses: ${interessesAtuais(pv).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      retratos.push(ident);
      return;
    }
    const base = montarContextoBase({
      nomeResponsavel: i === 0 ? nomeResponsavel : null,
      membro: membroCompleto,
      perfilVivo: perfis[i] ?? null,
      // O assunto do turno decide QUAL domínio ganha profundidade. Já veio do
      // classificador que rodou acima — nenhuma consulta, nenhum modelo novo.
      skills,
    });
    if (base.bloco) retratos.push(base.bloco);
    for (const l of base.lacunas) lacunas.add(l);
  });

  // ⚠️ O HISTÓRICO É ETIQUETADO, NÃO RECORTADO — mesma decisão de
  // `carregarHistorico` no legacy. Recortar mataria o multi-criança; deixar sem
  // dono foi o que produziu o caso Mario→Manu de 07/08/2026.
  const nomePorId = new Map(lista.map((m) => [m.id, m.nome ?? "?"]));
  const idsEmFoco = new Set(emFoco.map((m) => m.id));
  const historico = ((falas ?? []) as Fala[])
    .slice()
    .reverse()
    .filter((f) => (f.texto ?? "").trim())
    .map((f) => {
      const quem = f.direcao === "inbound" ? "Responsável" : "Ayla";
      const dono = f.membro_atipico_id;
      // Só etiqueta o que é de OUTRA criança: marcar a da vez em toda linha
      // vira ruído e ensina o modelo a repetir o nome.
      const sobre = dono && !idsEmFoco.has(dono) ? nomePorId.get(dono) : null;
      return sobre ? `${quem} (sobre ${sobre}): ${f.texto}` : `${quem}: ${f.texto}`;
    });

  // ⚠️ A CONVERSA DO SIMULADOR ENTRA AQUI, NO FIM — depois do histórico real e
  // ANTES do corte dos 10. É o que faz o turno 2 enxergar o turno 1, e é o que
  // faz a correção ("é a Manu, não o Mario") valer nos turnos seguintes: ela
  // vira uma linha do histórico como qualquer outra.
  //
  // Entra no MESMO formato do histórico real, de propósito: o modelo não deve
  // ter como distinguir teste de conversa, senão o teste para de testar.
  for (const t of simulados) {
    const texto = (t.texto ?? "").trim();
    if (texto) historico.push(`${t.quem === "mae" ? "Responsável" : "Ayla"}: ${texto}`);
  }

  const SEP = "\n\n";
  const NL = "\n";
  // ⚠️ O QUE SAI NO PÓS-TRIAL, E POR QUÊ CADA UM:
  //   · `<o_que_ainda_nao_sei>` .. é o convite a perguntar, e aqui não se
  //     investiga a criança;
  //   · perfil da FAMÍLIA ........ "moramos com a avó", "trabalho em turno" é
  //     insumo de estratégia — serve para adaptar orientação, que não haverá;
  //   · `<trajetoria>` ........... conteúdo datado da vida da criança, mesma razão.
  // Ficam identidade, foco e a conversa recente — sem eles a Ayla não sabe com
  // quem está falando nem o que acabou de ser dito.
  const partes =
    modo === "pos_trial"
      ? [
          retratos.length
            ? `<o_que_ja_sabemos>${NL}${retratos.join(SEP)}${NL}</o_que_ja_sabemos>`
            : "",
          blocoDeFoco(foco),
          historico.length
            ? `<conversa_recente>${NL}${historico.slice(-10).join(NL)}${NL}</conversa_recente>`
            : "",
        ]
      : [
          retratos.length
            ? `<o_que_ja_sabemos>${NL}${retratos.join(SEP)}${NL}</o_que_ja_sabemos>`
            : "",
          lacunas.size ? `<o_que_ainda_nao_sei>${[...lacunas].join(", ")}</o_que_ainda_nao_sei>` : "",
          blocoDeFoco(foco),
          // Depois do retrato da criança e antes da trajetória: a casa é contexto de
          // quem ela é, não um assunto próprio.
          blocoDaFamilia(perfilDaFamilia),
          blocoDeEventos(eventosRelevantes(eventos, mensagem)),
          historico.length
            ? `<conversa_recente>${NL}${historico.slice(-10).join(NL)}${NL}</conversa_recente>`
            : "",
        ];
  // ⚠️ A CONTINUIDADE VEM DEPOIS DO HISTÓRICO, E POR ISSO — 05/09/2026.
  //
  // O histórico chega ao modelo como prosa: "Ayla: … / Mãe: 3". Ler isso e
  // ligar o "3" à lista certa é justamente o que falhou com a Lucila, com a
  // Vanessa e com a Samara. Este bloco não decide nada; ele diz ao modelo o que
  // ele não conseguia ver sozinho — qual era a pergunta, quais eram as opções
  // e, quando a resposta é ambígua, que ela É ambígua.
  //
  // Nasce vazio no caso comum: só existe quando a família respondeu curto E há
  // algo pendente. Ver `lib/conducao/continuidade.ts`.
  const ultimaFalaDaAyla = ((falas ?? []) as Fala[]).find(
    (f) => f.direcao === "outbound" && (f.texto ?? "").trim(),
  )?.texto;
  const continuidade = blocoDeContinuidade({ ultimaAyla: ultimaFalaDaAyla, mensagem });

  // ── O ESTADO DO TURNO ────────────────────────────────────────────────────
  // ⚠️ FATOS QUE O MODELO NÃO CONSEGUIA VER — 06/09/2026. A auditoria mostrou
  // que a memória do produto era de dez linhas de prosa: plano em
  // acompanhamento, resultado dele e rotina esperando tema existiam no banco e
  // nunca chegavam ao prompt. Foi assim que "E agora?" da Karina virou "Sobre
  // quem você está falando?" com um quadro devendo havia duas horas.
  //
  // ⚠️ ELE NÃO DECIDE NADA. Não classifica, não escolhe tema, não seleciona
  // conhecimento. Apura e entrega legível — o código prepara, o modelo decide.
  //
  // ⚠️ E VEM DEPOIS DA CONTINUIDADE, ANTES DO REPERTÓRIO. Depois porque a
  // continuidade é sobre a última fala e este bloco é sobre a conversa inteira;
  // antes do repertório porque material de consulta não fica entre a conversa e
  // a razão dela — a mesma ordem que o array do `system` já defende.
  const estado = await apurarEstadoDoTurno(supabase, {
    familyId,
    membroId: emFoco[0]?.id ?? null,
    membroNome: emFoco[0]?.nome ?? null,
    historico: ((falas ?? []) as Fala[])
      .slice()
      .reverse()
      .map((f) => ({ direcao: f.direcao, texto: f.texto })),
  });

  const bloco = [...partes, continuidade, blocoDeEstado(estado)].filter(Boolean).join(SEP);

  // ⚠️ O DIAGNÓSTICO VAI PARA A REDE DE FRONTEIRAS, não só para o prompt.
  // `fronteiraAtravessada` usa este bloco para saber o que a família JÁ
  // registrou — sem ele o detector proíbe a Ayla de confirmar um diagnóstico
  // que a própria mãe cadastrou. Omitir é o comportamento mais restritivo, e
  // restritivo demais também é defeito.
  const diagnosticoRegistrado = emFoco
    .map((m) => lista.find((x) => x.id === m.id)?.diagnosticos_formais)
    .flatMap((d) => (Array.isArray(d) ? d : d ? [d] : []))
    .map((d) => String(d).trim())
    .filter(Boolean)
    .join(", ");

  // ⚠️ 200 CARACTERES É O CORTE, e ele veio da medição: a mediana das respostas
  // do Oficial é 666 e as falas curtas da amostra (despedidas, "imagina",
  // confirmações) ficam abaixo de 200. Um menu não conta por mais longo que
  // seja — é exatamente o que esta rede existe para não confundir com ajuda.
  const jaHouveOrientacao = historico.some((l) => {
    if (!l.startsWith("Ayla")) return false;
    const corpo = l.slice(l.indexOf(":") + 1).trim();
    return corpo.length >= 200 && !ehMenuDeAlternativas(corpo);
  });

  return {
    bloco,
    foco,
    diagnosticoRegistrado,
    consultas: 3 + emFoco.length + 2,
    rotulos: [...new Set(rotulosPorMembro)],
    fatos: fatosDoTurno,
    nomeCrianca: emFoco.length === 1 ? (emFoco[0]?.nome ?? null) : null,
    // ⚠️ SÓ COM UMA CRIANÇA EM FOCO. Ver o comentário do campo no tipo.
    idadeFoco:
      emFoco.length === 1
        ? idadeAnos(lista.find((x) => x.id === emFoco[0]?.id)?.data_nascimento ?? null)
        : null,
    jaHouveOrientacao,
    msOndas: { onda1: msOnda1, foco: msFoco, onda3: msOnda3 },
  };
}

/**
 * O TURNO EXPERIMENTAL — contexto → prompt novo → modelo → fronteira.
 *
 * Devolve `null` quando não conseguiu responder; o chamador decide o que fazer
 * (hoje: cair para a Ayla atual, que é o comportamento seguro).
 */
export async function responderExperimental(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    mensagem: string;
    /** Só o simulador do Admin passa isto. A conversa real, nunca. */
    rascunhoCore?: { conteudo: string; versao: number } | null;
    /**
     * ⚠️ O SIMULADOR SE DECLARA. O gasto de token dele é real e tem de ser
     * registrado, mas somar o teste do Admin ao custo das famílias estragaria
     * a única métrica de custo por família que existe.
     */
    origem?: "conversa" | "simulador";
    /**
     * ⚠️ `pos_trial` MUDA O OBJETIVO DA CONVERSA, NÃO A AYLA.
     *
     * Neste modo o turno não recupera repertório, não recebe o conteúdo dos
     * domínios e não passa pela ponte do Plano — porque o teste encerrado não
     * paga mais orientação nova. O que entra é quem é a criança, os RÓTULOS do
     * que sabemos e o bloco de condução comercial.
     *
     * ⚠️ ISTO NÃO É O MECANISMO DE SEGURANÇA. Desligar produtores reduz o que o
     * modelo tem em mãos; não impede o conhecimento próprio dele de escapar. O
     * portão real é comportamental e se prova na bancada adversarial.
     */
    modo?: ModoTurno;
    /**
     * Este turno leva link de assinatura? Só o pós-Trial usa.
     *
     * ⚠️ Quem decide é o cooldown, no orquestrador. O bloco precisa saber para
     * poder proibir a repetição do link que está na conversa recente — segurar
     * a GERAÇÃO não impede o modelo de copiar o TEXTO.
     */
    linkDisponivel?: boolean;
    /**
     * Só o simulador passa isto. A conversa real, nunca — e o teste
     * `simulador-nao-escreve.test.ts` prende que estes turnos não são gravados
     * em lugar nenhum.
     */
    turnosSimulados?: readonly TurnoSimulado[];
    /**
     * ⚠️ C2 · A CLASSIFICAÇÃO JÁ FEITA NESTE TURNO — não se classifica de novo.
     *
     * Desde 15/08/2026 o ramo experimental roda DEPOIS de `classificarIntencao`,
     * e recebe o resultado pronto. O dono da decisão é um só: quem classifica é
     * o orquestrador, e todo mundo abaixo consome o mesmo objeto.
     *
     * `skills` é o que a recuperação de Boas Práticas consome — por isso religar
     * o acervo ao caminho novo não custa classificação nova, só a consulta.
     *
     * Opcional de propósito: o simulador não classifica, e continua funcionando
     * sem isto (cai no comportamento de antes, que é responder sem tema).
     */
    turnoClassificado?: {
      intencao: string;
      tema: string | null;
      aceite: string | null;
      skills: string[];
    } | null;
    /**
     * ⚠️ SÓ O SIMULADOR PASSA ISTO — e existe porque `null` era uma resposta
     * mentirosa. Três causas completamente diferentes (modelo devolveu vazio ·
     * fronteira barrou · exceção) chegavam à tela como a MESMA frase, e a
     * informação que as separa existia no instante da falha e era descartada.
     *
     * Não muda o contrato do runtime: a família continua recebendo `null` e
     * caindo para o fluxo atual, exatamente como antes. Este callback só é
     * chamado se alguém o passar, e a conversa real não passa.
     */
    onFalha?: (motivo: MotivoFalha, detalhe: string) => void;
  },
): Promise<TurnoExperimental | null> {
  const t0 = Date.now();
  try {
    // O Core e o contexto não dependem um do outro: vão juntos, então a
    // leitura do documento não acrescenta espera nenhuma ao turno.
    // ⚠️ O ACERVO ENTRA AQUI, EM PARALELO — não acrescenta espera.
    //
    // `recuperarBoasPraticas` é o MESMO mecanismo do Legacy: uma consulta ao
    // banco e um ranking lexical determinístico (`aderencia.ts`). Sem modelo,
    // sem embedding, sem segunda LLM. As skills vêm de `turnoClassificado`,
    // que já foi calculado pelo orquestrador — religar o acervo não custa
    // classificação nova.
    //
    // ⚠️ REPERTÓRIO, NÃO LIMITE. O bloco entra como material consultável; o
    // Core continua autorizando a Ayla a raciocinar com o repertório dela.
    // `blocoBoasPraticas` já escreve isso no cabeçalho do bloco.
    // ⚠️ NO PÓS-TRIAL O ACERVO NÃO ENTRA. Boas Práticas é a matéria-prima da
    // estratégia; com o teste encerrado não há estratégia nova a entregar, então
    // a consulta nem acontece — economiza a ida ao banco e remove o material.
    const modo: ModoTurno = params.modo ?? "normal";
    const posTrial = modo === "pos_trial";
    const skillsDoTurno = posTrial ? [] : (params.turnoClassificado?.skills ?? []);
    // ⚠️ UM CRONÔMETRO POR OPERAÇÃO — 26/08/2026.
    //
    // Medir em volta do `Promise.all` responde "quanto demorou a mais lenta",
    // que é justamente a pergunta que NÃO se quer responder quando se está
    // procurando o gargalo. `cron` embrulha cada promessa e registra o tempo
    // dela, sem alterar valor, erro nem ordem — `then` com os dois ramos, para
    // que uma falha continue falhando exatamente como antes.
    const marcas: Record<string, number> = {};
    const cron = <T,>(nome: string, pr: Promise<T>): Promise<T> => {
      const inicio = Date.now();
      return pr.then(
        (v) => {
          marcas[nome] = Date.now() - inicio;
          return v;
        },
        (e) => {
          marcas[nome] = Date.now() - inicio;
          throw e;
        },
      );
    };
    const tBp = Date.now();
    // ⚠️ A JORNADA ENTRA AQUI, NO MESMO `Promise.all` — 15/08/2026. Duas
    // consultas (estado + evidências) que não dependem de nada acima e não
    // acrescentam espera ao turno, porque correm ao lado do contexto e do Core.
    //
    // ⚠️ O SIMULADOR NÃO TEM JORNADA. Ele não é uma família em teste; conduzir
    // comercialmente uma tela de Admin não significa nada.
    // O simulador não tem jornada; o pós-Trial tem bloco PRÓPRIO (`blocoPosTrial`),
    // então a condução comercial de dentro do teste também não entra aqui.
    const semJornada = params.origem === "simulador" || posTrial;
    // ⚠️ O REPERTÓRIO PASSOU A ESPERAR A CRIANÇA — 05/09/2026, PEND-163.
    //
    // ⚠️ O DEFEITO: dos três chamadores de `recuperarBoasPraticas`, o único que
    // NÃO passava `idade` era este — o caminho oficial, 97,4% dos turnos.
    // Legacy (`orchestrator.ts:3426`) e web (`lib/ia/context.ts:333`) passavam.
    // E `idadeElegivel` abre com `if (idade == null) return true`: sem o
    // parâmetro o filtro etário inteiro se desliga em silêncio, sem erro.
    //
    // ⚠️ MEDI O ESTRAGO (05/09/2026, 156 crianças ativas, 12 skills): **71% das
    // Boas Práticas entregues hoje estão fora da faixa da criança** (373 de
    // 528). O caso Mario, 18 anos: o modelo recebeu "criança pequena vê alguém
    // chorando", "cérebro pequeno", "brincadeira com outra criança … torre".
    // A infantilização não foi do modelo — foi entregue a ele.
    //
    // ⚠️ POR QUE ISTO CUSTA LATÊNCIA, E QUANTO. A busca corria AO LADO da
    // montagem do contexto, e é lá que a criança é resolvida — por isso a idade
    // não estava disponível. Encadear custa, MEDIDO em 67 turnos reais com
    // repertório: `msParalelo` mediana 846 → 1388 ms (**+542 ms**), p90 983 →
    // 1530. Nos 54% de turnos sem skill nada muda: a busca já não acontecia.
    //
    // ⚠️ SEM FALLBACK. Se a faixa não tiver material, o bloco sai VAZIO. Acima
    // de 18 anos o acervo é vazio em 11 das 13 skills — 5 crianças em produção.
    // Elas passam a receber Core + perfil, sem repertório. É o resultado certo:
    // zero material pertinente é melhor que material impróprio.
    const ctxP = cron(
      "ctx",
      montarContexto(
        supabase,
        params.familyId,
        params.mensagem,
        params.turnosSimulados ?? [],
        modo,
        skillsDoTurno,
      ),
    );
    const [ctxTurno, core, bps, estadoTrial, evidencias, docTrial] = await Promise.all([
      ctxP,
      cron("core", resolverDocumento(supabase, "core", params.rascunhoCore ?? null)),
      skillsDoTurno.length
        ? cron("bp", ctxP.then((ctx) => recuperarBoasPraticas({
            supabase,
            skills: skillsDoTurno,
            // O relato liga o ranking por aderência — sem ele, o corte é
            // sempre o mesmo trio para qualquer mensagem da mesma skill.
            relato: params.mensagem,
            // A IDADE DA CRIANÇA EM FOCO. Ver o bloco acima (PEND-163).
            idade: ctx.idadeFoco,
            limite: 2,
          }))).catch(() => [])
        : Promise.resolve([]),
      semJornada
        ? Promise.resolve(null)
        : cron("trial_estado", lerEstadoTrial(supabase, params.familyId)),
      semJornada
        ? Promise.resolve(EVIDENCIAS_VAZIAS)
        : cron("trial_evid", lerEvidenciasJornada(supabase, params.familyId)),
      // ⚠️ O DOCUMENTO DO TRIAL — a terceira leitura desta frente, e ela também
      // corre AO LADO das outras. Nenhuma espera nova em série.
      //
      // Ele é o COMO: a profundidade para executar a intenção que o `<jornada>`
      // já escolheu. Não decide o dia, não conta dias, não agenda nada — quem
      // faz isso é `lerEstadoTrial` e o código das proativas.
      semJornada ? Promise.resolve(null) : cron("trial_doc", resolverDocumento(supabase, "trial")),
    ]);
    // ⚠️ `msParalelo` CARREGA O SIGNIFICADO ANTIGO de `msBp` — o bloco inteiro —
    // para que a série histórica continue comparável. `msBp` passa a ser o que
    // o nome sempre prometeu: só a recuperação de repertório.
    const msParalelo = Date.now() - tBp;
    const msBp = marcas.bp ?? 0;
    // Determinístico e barato: nenhuma chamada de modelo, nenhuma escrita. Sai
    // vazio para assinante, cortesia, staff e para quem não está em teste.
    const jornada = estadoTrial ? blocoDaJornada(estadoTrial, evidencias) : "";
    // ⚠️ UM DONO PARA A DECISÃO, E ELE JÁ EXISTE. O documento entra EXATAMENTE
    // quando o `<jornada>` entra — não por uma segunda regra escrita aqui.
    //
    // `blocoDaJornada` já devolve "" para assinante, cortesia, staff, teste não
    // iniciado e estado desconhecido; amarrar o documento ao resultado dela faz
    // as duas coisas nunca divergirem. Uma segunda condição aqui seria a
    // segunda verdade que este repositório já pagou caro para não ter.
    //
    // Fora da condução comercial o contexto não cresce um caractere.
    const conducaoTrial = jornada ? (docTrial?.conteudo ?? "") : "";
    const diaDaJornada = estadoTrial?.emConducaoComercial ? estadoTrial.dia : null;
    const fechamentoDoDia = Boolean(
      jornada &&
        estadoTrial &&
        DIAS_DE_FECHAMENTO.has(
          estadoTrial.fase === "trial_encerrado" ? 7 : Math.min(estadoTrial.dia ?? 0, 7),
        ),
    );
    const repertorio = blocoBoasPraticas(bps);

    // ── DISCIPLINA DE CANAL (PEND-145, 24/08/2026) ────────────────────────
    //
    // ⚠️ O QUE ESTAVA ERRADO. Este caminho atende TODAS as famílias no WhatsApp
    // desde 17/08 e nunca recebeu regra de formato nenhuma. MEDI nas respostas
    // reais desde o rollout: `**` cru em **65,2%**, `##` em 9,6%, `>` em 22,2%,
    // mediana de 812 chars contra 376 do Legacy. O WhatsApp não renderiza nada
    // disso — a família via os asteriscos na tela.
    //
    // ⚠️ E NÃO ERA FALTA DE ACOLHIMENTO. No recorte pareado das mesmas 12
    // famílias, este caminho valida emoção em 27,1% contra 11,3% do Legacy e
    // acolhe antes de orientar em 20,1% contra 10,2%. Por isso a correção é SÓ
    // de forma: nada do Core do Legacy vem junto.
    //
    // ⚠️ POR QUE ISTO VAI NO FIM DO `system`. O documento `core` é escrito EM
    // markdown — tem `## Psicologia comportamental`, `**compreender → ajudar**`
    // — e o modelo imita o que o próprio documento demonstra. Regra de formato
    // colocada antes competiria com o exemplo; colocada por último, é a última
    // coisa lida. Mesmo motivo pelo qual `DIRETRIZ_IDIOMA` diz "leia por
    // último" no Legacy.
    //
    // ⚠️ A ENTREGA É CONDICIONAL, e é a parte que mais importa: título em cima
    // de desabafo é frieza. `pedeEntregaEstruturada` é a MESMA função que o
    // `ehEntrega` do Legacy passou a chamar — a decisão tem um dono só.
    // ── COMERCIAL E SUPORTE (PEND-115, 24/08/2026) ────────────────────────
    //
    // ⚠️ O CASO QUE ABRIU ESTA PENDÊNCIA. Em 19/08, três perguntas diretas de
    // preço ficaram sem resposta. Uma era de uma mãe em teste, com medo de ser
    // cobrada, escrevendo "pelo amor de Deus… eu não tenho meu dinheiro". A
    // Ayla respondeu que "o preço vigente aparece na página de assinatura" — e
    // não disse qual página, nem qual preço.
    //
    // ⚠️ POR QUE DUROU. A correção de 22/08 existia e estava no lugar errado:
    // `responder.ts` é o Legacy, que MEDI atender **2,59%** dos turnos desde o
    // rollout. `git log -S "FATOS_COMERCIAIS" -- experimental.ts` volta VAZIO —
    // nunca esteve aqui. O conserto alcançava um turno em quarenta.
    //
    // ⚠️ NADA NOVO É ESCRITO AQUI. `FATOS_COMERCIAIS` e as duas notas vêm das
    // MESMAS funções que `lib/ia/prompt.ts` (a web) já importa — mesma verdade,
    // mesmo destino canônico `/precos`. Uma segunda fonte de preço seria a
    // repetição do defeito que a fonte canônica existe para impedir.
    //
    // A DIVISÃO É DELIBERADA: `FATOS_COMERCIAIS` é regra de produto, estável, e
    // vale em todo turno. As notas são fato DO TURNO — só entram quando a
    // pergunta é comercial ou pede humano, exatamente como a web faz.
    // ⚠️ O LINK COMERCIAL É AUTENTICADO — 27/08/2026. No WhatsApp a família é
    // sempre identificada (chegou pelo número), então ela não pode receber a
    // página pública de aquisição: recebe o caminho que a leva LOGADA ao
    // checkout. Só se paga o custo de gravar o token quando a pergunta é mesmo
    // comercial.
    // ⚠️ NO PÓS-TRIAL O LINK TEM OUTRO DONO — 28/08/2026, PEND-156.
    //
    // Este bloco mintava um token e injetava a URL no prompt; o ramo pós-Trial
    // do orquestrador minta OUTRO e cola a linha comercial na composição final.
    // Nenhum dos dois sabia do outro. PROVEI POR EXECUÇÃO no smoke com modelo
    // real: "Quero assinar" saiu com **dois links diferentes e dois tokens**
    // (`acessos_app` foi de 0 a 2) num único turno.
    //
    // ⚠️ QUEM FICA COM O LINK É O ORQUESTRADOR, e não por sorteio: só ele
    // conhece o acesso, a reserva de 12h (`reservarConviteAssinatura`) e a
    // composição final. Um link mintado aqui furaria o cooldown por fora.
    //
    // ⚠️ ISTO NÃO TIRA O LINK DE NINGUÊM FORA DO PÓS-TRIAL. No turno normal
    // (`modo: "normal"`) a pergunta comercial continua recebendo o link
    // autenticado exatamente como antes — ali o orquestrador não cola nada, e
    // este é o único dono.
    const linkComercial =
      !posTrial && ehPerguntaComercial(params.mensagem)
        ? await linkComercialAutenticado(supabase, params.familyId, "pos_trial")
        : null;
    const comercial = [
      FATOS_COMERCIAIS,
      linkComercial !== null ? notaComercial(linkComercial) : "",
      precisaDeHumano(params.mensagem) ? notaSuporte() : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const entrega = pedeEntregaEstruturada({
      intencao: params.turnoClassificado?.intencao ?? null,
    });
    // ⚠️ AS TRÊS SÃO UM BLOCO SÓ, e a PEND-145 portou uma delas.
    //
    // O Legacy sempre as injetou juntas, sob o mesmo gate (`responder.ts`):
    //   ...(entrega ? [formasDeEntrega(...), INTERESSE_COMO_VEICULO,
    //                  A_CRIANCA_ANTES_DO_ROTULO] : [])
    // Em 24/08 eu levei só `formasDeEntrega` para cá, guiado pelo sintoma que
    // tinha medido (`##`, `**`) em vez da unidade que o código declara. O
    // Oficial ficou com o gate de entrega e um terço do que entra por ele.
    //
    // O QUE FALTAVA, e não é acessório:
    //   · `INTERESSE_COMO_VEICULO` — a permissão de ancorar a atividade no que a
    //     criança ama. O contexto tem um freio forte contra puxar interesse fora
    //     de hora, e o freio sozinho matava também o mecanismo que fazia o Kolo
    //     antigo ser bom. Esta constante é a distinção entre INTRODUZIR ASSUNTO
    //     e SER VEÍCULO — sem ela, sobra só o freio.
    //   · `A_CRIANCA_ANTES_DO_ROTULO` — de onde a explicação nasce: da criança
    //     que a mãe descreveu, não do diagnóstico dela.
    //
    // Condicionais pelo MESMO gate, pela mesma razão de sempre: as duas só fazem
    // sentido quando há entrega. Num desabafo, repertório de atividade é ruído.
    // ── R4a · A PROPORÇÃO ENTRA CALCULADA — 26/08/2026 ─────────────────────
    //
    // A natureza do turno é determinística e o código já a tem: a mensagem
    // deste turno e se a conversa já produziu ajuda. Dizer ao modelo qual é
    // custa zero — nenhuma consulta, nenhuma chamada — e é a diferença entre
    // um princípio que ele aplica sozinho (e que MEDI perdendo: p50 de 666
    // caracteres) e uma instrução sobre ESTE turno.
    //
    // ⚠️ NÃO PASSA PELO GATE QUEBRADO. `pedeEntregaEstruturada` devolve false
    // em 100% dos turnos do Oficial (a taxonomia de intenção daqui não tem
    // "desafio"), então tudo que depende dele é inerte. Esta nota entra ao lado
    // de `FORMATO_WHATSAPP`, que é incondicional — o mesmo lugar por onde a
    // disciplina de canal de fato chegou às famílias em 24/08.
    // `ctxTurno.jaHouveOrientacao` e não a variável desestruturada: a
    // desestruturação acontece algumas linhas abaixo, e o prompt é montado aqui.
    const proporcao = notaDeProporcao(
      naturezaDoTurno(params.mensagem, ctxTurno.jaHouveOrientacao),
    );

    const formato = [
      FORMATO_WHATSAPP,
      proporcao,
      ...(entrega
        ? [
            formasDeEntrega({ canal: "whatsapp", tema: params.turnoClassificado?.tema }),
            INTERESSE_COMO_VEICULO,
            A_CRIANCA_ANTES_DO_ROTULO,
          ]
        : []),
      // ⚠️ POR ÚLTIMO DENTRO DO ÚLTIMO BLOCO, e precisa ser verdade: esta é a
      // única instrução que PREVALECE sobre o resto do prompt — que é inteiro
      // escrito em português. Se vier antes, compete com o exemplo, e o exemplo
      // é o documento todo. Mesmo motivo do `formato`.
      IDIOMA_DA_CONVERSA,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { bloco, foco, diagnosticoRegistrado, consultas, rotulos, fatos, nomeCrianca, jaHouveOrientacao } =
      ctxTurno;
    // O bloco que troca o objetivo da conversa. Vazio fora do pós-Trial.
    const conducaoPosTrial = posTrial
      ? blocoPosTrial({
          nomeCrianca,
          rotulos,
          fatos,
          podeOferecerLink: params.linkDisponivel !== false,
        })
      : "";
    // A criança que a resposta vai carimbar: no foco compartilhado ou ambíguo
    // NÃO se escolhe uma — carimbar seria transformar palpite em dado.
    const membroDoTurno =
      foco.tipo === "individual" || foco.tipo === "unica" ? (foco.membros[0]?.id ?? null) : null;
    const msContexto = Date.now() - t0;

    // ⚠️ MESMO MODELO DA PRODUÇÃO. Trocar prompt E modelo ao mesmo tempo
    // tornaria impossível dizer qual dos dois mudou a conversa.
    const provider = "openai" as const;
    const model = MODELO_CONVERSA[provider];

    const tModelo = Date.now();
    // ⚠️ A GERAÇÃO VIRA FUNÇÃO PORQUE PRECISA SER REPETÍVEL (PEND-151).
    //
    // Até 24/08 este caminho chamava o modelo UMA vez: se estourasse, devolvia
    // `null` e quem segurava a queda era o Legacy. Enquanto o Legacy existe isso
    // funciona; quando ele sair, uma falha transitória do provider — sobrecarga,
    // rate-limit, um 500 que passa em segundos — vira uma mãe sem resposta.
    //
    // `instrucaoExtra` é o que a rede de fronteiras injeta na segunda passada.
    // Vazia no caminho normal: o turno saudável monta o mesmo `system` de antes,
    // byte a byte.
    const gerar = (instrucaoExtra?: string) =>
      gerarConversacional({
      provider,
      model,
      // ⚠️ A ORDEM É CORE → CONTEXTO → REPERTÓRIO, e ela importa. O Core diz
      // COMO pensar; o contexto diz sobre QUEM; o repertório é material que ela
      // pode usar, adaptar, combinar — ou ignorar quando não servir àquela
      // criança. Repertório antes do contexto convidaria a resposta a nascer da
      // Boa Prática em vez de nascer da criança.
      // ⚠️ A JORNADA VEM DEPOIS DO CONTEXTO E ANTES DO REPERTÓRIO. Depois,
      // porque ela é sobre o MOMENTO da família, e o momento não pode competir
      // com quem é a criança. Antes do repertório porque o repertório é
      // material de consulta, e material não deve ficar entre a conversa e a
      // razão dela.
      // O documento do Trial vem LOGO DEPOIS do `<jornada>`, porque ele é a
      // profundidade daquele bloco — e antes do repertório, que é material de
      // consulta e não deve ficar entre a conversa e a razão dela.
      // ⚠️ NO PÓS-TRIAL O BLOCO DE CONDUÇÃO VEM POR ÚLTIMO, e é o único que
      // fala de objetivo. Core (como pensar) → contexto (sobre quem) → condução
      // comercial (para quê, agora). Não há jornada nem repertório neste modo.
      // `comercial` depois do contexto e antes do formato: é fato de produto e
      // do turno, não identidade. `formato` POR ÚLTIMO — ver o comentário na
      // construção dele.
      //
      // ⚠️ NENHUM DOS DOIS INVALIDA O CACHE. O `cache_control` cobre o system
      // inteiro, mas a Anthropic casa por PREFIXO — e o prefixo é
      // `core.conteudo`, que não muda. `bloco` já varia a cada turno desde
      // sempre; acrescentar depois dele não custa cache nenhum a mais.
      system: [
        core.conteudo,
        bloco,
        jornada,
        conducaoTrial,
        repertorio,
        conducaoPosTrial,
        comercial,
        formato,
        // A instrução da fronteira entra DEPOIS de tudo, inclusive do idioma:
        // ela é a correção de uma resposta que já saiu errada, e precisa ser a
        // última palavra. Vazia no turno normal.
        instrucaoExtra ?? "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      messages: [{ role: "user", content: params.mensagem }],
      maxTokens: 1200,
      cacheSystem: true,
    });

    // ⚠️ O LIMITE, POR EXTENSO. `comRetentativaCurta` repete UMA vez se a
    // chamada ESTOURAR. Vazio não estoura — devolve texto em branco —, então
    // ganha UMA segunda chance própria, sem retentativa aninhada. Pior caso
    // absoluto: 3 chamadas. Caminho saudável: 1, exatamente como antes.
    let r = await comRetentativaCurta(() => gerar());
    let texto = (r.texto ?? "").trim();
    if (!texto) {
      console.warn("[ayla:oficial] resposta vazia — uma segunda tentativa");
      r = await gerar();
      texto = (r.texto ?? "").trim();
    }
    const msModelo = Date.now() - tModelo;

    if (!texto) {
      params.onFalha?.(
        "LLM_RESPOSTA_VAZIA",
        `${provider}/${model} respondeu sem texto duas vezes · tokens in ${r.tokensIn}, out ${r.tokensOut}`,
      );
      return null;
    }

    // ⚠️ A REDE DE FRONTEIRAS CONTINUA. Ela é a razão de o streaming ter saído:
    // sem o instante em que a resposta inteira está em memória, não há onde
    // inspecionar o que vai sair. Foi por aí que uma mãe recebeu um diagnóstico
    // informal em produção — e o experimento não reabre esse buraco.
    const tInspecao = Date.now();
    const vazamento = fronteiraAtravessada(texto, diagnosticoRegistrado || null);
    const msInspecao = Date.now() - tInspecao;
    // ⚠️ A FRONTEIRA DEIXA DE SER UMA QUEDA (PEND-151, 24/08/2026).
    //
    // Até aqui, resposta barrada = `return null` = o turno ia para o Legacy.
    // Só que o Legacy NÃO ignora a fronteira: ele regenera com a instrução da
    // própria fronteira e, se ainda vazar, entrega o PISO — uma resposta segura
    // que a fronteira define. O caminho oficial pulava as duas etapas e
    // terceirizava a rede para o cérebro que queremos aposentar.
    //
    // Nada aqui é invenção: `instrucao()` e `piso()` são da própria fronteira,
    // em `lib/conducao/fronteiras.ts`, que já era neutro e já estava importado.
    // O que muda é QUEM executa a rede.
    //
    // ⚠️ UMA regeneração, nunca duas. Se a segunda também vazar, sai o piso —
    // `aindaVaza` não realimenta nada, então não há laço possível.
    if (vazamento) {
      console.warn(
        `[ayla:oficial] fronteira barrou (${vazamento.fronteira.nome}) — regenerando`,
      );
      void logEvent({
        kind: "ayla_fronteira_regenerou",
        severity: "warn",
        family_account_id: params.familyId,
        payload: {
          fronteira: vazamento.fronteira.nome,
          codigos: vazamento.achados.map((a) => a.codigo),
          caminho: "oficial",
        },
      });

      let segunda = "";
      try {
        const r2 = await gerar(vazamento.fronteira.instrucao(vazamento.achados));
        segunda = (r2.texto ?? "").trim();
      } catch {
        segunda = "";
      }
      const aindaVaza = segunda
        ? fronteiraAtravessada(segunda, diagnosticoRegistrado || null)
        : null;

      if (segunda && !aindaVaza) {
        texto = segunda;
      } else {
        void logEvent({
          kind: "ayla_fronteira_piso",
          severity: "error",
          family_account_id: params.familyId,
          payload: {
            fronteira: (aindaVaza ?? vazamento).fronteira.nome,
            codigos_1a: vazamento.achados.map((a) => a.codigo),
            caminho: "oficial",
          },
        });
        // O PISO é RESPOSTA, não desistência: a família recebe algo seguro,
        // escrito para este caso, em vez de o turno cair para outro cérebro.
        texto = (aindaVaza ?? vazamento).fronteira.piso({
          nomeMembro: nomeCrianca ?? null,
        });
      }
    }

    // ── A REDE DE FORMA — 26/08/2026 ────────────────────────────────────────
    //
    // ⚠️ DEPOIS DA REDE DE SEGURANÇA, SEMPRE. A de cima decide se a resposta
    // PODE sair; esta decide se ela sai BEM. Inverter a ordem faria uma
    // correção de tamanho competir com uma correção clínica, e o §16 do Core
    // já diz quem ganha quando as duas falam: a segurança.
    //
    // ⚠️ EM `sombra`, NADA MUDA PARA A FAMÍLIA. Detecta, registra e devolve o
    // texto intacto. Existe porque regenerar custa uma chamada de modelo, e
    // MEDI `msTotal` entre 12 e 26 segundos por turno: ligar a regeneração sem
    // saber a taxa de disparo poderia dobrar o tempo de um quarto das conversas
    // — a tentativa de melhorar a experiência piorando a experiência.
    //
    // O evento é persistido (`persistir: true`) de propósito: em `info` puro
    // ele sumiria com a retenção da Vercel, e a taxa de disparo é justamente o
    // número que decide se a Etapa F acontece.
    // ⚠️ `modoDeForma`, e não `modo`: `modo` já é o do TURNO (`normal` |
    // `pos_trial`) neste mesmo escopo. Dois `modo` diferentes na mesma função é
    // como se lê um bug depois.
    const modoDeForma = modoForma();
    let formaDisparou: string | null = null;
    if (modoDeForma !== "off") {
      const ctxForma = { mensagem: params.mensagem, jaHouveOrientacao };
      const excesso = formaAtravessada(texto, ctxForma);
      if (excesso) {
        formaDisparou = excesso.fronteira.nome;
        void logEvent({
          kind: "ayla_forma_disparo",
          severity: "warn",
          persistir: true,
          family_account_id: params.familyId,
          message: `${excesso.fronteira.nome}: ${excesso.achados[0]?.detalhe ?? ""}`.slice(0, 200),
          payload: {
            fronteira: excesso.fronteira.nome,
            modo: modoDeForma,
            natureza: naturezaDoTurno(params.mensagem, jaHouveOrientacao),
            chars: texto.length,
            perguntas: perguntasReais(texto).length,
            menu: ehMenuDeAlternativas(texto),
            ja_houve_orientacao: jaHouveOrientacao,
            ms_modelo: msModelo,
            caminho: "oficial",
          },
        });
      }
      // ⚠️ `ativo` ainda NÃO regenera — a Etapa F depende do número que a
      // sombra vai produzir. Deixar o ramo escrito e vazio seria pior: quem
      // ligasse a variável acharia que estava corrigindo e não estaria.
      // Enquanto a regeneração não existir, `ativo` se comporta como `sombra`,
      // e o log acima diz em que modo o disparo aconteceu.
    }

    await logarUsoApi(supabase, {
      family_account_id: params.familyId,
      provider,
      model,
      feature: params.origem === "simulador" ? "ayla_simulador" : "ayla_experimental",
      input_tokens: r.tokensIn,
      output_tokens: r.tokensOut,
    }).catch(() => {});

    return {
      texto,
      membroId: membroDoTurno,
      metrica: {
        consultasBanco: consultas,
        chamadasLLM: 1,
        tokensEntrada: r.tokensIn,
        tokensSaida: r.tokensOut,
        msContexto,
        msModelo,
        msInspecao,
        msTotal: Date.now() - t0,
        modelo: model,
        provider,
        fronteiraBarrou: false,
        foco: foco.tipo,
        coreOrigem: core.origem,
        coreVersao: core.versao,
        bpRecuperadas: bps.length,
        // Injetadas ≠ recuperadas: se o bloco vier vazio, nada chegou ao
        // modelo por mais que a consulta tenha devolvido linhas.
        bpInjetadas: repertorio ? bps.length : 0,
        bpChars: repertorio.length,
        msBp,
        // ⚠️ O RASTRO DA JORNADA. Sem isto não dá para saber, depois, que dia a
        // Ayla enxergava quando falou — e é ele que a proativa lê para não
        // repetir a abordagem que a conversa acabou de fazer.
        jornada_dia: diaDaJornada,
        jornada_fechamento: fechamentoDoDia,
        jornada_chars: jornada.length,
        /** Quanto o documento do Trial engordou o prompt. Zero = não entrou. */
        trial_doc_chars: conducaoTrial.length,
        // ⚠️ O RASTRO DO PÓS-TRIAL. Sem isto não há como provar em produção que
        // o turno entrou no modo certo, com que nível de evidência e quantos
        // fatos — que é exatamente o que o portão desta onda exige.
        modo,
        pos_trial_chars: conducaoPosTrial.length,
        pos_trial_nivel: posTrial ? nivelDeEvidencia(fatos) : null,
        pos_trial_fatos: posTrial ? fatos : null,
        // ⚠️ O RASTRO DA REDE DE FORMA. `null` = não rodou (modo off). Uma
        // string = qual fronteira disparou. É por aqui que a taxa vira número.
        forma_modo: modoDeForma,
        forma_disparou: formaDisparou,
        msParalelo,
        msCtx: marcas.ctx ?? 0,
        msCore: marcas.core ?? 0,
        msTrial:
          (marcas.trial_estado ?? 0) + (marcas.trial_evid ?? 0) + (marcas.trial_doc ?? 0),
        msOnda1: ctxTurno.msOndas.onda1,
        msFoco: ctxTurno.msOndas.foco,
        msOnda3: ctxTurno.msOndas.onda3,
      },
    };
  } catch (e) {
    // Qualquer erro no experimento devolve a conversa para a Ayla atual.
    console.warn(
      "[ayla:experimental] falhou, caindo pro fluxo atual:",
      e instanceof Error ? e.message : e,
    );
    params.onFalha?.("EXCECAO", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    return null;
  }
}
