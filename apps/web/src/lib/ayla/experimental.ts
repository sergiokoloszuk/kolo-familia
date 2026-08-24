import type { SupabaseClient } from "@supabase/supabase-js";
import { idadeAnos } from "@/lib/idade";
import { gerarConversacional, MODELO_CONVERSA } from "@/lib/ia/provider";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import {
  FORMATO_WHATSAPP,
  formasDeEntrega,
  pedeEntregaEstruturada,
  INTERESSE_COMO_VEICULO,
  A_CRIANCA_ANTES_DO_ROTULO,
} from "@/lib/conducao/formas";
import { FATOS_COMERCIAIS } from "@/lib/billing/fatos-comerciais";
import {
  ehPerguntaComercial,
  precisaDeHumano,
  notaComercial,
  notaSuporte,
} from "@/lib/billing/destino-comercial";
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
  const [{ data: perfilFamilia }, { data: membros }, { data: falas }] = await Promise.all([
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
  ]);

  const lista = (membros ?? []) as Membro[];
  const foco = await resolverFoco(supabase, familyId, mensagem, lista);
  const emFoco = foco.membros;

  // Perfil Vivo, trajetória e perfil da FAMÍLIA — também em paralelo.
  //
  // ⚠️ O PERFIL DA FAMÍLIA ENTROU EM 15/08/2026. "Somos só eu e ela", "trabalho
  // em turno", "moramos com a avó" mudam a orientação tanto quanto uma
  // característica da criança: uma estratégia que depende de dois adultos é
  // inútil para quem cria sozinha. O Legacy já lia isto; era a última lacuna
  // real de contexto do caminho novo.
  const [perfis, eventos, perfilDaFamilia] = await Promise.all([
    Promise.all(emFoco.map((m) => lerPerfilVivo(supabase, m.id))),
    lerEventos(supabase, familyId, emFoco.map((m) => m.id)),
    lerPerfilFamilia(supabase, familyId),
  ]);

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
  const bloco = partes.filter(Boolean).join(SEP);

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

  return {
    bloco,
    foco,
    diagnosticoRegistrado,
    consultas: 3 + emFoco.length + 2,
    rotulos: [...new Set(rotulosPorMembro)],
    fatos: fatosDoTurno,
    nomeCrianca: emFoco.length === 1 ? (emFoco[0]?.nome ?? null) : null,
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
    const [ctxTurno, core, bps, estadoTrial, evidencias, docTrial] = await Promise.all([
      montarContexto(
        supabase,
        params.familyId,
        params.mensagem,
        params.turnosSimulados ?? [],
        modo,
        skillsDoTurno,
      ),
      resolverDocumento(supabase, "core", params.rascunhoCore ?? null),
      skillsDoTurno.length
        ? recuperarBoasPraticas({
            supabase,
            skills: skillsDoTurno,
            // O relato liga o ranking por aderência — sem ele, o corte é
            // sempre o mesmo trio para qualquer mensagem da mesma skill.
            relato: params.mensagem,
            limite: 2,
          }).catch(() => [])
        : Promise.resolve([]),
      semJornada ? Promise.resolve(null) : lerEstadoTrial(supabase, params.familyId),
      semJornada
        ? Promise.resolve(EVIDENCIAS_VAZIAS)
        : lerEvidenciasJornada(supabase, params.familyId),
      // ⚠️ O DOCUMENTO DO TRIAL — a terceira leitura desta frente, e ela também
      // corre AO LADO das outras. Nenhuma espera nova em série.
      //
      // Ele é o COMO: a profundidade para executar a intenção que o `<jornada>`
      // já escolheu. Não decide o dia, não conta dias, não agenda nada — quem
      // faz isso é `lerEstadoTrial` e o código das proativas.
      semJornada ? Promise.resolve(null) : resolverDocumento(supabase, "trial"),
    ]);
    const msBp = Date.now() - tBp;
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
    const comercial = [
      FATOS_COMERCIAIS,
      ehPerguntaComercial(params.mensagem) ? notaComercial() : "",
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
    const formato = [
      FORMATO_WHATSAPP,
      ...(entrega
        ? [
            formasDeEntrega({ canal: "whatsapp", tema: params.turnoClassificado?.tema }),
            INTERESSE_COMO_VEICULO,
            A_CRIANCA_ANTES_DO_ROTULO,
          ]
        : []),
    ]
      .filter(Boolean)
      .join("\n\n");

    const { bloco, foco, diagnosticoRegistrado, consultas, rotulos, fatos, nomeCrianca } = ctxTurno;
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
    const r = await gerarConversacional({
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
      ]
        .filter(Boolean)
        .join("\n\n"),
      messages: [{ role: "user", content: params.mensagem }],
      maxTokens: 1200,
      cacheSystem: true,
    });
    const msModelo = Date.now() - tModelo;

    const texto = (r.texto ?? "").trim();
    if (!texto) {
      params.onFalha?.(
        "LLM_RESPOSTA_VAZIA",
        `${provider}/${model} respondeu sem texto · tokens in ${r.tokensIn}, out ${r.tokensOut}`,
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
    if (vazamento) {
      console.warn(
        `[ayla:experimental] fronteira barrou a resposta (${vazamento.fronteira.nome}) — caindo pro fluxo atual`,
      );
      params.onFalha?.("FRONTEIRA_BARROU", `fronteira "${vazamento.fronteira.nome}"`);
      return null;
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
