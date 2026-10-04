import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "./anthropic";
import { nucleoConducao } from "@/lib/conducao/diretrizes";
import { novoRastro, registrarRastro, etapa } from "./rotina-rastro";
import { interessesAtuais, type LinhaPerfilVivo } from "./experimental-contexto";
import { pendenciaDeRotina } from "./rotina-pendencia";
import {
  abreFluxoDeArtefato,
  atoSobreArtefato,
  type AtoSobreArtefato,
} from "@/lib/conducao/ato-artefato";
import { ORIENTACAO_DE_TRANSICAO } from "@/lib/conducao/formas";
import { gerarMagicLink } from "./ponte";
import { gerarRotina } from "@/lib/ludico/rotina-servico";
import { idadeAnos } from "@/lib/idade";
import { avaliarProntidaoParaRotina, type ProntidaoRotina } from "./prontidao-rotina";
import { validarRotina, resumirFalhas } from "./validacao-rotina";
import {
  DIAS_LABEL,
  extrairJsonRotina,
  sanitizarRotinas,
  type RotinaProposta,
  type TarefaProposta,
} from "@/lib/ludico/rotina-ia-core";
import { rotinaParaPdf } from "@/lib/ludico/rotina-pdf";
import { alvoDoPedido, RESPOSTA_PDF } from "./rotina-pdf-rota";
import { enviarDocumento } from "./whatsappSender";
import { falaCoerenteComEstado, type EstadoDeCartoes } from "./rotina-fala-coerente";
import {
  classificarFeedbackRotina,
  falaDoQuadro,
  instrucaoDeAjuste,
  type FeedbackRotina,
} from "./rotina-feedback";

/**
 * ── MUDANÇA DELIBERADA DE PRODUTO, 08/08/2026 (D-R1 da SPEC) ────────────────
 *
 * O contrato dizia, desde 03/08: "Se já dá pra montar uma primeira versão,
 * MONTE — não peça confirmação antes." A regra NÃO era erro: ela resolvia um
 * problema real, o de gastar mais um turno perguntando à mãe algo que ela já
 * tinha respondido, e o argumento continua valendo — corrigir algo pronto é
 * mais rápido que responder mais uma pergunta.
 *
 * O que mudou é o ESCOPO dela. Ela passa a valer para a sequência que a
 * FAMÍLIA deu. Quando a Ayla infere, acrescenta ou reorganiza etapas, o quadro
 * deixa de ser o que a mãe descreveu e vira uma proposta — e proposta se
 * mostra antes de virar artefato, porque ela imprime e cola na parede.
 *
 * O critério é "de quem é a sequência?", nunca o tamanho nem a quantidade de
 * turnos. Confirmar sempre seria burocracia; nunca confirmar é montar em cima
 * de suposição. Ver `CONFIRMAR OU MONTAR?` no contrato abaixo.
 *
 * Fluxo GUIADO de ROTINA (reativo): quando a pessoa pede uma rotina/planejamento
 * da semana, a Ayla manda um ESQUEMA simples ("Segunda:/Terça:/…"), a pessoa
 * preenche (mesmo solto), e a Ayla ORGANIZA na tabela da semana (cria as rotinas
 * de cada dia + tarefas) e manda o link. Estado pendente inferido do histórico
 * (tipo="rotina_pergunta"), espelhando o plano guiado e a oferta de fim de semana.
 */

/** Pedido explícito de rotina/planejamento da semana? */
export function pedeRotina(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  // Gatilhos FORTES — já são pedido de rotina por si só (dispensam verbo).
  if (/rotina visual|quadro (de|da) rotina|planejamento da semana|organizar a semana|cronograma/.test(t)) {
    return true;
  }
  if (!/\brotina\b/.test(t)) return false;
  // "rotina" + intenção de criar/organizar/pedir ajuda. Usa RADICAIS pra pegar
  // conjugações que a versão anterior perdia por exigir a palavra exata:
  // "poderia" (não só "pode"), "ajudar/ajudasse" (não só "ajuda"), "gostaria",
  // "montar/monta/monte", etc. Foi o que fez "Poderia me ajudar com uma rotina"
  // cair no reativo genérico em vez do condutor.
  return (
    /\b(quer|gostar|precis|ajud|pod[ei]|mont|prepar|organiz|planej)/.test(t) ||
    /\bcri(ar|a|e)\b/.test(t) ||
    /\bfaz|\bfa[çc]a/.test(t)
  );
}

/**
 * A FAMÍLIA PEDIU UMA ROTINA COM ESSAS PALAVRAS?
 *
 * Piso determinístico do tamanho. `pedeRotina` é largo de propósito (pega quem
 * chega perdido, "tá tudo bagunçado"); este é estreito: só quem NOMEOU a rotina
 * ou disse que quer organizar um período. Quem pede assim não pode receber três
 * linhas de conselho porque o modelo achou que bastava — ela pediu o quadro.
 *
 * A Ayla ainda pode SUGERIR que uma sequência curta resolveria melhor. Sugerir
 * é conversa; rebaixar por baixo é trocar o pedido dela.
 */
/**
 * OS TRÊS NOMES DO MESMO ARTEFATO — cartoes-visuais-v2 §1.
 *
 * ⚠️ MEDIDO EM PRODUÇÃO, 08/09/2026 09:13. A mãe escreveu "Quero montar uma
 * **sequencia visual** / Para Manu / Brincar, tomar banho, almoçar, ir ao
 * shopping". Nenhum dos três testes de `pediuRotinaExplicitamente` casava:
 * o primeiro só conhecia "rotina visual", o segundo exige um período nomeado
 * (tarde/manhã/dia/semana) e o terceiro exige a palavra "rotina".
 *
 * O pedido não foi reconhecido como pedido — e, com uma rotina pendente de
 * tema, a mensagem inteira foi lida como se fosse a resposta do tema.
 *
 * O documento de produto é explícito: "a Ayla pode usar naturalmente Rotina
 * Visual, Sequência Visual ou Cartões Visuais, conforme o pedido da família.
 * Tecnicamente, todos utilizam um único mecanismo." Se a família pode dizer os
 * três, o código precisa entender os três.
 */
const NOMES_DO_ARTEFATO =
  /\b(rotina|sequ[êe]ncia|cart[õo]es|quadro)\s+(visual|visuais)\b|\bquadro (de|da) rotina\b|\bplanejamento da semana\b|\bcronograma\b/;

export function pediuRotinaExplicitamente(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (NOMES_DO_ARTEFATO.test(t)) return true;
  // "organizar a tarde/manhã/noite/o dia/a semana" — período nomeado.
  if (
    /\b(organiz|mont|arrum|estrutur)\w*\s+(a|o|as|os|minha|meu|nossa|nosso)?\s*(tarde|manh[ãa]|noite|dia|semana|rotina)\b/.test(
      t,
    )
  ) {
    return true;
  }
  // "quero/preciso de uma rotina", "faz a rotina da tarde"
  return /\brotina\b/.test(t) && /\b(quer|gostar|precis|ajud|pod[ei]|mont|faz|fa[çc]a|cri(ar|a|e))/.test(t);
}

/**
 * A família quer ver quais sequências já salvou. Não depende de ela lembrar o
 * nome técnico "rotina": é a volta natural de quem pergunta "o que já
 * criamos?" depois de uma conversa anterior.
 */
export function pedeListaDeRotinas(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  return /\b(quais|que)\s+(rotinas|sequ[êe]ncias|cart[õo]es)\b.*\b(j[aá]|criamos|temos|fizemos)\b|\b(o que|quais)\s+(j[aá]\s+)?(criamos|temos|fizemos)\b.*\b(rotinas|sequ[êe]ncias|cart[õo]es)\b/.test(t);
}

/** Pedido para reabrir uma sequência já criada, pelo nome que a mãe lembra. */
export function pedeTrazerRotinaExistente(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  return /\b(traz|traga|manda|mostra|abre|quero ver|me mostra|me manda)\b/.test(t) &&
    /\b(rotina|sequ[êe]ncia|cart[õo]es|aquela|essa|fila|mercado|dentista|banho|escola|sono|dormir)\b/.test(t);
}

/**
 * A FAMÍLIA QUER IMPRIMIR?
 *
 * Decisão de produto (Sérgio, 03/08/2026): toda Rotina tem entrega concreta,
 * mas nem toda Rotina precisa de PDF. A rotina no app JÁ é o artefato. O PDF
 * era automático só porque o canal era WhatsApp — e isso é gerar arquivo pra
 * provar que gerou.
 */
export function pediuParaImprimir(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  return /imprim|impress|pdf|papel|colar|(na|pra|para a) (parede|geladeira)|plastific/.test(
    t,
  );
}

/**
 * A FAMÍLIA PEDIU O APOIO VISUAL COM ESSAS PALAVRAS?
 *
 * Piso do `visual`, irmão do piso do tamanho. Quem diz "rotina visual" ou
 * "cartões" está pedindo o apoio visual, e isso não se discute com o modelo.
 *
 * O caminho contrário NÃO existe: não pedir com essas palavras não zera nada —
 * a evidência no perfil ("ele entende melhor quando vê") continua valendo.
 */
export function pediuApoioVisual(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  // `\b` não basta pra "card": "cardápio" tem fronteira antes do á.
  return /visua(l|is)|cart(ão|ões|ao|oes)|\bcards?(?![a-zà-ú])|figurinha|pictogram|com (figuras|imagens|desenhos)/.test(
    t,
  );
}

/**
 * Uma etapa proposta — o que a família vai ver e o que vai virar cartão.
 *
 * ⚠️ MESMO SHAPE DE `TarefaProposta`, de propósito: é isto que vai para
 * `gerarRotina({propostaAtual})` sem tradução nenhuma no meio. Uma conversão
 * aqui seria a terceira composição da mesma sequência.
 */
export type EtapaProposta = { texto: string; hora: string | null };

/**
 * A PROPOSTA QUE ESTÁ NA MESA — e por que ela se auto-consome.
 *
 * Pendente = a ÚLTIMA mensagem de rotina desta família é uma proposta. Assim
 * que qualquer outra mensagem de rotina sai (o quadro montado, uma pergunta
 * nova), a proposta deixa de ser a última e para de valer sozinha — sem flag
 * pra apagar, sem estado que possa ficar preso.
 *
 * É o mesmo desenho de `rotinaConversaPendente` e de `cards_status`: estado
 * inferido do que aconteceu, não uma máquina de estados paralela.
 */
export async function propostaPendente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date = new Date(),
): Promise<{ etapas: EtapaProposta[]; membroId: string | null } | null> {
  try {
    const limite = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
    const { data } = await supabase
      .from("ayla_messages")
      .select("tipo, metadata, membro_atipico_id")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .gte("created_at", limite.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    const ultima = data?.[0];
    if (!ultima || ultima.tipo !== "rotina_proposta") return null;
    const meta = (ultima.metadata ?? {}) as { proposta?: unknown };
    const etapas = Array.isArray(meta.proposta)
      ? (meta.proposta as unknown[])
          .map((e) => {
            const o = (e ?? {}) as Record<string, unknown>;
            const texto = String(o.texto ?? "").trim();
            return texto ? { texto, hora: o.hora ? String(o.hora) : null } : null;
          })
          .filter((e): e is EtapaProposta => e != null)
      : [];
    // Proposta sem etapas não é proposta: sem elas não há o que a mãe tenha
    // aprovado, e montar em cima disso seria inventar de novo.
    if (!etapas.length) return null;
    return { etapas, membroId: (ultima.membro_atipico_id as string | null) ?? null };
  } catch (e) {
    // Sem estado, o turno se comporta como antes desta frente existir: o
    // condutor decide. Nunca derruba a conversa por causa de uma leitura.
    console.warn("[ayla:rotina] leitura da proposta falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Há uma conversa de rotina em andamento? (último outbound de rotina sem resposta ainda) */
export async function rotinaConversaPendente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date,
): Promise<{ membroId: string | null } | null> {
  const limite = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
  const { data: perguntas } = await supabase
    .from("ayla_messages")
    .select("tipo, membro_atipico_id")
    .eq("family_account_id", familyId)
    .eq("direcao", "outbound")
    .gte("created_at", limite.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const p = perguntas?.[0];
  // A chegada de uma inbound NÃO consome o estado: ela pode ser apenas o
  // primeiro balão de um turno que ainda está sendo agrupado. O estado termina
  // quando a Ayla publica outra outbound. Ler a última outbound de qualquer
  // tipo resolve a corrida da Sofia sem acrescentar consulta ao caminho comum.
  if (p?.tipo !== "rotina_conversa" && p?.tipo !== "rotina_proposta") return null;

  return { membroId: (p.membro_atipico_id as string | null) ?? null };
}

/**
 * O QUE JÁ SABEMOS — perfil, desafios que a própria família marcou no onboarding,
 * e a rotina que já existe. Sem isto o condutor só tinha nome, idade e interesses,
 * e por isso re-perguntava o que a família já tinha contado (caso Maria Iasmin) e
 * ignorava a rotina que ela mesma acabara de descrever (caso Mateus).
 *
 * Tudo best-effort: se uma consulta falhar, o bloco some e a conversa segue.
 */
async function carregarOQueJaSabemos(
  supabase: SupabaseClient,
  membroId: string,
  pv: LinhaPerfilVivo | null,
): Promise<{ perfil: string; desafios: string[]; rotinaExistente: string }> {
  const vazio = { perfil: "", desafios: [] as string[], rotinaExistente: "" };
  try {
    // ⚠️ O PERFIL CHEGA PRONTO — `lerPerfilDaRotina` já leu a linha. Esta função
    // mantém só a consulta que é dela: as rotinas anteriores.
    const rots = await supabase
      .from("rotinas")
      .select("id, nome, dia_semana")
      .eq("membro_atipico_id", membroId)
      .order("created_at", { ascending: false })
      .limit(3);

    const ce = (pv?.categorias_extras ?? {}) as Record<string, unknown>;
    // Os desafios são o que a FAMÍLIA marcou — informação relatada, não
    // diagnóstico e não inferência da Ayla.
    const desafios = Array.isArray(ce.desafios_onboarding)
      ? (ce.desafios_onboarding as unknown[]).map(String).filter(Boolean).slice(0, 6)
      : [];

    // Um resumo curto do perfil: só o que ajuda a montar um dia.
    const interessantes = ["rotina", "sono", "alimentacao", "sensorial", "comunicacao", "emocional"];
    const perfil = interessantes
      .map((k) => {
        const v = ce[k];
        return typeof v === "string" && v.trim() ? `${k}: ${v.trim().slice(0, 180)}` : null;
      })
      .filter(Boolean)
      .join("\n");

    let rotinaExistente = "";
    const linhas = (rots.data ?? []) as Array<{ id: string; nome: string; dia_semana: number | null }>;
    if (linhas.length) {
      const { data: tarefas } = await supabase
        .from("rotina_tarefas")
        .select("rotina_id, texto, hora, ordem")
        .in("rotina_id", linhas.map((r) => r.id))
        .order("ordem", { ascending: true });
      rotinaExistente = linhas
        .map((r) => {
          const t = ((tarefas ?? []) as Array<{ rotina_id: string; texto: string; hora: string | null }>)
            .filter((x) => x.rotina_id === r.id)
            .map((x) => `${x.hora ? `${x.hora} ` : ""}${x.texto}`)
            .join(" → ");
          return t ? `${r.nome}: ${t}` : null;
        })
        .filter(Boolean)
        .join("\n");
    }

    return { perfil, desafios, rotinaExistente };
  } catch {
    return vazio;
  }
}

/**
 * Idade em MESES. `idadeAnos` devolve 0 pra bebê de 18 dias e pra bebê de 11
 * meses igualmente — e a diferença entre os dois é justamente o que decide se
 * uma pergunta de rotina é, no fundo, clínica.
 */
function idadeEmMeses(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const d = new Date(nascimento);
  if (Number.isNaN(d.getTime())) return null;
  const meses = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return meses < 0 || meses > 1200 ? null : Math.floor(meses);
}

/**
 * A LINHA DO PERFIL, LIDA UMA VEZ SÓ — 08/09/2026.
 *
 * ⚠️ ERAM TRÊS CONSULTAS À MESMA LINHA no mesmo turno: `carregarTransicoes`,
 * `carregarOQueJaSabemos` e `carregarInteresses`, cada uma com seu
 * `.from("perfil_vivo_membro")`, em série. O rastro do turno real de 09:46
 * mediu `leituras_perfil=3` e 879 ms só de contexto, com o banco a ~400 ms por
 * ida. Três nomes diferentes para "o perfil da criança" é o mesmo padrão de
 * donos múltiplos que este Gate inteiro está desfazendo — aqui custava latência
 * em vez de correção.
 *
 * Agora a linha é lida uma vez e as três viram funções puras sobre ela.
 */
async function lerPerfilDaRotina(
  supabase: SupabaseClient,
  membroId: string,
): Promise<LinhaPerfilVivo | null> {
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    return (data as LinhaPerfilVivo | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Interesses conhecidos da criança (pra a Ayla PROPOR um tema).
 *
 * ⚠️ O DEFEITO, PROVADO NO TURNO REAL DE 09:46. Esta função procurava
 * `interesses` dentro de `categorias_extras.como_e` — mas `como_e` é **coluna
 * própria** da tabela, não uma chave do saco de extras. O caminho nunca
 * existiu, então ela caía sempre no fallback `preferencias.temas`. A Manu tem
 * quatro interesses registrados (Cozinha, Dinossauro, Cinema, contos e
 * princesas); a Ayla enxergava UM, e por isso ofereceu uma sugestão de tema
 * onde o canônico de produto (cartoes-visuais-v2 §10) pede duas.
 *
 * ⚠️ NÃO É UMA SEGUNDA FONTE DE VERDADE. Quem sabe ler interesse é
 * `interessesAtuais`, em `experimental-contexto.ts` — a MESMA função que o
 * caminho conversacional usa. Ela une as duas fontes reais (`como_e.interesses`
 * da coluna e `categorias_extras.preferencias.temas`) e subtrai o que a família
 * mandou evitar. Aqui só se delega e se formata.
 */
function carregarInteresses(pv: LinhaPerfilVivo | null): string | null {
  const lista = interessesAtuais(pv);
  return lista.length ? lista.slice(0, 8).join(", ") : null;
}

type Transicao = {
  momento: string;
  estrategia: string | null;
  funcionou?: boolean | null;
  /** Momento que a rotina sozinha NÃO resolve (ex.: ansiedade de separação) →
   *  semente pra a Ayla voltar depois e oferecer um PLANO de ação. */
  merece_plano?: boolean | null;
  /**
   * O QUE ESTE REGISTRO É — Gate A, 08/09/2026.
   *
   * `padrao` acontece com regularidade na vida da criança (escovar dentes,
   * início da lição). `episodio` aconteceu uma vez (um passeio de barco, um
   * sudoku que frustrou). AUSENTE significa legado: 47 entradas em 13 perfis
   * foram gravadas antes deste campo existir, e para elas não há evidência
   * nenhuma de qual das duas coisas são.
   */
  tipo?: "padrao" | "episodio" | null;
  /** ISO. Ausente = legado. Nenhuma das 47 entradas existentes tem data. */
  atualizado_em?: string;
};

/**
 * QUANTO TEMPO UM PADRÃO CONTINUA VALENDO COMO ATUAL.
 *
 * ⚠️ MEDIDO na base (08/09/2026), nos 355 domínios de texto datados: mediana de
 * 35 dias, p75 de 42, **p90 de 61**, máximo de 101. Sessenta dias é o decil mais
 * velho do que existe — não um número redondo. Acima disso o registro continua
 * servindo de inspiração, mas deixa de ser oferecido como coisa de agora.
 */
const JANELA_PADRAO_ATUAL_DIAS = 60;

/**
 * O BLOCO DE TRANSIÇÕES QUE VAI AO MODELO — e por que ele deixou de ser uma
 * lista de `momento → estratégia`.
 *
 * ⚠️ O DEFEITO, PROVADO EM 08/09/2026. O prompt dizia "TRANSIÇÕES JÁ CONHECIDAS
 * (use proativamente, não re-pergunte)" seguido de `passeio de barco → rotina
 * visual para antecipar os passos`. A Manu tem esse registro no perfil desde um
 * passeio que já aconteceu. O modelo obedeceu: pôs o barco na rotina de hoje.
 * O mesmo com `sudoku - frustração com puzzle complexo`, no perfil do Mario.
 * Não foi alucinação — foi obediência a uma instrução que mandava usar.
 *
 * ⚠️ A DECISÃO DE PRODUTO que este bloco implementa: **a estratégia é
 * reutilizável; o contexto em que ela foi aprendida, não.** "Antecipação visual
 * dos passos já ajudou" é aprendizado sobre a criança e vale para qualquer
 * transição. "Passeio de barco" é um acontecimento, e acontecimento antigo não
 * volta a acontecer porque está escrito no perfil.
 *
 * ⚠️ POR QUE O `momento` SOME EM VEZ DE GANHAR UMA RESSALVA. Uma ressalva textual
 * ("isto é histórico, não use como etapa") compete com a vontade de ser útil, e
 * perde — é a lição do §15 do protocolo. O que não perde é a string não estar
 * no prompt. Com o barco fora do texto, `barco = 0` não depende de o modelo
 * obedecer: depende de ele não ter recebido a palavra.
 *
 * ⚠️ LEGADO É CONSERVADOR, E ISSO TEM CUSTO ACEITO. Sem `tipo` e sem data, as 47
 * entradas atuais entram só como estratégia. Perde-se "escovar dentes" como
 * momento reconhecido; não se perde "música depois" como estratégia. O erro
 * barato é a Ayla perguntar de novo; o caro é ela inventar um barco.
 */
/**
 * A TERCEIRA PORTA DO SUDOKU — 08/09/2026, 10:21, produção.
 *
 * ⚠️ O CASO. A mãe ditou cinco etapas para o Mario: "Fazer bolo / Guardar na
 * geladeira / Colocar vela / Cantar parabéns / Comer bolo e brigadeiros".
 * Recebeu SETE, com "Respirar fundo antes do sudoku" e "Sudoku — um passo de
 * cada vez" enfiados no meio.
 *
 * Não veio de `categorias_extras.transicoes` — o Gate A fechou aquilo, e a
 * prova contra os 177 perfis confirmou. Não veio da rotina anterior —
 * `blocoRotinaAnterior` devolve vazio quando a família dita a sequência, e ela
 * ditou. Veio da **conversa recente**: às 07:33 do mesmo dia a própria Ayla
 * escreveu, para o Mario, um quadro que continha o sudoku. Essa mensagem cabe
 * na janela de 12 h e chegava CRUA ao prompt, sob o rótulo "CONVERSA".
 *
 * ⚠️ MESMO DEFEITO, TERCEIRA PORTA: conteúdo de artefato antigo competindo com
 * o pedido de agora. E o contrato já proíbe em texto — "quando a família DITOU
 * as etapas, elas são o artefato, inteiras e na ordem dela" — e perdeu de novo.
 * Regra em prompt compete com contexto concreto e perde; é a lição que o Gate A
 * já tinha aprendido duas vezes.
 *
 * ⚠️ O QUE SE PODA, E O QUE NÃO. Some só a LISTA — as linhas de quadro que o
 * sistema cola embaixo da fala ("3. Sudoku", "1️⃣ Fazer bolo"). A prosa da Ayla
 * fica inteira: é ela que carrega a continuidade, o que já foi combinado e o
 * tom. E só poda quando a família ditou a sequência AGORA: quando ela não
 * ditou, o quadro anterior é justamente o que dá contexto.
 *
 * ⚠️ SÓ A FALA DA AYLA. Uma lista escrita pela MÃE é o pedido dela, presente ou
 * passado, e nunca se apaga.
 */
export function podarSequenciasAntigas(
  fala: { de: string; texto: string },
  familiaDitouAgora: boolean,
): string {
  if (!familiaDitouAgora || fala.de === "mae") return fala.texto;
  const linhas = fala.texto.split("\n");
  const ehLinhaDeQuadro = (l: string) =>
    /^\s*(?:\d{1,2}[.)]|[1-9]️?⃣|[-–•])\s+\S/.test(l);
  const podadas = linhas.filter((l) => !ehLinhaDeQuadro(l));
  // Se sobrou pouco, a fala era só o quadro — devolve um marcador em vez de
  // vazio, para o modelo não achar que a Ayla ficou muda naquele turno.
  const texto = podadas.join("\n").trim();
  return texto || "(montou uma sequência anterior — não é a de agora)";
}

/**
 * A PODA APLICADA A UM HISTÓRICO INTEIRO — os dois destinos, um critério.
 *
 * ⚠️ POR QUE ESTA FUNÇÃO EXISTE, e é confissão: eu apliquei
 * `podarSequenciasAntigas` ao TEXTO que vai no prompt do condutor e deixei o
 * ARRAY seguir cru para `gerarRotina` — que é quem compõe o artefato. Duas
 * saídas para o mesmo dado, uma podada e outra não. O alarme do turno das
 * 10:58 apontou para isso: "ditou sequência e nasceram 2 rotinas".
 *
 * É a quinta porta do mesmo defeito em um dia, e sempre pela mesma razão: eu
 * corrijo o dono e esqueço um consumidor. Por isso a poda agora é UMA função
 * usada pelos dois destinos, e não uma expressão repetida em cada um.
 */
export function podarHistorico<T extends { de: string; texto: string }>(
  historico: readonly T[],
  familiaDitouAgora: boolean,
): T[] {
  if (!familiaDitouAgora) return [...historico];
  return historico.map((h) => ({ ...h, texto: podarSequenciasAntigas(h, true) }));
}

/**
 * O PORTÃO DETERMINÍSTICO DA ROTINA — dono único, 08/09/2026.
 *
 * ⚠️ POR QUE ELE EXISTE. A expressão vivia solta no orquestrador e cada frase
 * nova das famílias virava um incidente em produção, não um teste:
 *
 *   08:53  "Quero montar uma **rotina visual** para Manu…"    → passou
 *   09:13  "Quero montar uma **sequencia visual**…"           → NÃO passou
 *   09:59  "Mario / Rotina visual / Fazer bolo / …"           → NÃO passou
 *
 * Três correções no varejo em um dia. Com um dono e uma bancada de frases
 * REAIS (`rotina-portao.test.ts`, extraídas de 113 mensagens de produção), a
 * próxima frase é um teste que falha antes do deploy, não uma família sem
 * artefato.
 *
 * ⚠️ ISTO É A METADE DETERMINÍSTICA. A outra é o decisor (`decidirTurno`), que
 * roda no orquestrador e pode abrir o fluxo por conta própria. As duas somam;
 * nenhuma substitui a outra. Um `false` aqui não significa "não é rotina" —
 * significa "o caminho barato não teve certeza".
 */
export function portaoDeterministicoDeRotina(texto: string | null | undefined): {
  abre: boolean;
  nomeou: boolean;
  ditou: boolean;
  ato: AtoSobreArtefato;
  /** Abriu por desempate de ambiguidade, e não por ato claro. */
  porDesempate: boolean;
} {
  const nomeou = pediuRotinaExplicitamente(texto);
  const ditou = familiaDitouSequencia(texto);
  const ato = atoSobreArtefato(texto);
  // ⚠️ SÓ DESEMPATA A AMBIGUIDADE. `"ambiguo"` quer dizer "o classificador não
  // soube"; nomear o artefato E ditar a sequência é evidência suficiente para
  // saber. As classificações NEGATIVAS — `recusar`, `conversar_sobre`,
  // `reenviar` — continuam mandando: ali o classificador SOUBE, e sobrepô-las
  // reabriria o sequestro de conversa que a Fase 1B fechou.
  const porDesempate = ato === "ambiguo" && nomeou && ditou;
  const abre = (pedeRotina(texto) || nomeou) && (abreFluxoDeArtefato(ato) || porDesempate);
  return { abre, nomeou, ditou, ato, porDesempate };
}

/**
 * A FAMÍLIA DITOU A SEQUÊNCIA NESTA MENSAGEM?
 *
 * ⚠️ NASCEU DE UM INCIDENTE REAL — 08/09/2026, 08:53, Manu. A mãe escreveu, em
 * linhas separadas: "Quero montar uma rotina visual para Manu / Brincar / Tomar
 * banho / Almoçar / Ir ao shopping". Recebeu nove etapas, com um passeio de
 * barco que ela não citou e com banho e almoço trocados de lugar.
 *
 * ⚠️ O DETECTOR É PROPOSITALMENTE BURRO. Ele não interpreta atividade, não
 * classifica, não chama modelo: conta linhas curtas. Quem entende de sequência
 * é o condutor; o que este código precisa saber é UMA coisa — "existe uma lista
 * na mensagem de agora?" —, porque a resposta decide se o artefato de ontem
 * pode ou não entrar no prompt. Um detector esperto erraria de formas mais
 * difíceis de prever que este.
 *
 * ⚠️ CONSERVADOR NA DIREÇÃO CERTA. Se ele disser "não" para uma lista que
 * existe, a moldura endurecida ainda protege. Se dissesse "sim" para uma
 * mensagem sem lista, tiraria contexto legítimo de quem só quer conversar sobre
 * a rotina que já tem. Por isso o piso é 3, e não 2.
 */
/**
 * A PERGUNTA DO TEMA — explícita, com saída para os dois lados.
 *
 * ⚠️ O QUE SAÍA ANTES, medido no turno real de 08/09/2026: *"Falta só escolher o
 * tema dos cartões: posso fazer em **contos e princesas** — ou qualquer outro
 * que Manu esteja gostando agora."* Uma sugestão só, colada, sem numeração e
 * **sem a opção de não ter tema**. Quem não quer tema nenhum não tinha o que
 * responder, e "ou qualquer outro" devolve à mãe um trabalho que é nosso.
 *
 * ⚠️ O CANÔNICO DE PRODUTO (cartoes-visuais-v2 §10) pede **duas** sugestões, a
 * possibilidade de outro tema e a de nenhum tema — numeradas, porque a resposta
 * "1" tem que valer. `lerTemaEscolhido` já entende número.
 *
 * ⚠️ AS SUGESTÕES SÃO DELA, NÃO MINHAS. Saem de `carregarInteresses`, a mesma
 * fonte dos chips da web. Quando não há interesse registrado, o convite fica
 * aberto em vez de inventar preferência — §19 do Prompt Mestre.
 */
export function perguntaDeTema(nome: string, sugestoes: readonly string[]): string {
  const semTema = `Se preferir, escolha *sem tema* para usar imagens bem simples.`;
  if (!sugestoes.length) {
    return `*Para ilustrar os cartões*\nQual tema ${nome} gosta agora? Pode ser um animal, personagem ou outro interesse de ${nome}. ${semTema}`;
  }
  const lista = sugestoes.map((s, i) => `${i + 1}️⃣ *${s}*`).join("\n");
  return `*Para ilustrar os cartões*\nPensei nestes temas para ${nome}:\n${lista}\n\nPode responder só o número, dizer outro tema que ${nome} curta agora ou pedir *sem tema*. Depois você confere a lista e toca em *Gerar cartões*.`;
}

export function opcaoDeContinuarRotinaNoLudico(nome: string, link: string | null): string {
  return link
    ? `\n\n*Prefere continuar no Lúdico?*\nAbra a rotina de ${nome} e toque em *Gerar cartões* para escolher o tema por lá:\n${link}`
    : "";
}

/** Formato final do WhatsApp: sem recuos acidentais nem linhas sobrando. */
export function formatarMensagemDaRotina(texto: string): string {
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function temaConfirmadoNestaRotina(
  historico: readonly { de: "mae" | "kolo"; texto: string; membroId?: string | null }[],
  membroId: string,
): string | null {
  for (let i = historico.length - 1; i >= 0; i--) {
    const fala = historico[i];
    if (fala.de !== "kolo" || fala.membroId !== membroId) continue;
    const confirmado = fala.texto.match(/^(.{2,25}?)\s+anotad[oa]\s+(?:pro|para o)\s+tema dos cart[õo]es\b/i)?.[1]?.trim();
    if (!confirmado) continue;
    const anterior = historico[i - 1];
    if (anterior?.de === "mae" && anterior.texto.trim().toLocaleLowerCase("pt-BR") === confirmado.toLocaleLowerCase("pt-BR")) {
      return confirmado;
    }
  }
  return null;
}

function ehEtapaCurtaDitada(texto: string): boolean {
  return texto.length > 0 && texto.length <= 60 && !texto.endsWith("?") && texto.split(/\s+/).length <= 8;
}

/**
 * Lista falada em áudio, depois de uma âncora inequívoca de ordem.
 *
 * Caso real de 01/10/2026: "ela primeiro precisa arrumar a malinha, precisa
 * escovar o dente, entrar no carro...". A vírgula anterior à lista pertence à
 * explicação do pedido; por isso dividir a mensagem inteira falhava. O recorte
 * só abre com pedido explícito de rotina + "primeiro precisa/deve/vai" e ainda
 * exige ao menos três ações curtas. Relato comum continua fora.
 */
function etapasDitadasEmFala(texto: string): string[] | null {
  if (!pediuRotinaExplicitamente(texto)) return null;
  const depoisDaAncora = texto.match(
    /\b(?:ela|ele)?\s*primeiro\s+(?:precisa|deve|vai)\s+(?:de\s+)?(.+)$/iu,
  )?.[1];
  if (!depoisDaAncora) return null;

  const partes = depoisDaAncora
    .replace(/[,;]?\s+e\s+[ée]\s+isso[.!?]*\s*$/iu, "")
    .split(/\s*(?:,|→|->|;)\s*/)
    .map((parte) => parte
      .replace(/^e\s+/iu, "")
      .replace(/^(?:(?:ela|ele)\s+)?(?:depois\s+)?(?:precisa|deve|vai)\s+(?:de\s+)?/iu, "")
      .replace(/[.!?]+$/u, "")
      .trim())
    .filter(Boolean);

  if (partes.length < 3 || partes.length > 20 || !partes.every(ehEtapaCurtaDitada)) return null;
  return partes;
}

export function familiaDitouSequencia(texto: string | null | undefined): boolean {
  const bruto = String(texto ?? "");
  if (!bruto.trim()) return false;

  if (etapasDitadasEmFala(bruto)) return true;

  // Forma 1 — uma etapa por linha. É como a mãe escreveu em 08/09 08:53.
  const linhas = bruto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length >= 4 && linhas.filter(ehEtapaCurtaDitada).length >= 3) return true;

  // ⚠️ FORMA 2 — TUDO NUMA LINHA SÓ, separado por vírgula ou seta. Faltava, e
  // custou o segundo incidente: às 09:13 do mesmo dia a mãe escreveu
  // "Brincar, tomar banho, almoçar, ir ao shopping" numa linha, o detector
  // devolveu `false`, e a mensagem seguiu para ser lida como tema.
  //
  // A vírgula sozinha não basta como sinal — "ele grita, chora e se joga no
  // chão" também tem vírgulas. Por isso o piso é 3 itens E cada um precisa ter
  // cara de etapa (curto, sem pergunta).
  for (const linha of linhas) {
    const partes = linha
      .split(/\s*(?:,|→|->|;)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (partes.length >= 3 && partes.every(ehEtapaCurtaDitada)) return true;
  }
  return false;
}

/** Linhas curtas ditadas após o pedido são o quadro, não sugestões ao gerador. */
export function etapasDitadasEmLinhas(texto: string): string[] | null {
  const faladas = etapasDitadasEmFala(texto);
  if (faladas) return faladas;
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length < 4 || !pediuRotinaExplicitamente(linhas[0])) return null;
  const etapas = linhas.slice(1).map((l) => l.replace(/^(?:[-•*]|\d+[.)])\s*/, "").trim());
  if (etapas.length < 3 || etapas.length > 20 || etapas.some((l) => !l || l.length > 60 || l.endsWith("?") || l.split(/\s+/).length > 8 || /\b\d{1,2}(?::\d{2}|h\d{0,2})\b/i.test(l))) return null;
  return etapas;
}

/** O recorte pedido são as etapas ditadas, mesmo sem rótulo de período. */
export function aplicarPisosDeRotinaDitada(
  prontidao: ProntidaoRotina,
  pedidoAtual: string,
): ProntidaoRotina {
  const visual = prontidao.visual || pediuApoioVisual(pedidoAtual);
  if (
    !pediuRotinaExplicitamente(pedidoAtual) ||
    !familiaDitouSequencia(pedidoAtual) ||
    prontidao.desfecho === "limite_atuacao" ||
    prontidao.desfecho === "nao_e_rotina"
  ) return { ...prontidao, visual };
  return {
    ...prontidao,
    desfecho: "suficiente",
    pergunta: null,
    visual,
    motivo: "pedido explícito com sequência atual: o recorte são as etapas ditadas",
  };
}

/**
 * A ROTINA ANTERIOR, EMOLDURADA — e por que ela precisa de UM dono.
 *
 * ⚠️ O INCIDENTE, RECONSTRUÍDO. O barco da Manu não veio de
 * `categorias_extras.transicoes` — o Gate A já o tinha tirado de lá, e a prova
 * contra os 177 perfis de produção confirmou. Veio de `carregarOQueJaSabemos`,
 * que injeta as TRÊS últimas rotinas com suas tarefas. A rotina de 07/09, "Dia
 * de shopping e passeio", era exatamente: Brincadeira → Banho → Almoço →
 * Preparar para o passeio de barco → Ir até o barco → Entrar no barco com calma
 * → Passeio de barco → Shopping.
 *
 * O prompt mandava **"use como base"**. O modelo usou. De novo não foi
 * alucinação: foi obediência.
 *
 * ⚠️ A MOLDURA CERTA JÁ EXISTIA NESTE ARQUIVO, oito linhas de contexto acima —
 * `avaliarProntidaoParaRotina` recebia "NÃO é a sequência de agora e NÃO conta
 * como sequência informada", escrito depois de um incidente de 04/08/2026 com
 * ESTA MESMA CRIANÇA e este mesmo padrão. O condutor não recebeu. Dois donos
 * para o mesmo dado, e um deles nunca soube da correção do outro.
 *
 * ⚠️ E MOLDURA SOZINHA NÃO BASTA — é a lição do Gate A. Quando a família ditou a
 * sequência AGORA, o artefato de ontem não é emoldurado: ele **não entra**. Uma
 * ressalva compete com a vontade de ajudar e perde; ausência de texto não
 * compete com nada.
 */
export function blocoRotinaAnterior(
  rotinaExistente: string,
  pedidoAtual?: string | null,
): string {
  const t = (rotinaExistente ?? "").trim();
  if (!t) return "";
  if (familiaDitouSequencia(pedidoAtual)) return "";
  return `ROTINA QUE JÁ EXISTE (de outro pedido — serve pra conhecer a criança; NÃO é a sequência de agora, NÃO conta como sequência informada e NÃO empresta etapa nenhuma para o pedido de hoje. Se a família ditou as etapas agora, valem as dela, inteiras e na ordem dela):\n${t}`;
}

/**
 * O PONTO DIFÍCIL DESTE TURNO — e a sexta porta do Sudoku, 08/09/2026 11:16.
 *
 * ⚠️ O QUE ESTAVA ERRADO, e é o defeito mais bem escondido do dia:
 *
 *     pontoDificilDoTurno = t0?.momento || transicoesConhecidas[0]?.momento
 *
 * `transicoesConhecidas` é o array CRU do perfil. Para o Mario, o índice ZERO é
 * `{"momento":"sudoku - frustração com puzzle complexo"}`. Esse valor virava
 * `pontoDificil`, e `gerarRotina` o transforma numa instrução literal ao
 * gerador: "(o que mais trava no dia: … quebre esse momento em passos menores,
 * com uma etapa de preparação antes dele)". O gerador obedeceu — e por isso a
 * rotina inventada sempre começava com "Respirar fundo antes de começar".
 *
 * ⚠️ O GATE A SANITIZOU A RENDERIZAÇÃO E DEIXOU O ARRAY. `blocoDeTransicoes`
 * cuida do texto que vai ao prompt; este consumidor lia o dado bruto e passava
 * por fora. Cinco correções minhas hoje não alcançaram isto porque eu estava
 * fechando as portas do TEXTO, e esta é do DADO.
 *
 * ⚠️ E `[0]` NÃO É NADA. Não é o mais recente, não é o mais pertinente: é o
 * primeiro do array, na ordem em que foi gravado. Um episódio de agosto tinha a
 * mesma chance de governar a rotina de hoje que qualquer outro.
 *
 * A REGRA, a mesma do resto do Gate A:
 *   · o que ESTE turno revelou manda sempre;
 *   · o perfil só entra se for `padrao` E recente — episódio antigo nunca;
 *   · e quando a família DITOU a sequência, o perfil não impõe ponto difícil
 *     nenhum: ela acabou de dizer o que o dia é.
 */
export function pontoDificilAtual(
  doTurno: string | null | undefined,
  transicoes: readonly Transicao[],
  familiaDitouAgora: boolean,
  agora: Date = new Date(),
): string | null {
  const daConversa = (doTurno ?? "").trim();
  if (daConversa) return daConversa;
  if (familiaDitouAgora) return null;

  const corte = agora.getTime() - JANELA_PADRAO_ATUAL_DIAS * 86400_000;
  for (const t of transicoes) {
    if (t.tipo !== "padrao") continue;
    const quando = t.atualizado_em ? new Date(t.atualizado_em).getTime() : NaN;
    if (!Number.isFinite(quando) || quando < corte) continue;
    const momento = (t.momento ?? "").trim();
    if (momento) return momento;
  }
  return null;
}

export function blocoDeTransicoes(
  transicoes: readonly Transicao[],
  agora: Date = new Date(),
): string {
  const corte = agora.getTime() - JANELA_PADRAO_ATUAL_DIAS * 86400_000;
  const padroesAtuais: string[] = [];
  const estrategias: string[] = [];

  for (const t of transicoes) {
    const estrategia = (t.estrategia ?? "").trim();
    // "não funcionou" é aprendizado tão útil quanto "funcionou", mas nunca
    // entra como sugestão: entra como coisa a não repetir.
    const falhou = t.funcionou === false;

    const quando = t.atualizado_em ? new Date(t.atualizado_em).getTime() : NaN;
    const recente = Number.isFinite(quando) && quando >= corte;
    const ehPadraoAtual = t.tipo === "padrao" && recente;

    if (ehPadraoAtual) {
      const momento = t.momento.trim();
      if (momento) {
        padroesAtuais.push(
          estrategia
            ? `${momento} → ${estrategia}${falhou ? " (não funcionou, tentar outra)" : ""}`
            : momento,
        );
        continue;
      }
    }
    // Todo o resto — episódio, legado sem tipo, padrão velho — contribui só com
    // o COMO. O `momento` fica fora do prompt, e é isso que zera barco e sudoku.
    if (estrategia) {
      estrategias.push(falhou ? `${estrategia} (já foi tentada e não funcionou)` : estrategia);
    }
  }

  const partes: string[] = [];
  if (padroesAtuais.length) {
    partes.push(
      `MOMENTOS DIFÍCEIS QUE SE REPETEM NA VIDA DELE(A) (padrões conhecidos e recentes — pode usar, não re-pergunte): ${[...new Set(padroesAtuais)].join("; ")}`,
    );
  }
  if (estrategias.length) {
    partes.push(
      `ESTRATÉGIAS QUE JÁ AJUDARAM ESTA CRIANÇA ANTES (inspiração para o COMO fazer). ⚠️ São aprendizados de outras situações: NÃO são o que está acontecendo hoje, NÃO viram etapa da sequência e NÃO devem ser mencionadas como acontecimento atual. Use só se couberem no que a família pediu agora: ${[...new Set(estrategias)].join("; ")}`,
    );
  }
  return partes.join("\n");
}

/** Transições difíceis já aprendidas (do Kolo Vivo) — pra a Ayla já chegar sabendo. */
function carregarTransicoes(pv: LinhaPerfilVivo | null): Transicao[] {
  try {
    const ce = (pv?.categorias_extras ?? {}) as Record<string, unknown>;
    const arr = Array.isArray(ce.transicoes) ? (ce.transicoes as unknown[]) : [];
    return arr
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        const momento = String(o.momento ?? "").trim();
        if (!momento) return null;
        // ⚠️ `tipo` e `atualizado_em` ATRAVESSAM. Antes do Gate A os dois eram
        // descartados aqui — `atualizado_em` já existia no tipo e nenhum dos
        // dois lados o usava. Sem eles, `blocoDeTransicoes` não tem como
        // separar padrão atual de episódio antigo.
        const tipo = o.tipo === "padrao" || o.tipo === "episodio" ? o.tipo : null;
        return {
          momento: momento.slice(0, 60),
          estrategia: o.estrategia ? String(o.estrategia).slice(0, 120) : null,
          funcionou: typeof o.funcionou === "boolean" ? o.funcionou : null,
          merece_plano: typeof o.merece_plano === "boolean" ? o.merece_plano : null,
          tipo,
          atualizado_em: typeof o.atualizado_em === "string" ? o.atualizado_em : undefined,
        } as Transicao;
      })
      .filter((t): t is Transicao => t != null)
      .slice(0, 12);
  } catch {
    return [];
  }
}

/** Mescla novas transições no Kolo Vivo (por momento) — auto-incorporação. */
async function salvarTransicoes(
  supabase: SupabaseClient,
  membroId: string,
  novas: Transicao[],
): Promise<void> {
  try {
    if (!novas.length) return;
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const ce = (data?.categorias_extras ?? {}) as Record<string, unknown>;
    const atuais = Array.isArray(ce.transicoes) ? (ce.transicoes as Transicao[]) : [];
    const porMomento = new Map<string, Transicao>();
    for (const t of atuais) if (t?.momento) porMomento.set(t.momento.toLowerCase(), t);
    for (const n of novas) {
      if (!n.momento) continue;
      const key = n.momento.toLowerCase();
      const antigo = porMomento.get(key);
      // ⚠️ A DATA É GRAVADA AGORA — Gate A. `atualizado_em` era declarado no
      // tipo e nunca escrito: MEDI 47 entradas em 13 perfis, ZERO com data.
      // Sem carimbo na escrita, nenhum leitor consegue distinguir o que é de
      // agora do que é de três meses atrás, e a decisão vira chute.
      //
      // ⚠️ O `tipo` NÃO É INVENTADO PARA O QUE JÁ EXISTE. Quando a mensagem
      // nova não traz classificação, herda a antiga — e se não havia nenhuma,
      // continua ausente. Ausente é lido como legado, e legado é conservador.
      porMomento.set(key, {
        momento: n.momento.slice(0, 60),
        estrategia: (n.estrategia ?? antigo?.estrategia ?? null)?.slice(0, 120) ?? null,
        funcionou: n.funcionou ?? antigo?.funcionou ?? null,
        merece_plano: n.merece_plano ?? antigo?.merece_plano ?? null,
        tipo: n.tipo ?? antigo?.tipo ?? null,
        atualizado_em: new Date().toISOString(),
      });
    }
    const merged = Array.from(porMomento.values()).slice(0, 20);
    // Só atualiza linha existente (evita insert sem family_account_id). Sem linha,
    // o Kolo Vivo é criado por outros fluxos; a transição entra na próxima.
    if (data) {
      await supabase
        .from("perfil_vivo_membro")
        .update({ categorias_extras: { ...ce, transicoes: merged } })
        .eq("membro_atipico_id", membroId);
    }
  } catch (e) {
    console.warn("[ayla:rotina-guiada] salvar transições falhou:", e instanceof Error ? e.message : e);
  }
}

/**
 * O CONTRATO da ferramenta de rotina — e SÓ ele.
 *
 * Até 02/08/2026 este arquivo tinha um prompt próprio e completo, que não
 * carregava `nucleoConducao()`. Era uma segunda Ayla: perguntava demais, falava
 * diferente do resto da conversa e não herdava "direção antes de investigação".
 * Metade do texto duplicava o núcleo — "não re-pergunte o que ela já respondeu",
 * "não invente preferências", "tom quente, curto, NUNCA formulário", "UMA
 * pergunta por vez", "CONVIRJA" — tudo isso já é princípio 6 e VOZ 2/3/5.
 *
 * O que sobrou aqui é o que o núcleo não tem como saber: o formato do JSON, o
 * shape de `rotinas`/`transicoes`, e o fato de que o sistema anexa PDF e link
 * quando a ação é "montar".
 */
export const CONTRATO_ROTINA = `# Você está conduzindo uma ROTINA

Tudo acima continua valendo — identidade, princípios, fronteiras e VOZ. Isto aqui
é só o CONTRATO da ferramenta de rotina, não uma segunda Ayla.

## Escolha UM desfecho por turno e devolva pela ferramenta \`conduzir_rotina\`:
acao = "responder"|"perguntar"|"montar"|"sair" · mensagem = sua fala (WhatsApp) · recorrente · transicoes

recorrente: este pedido é sobre a GRADE DA SEMANA (dias que se repetem), ou é UM acontecimento? "Domingo é dia dos pais" é um acontecimento — false —, mesmo dizendo "domingo". "Quero organizar as segundas" é grade — true.

Escreva a "mensagem" como você falaria: aspas, travessões, quebras de linha e emoji
são bem-vindos. A ferramenta serializa o texto por você — não existe caractere
que você precise evitar, e você NUNCA deve escapar nada à mão.

- "responder" — ela fez uma PERGUNTA sobre a rotina ("qual horário encaixo o iPad?", "como você faria a tarde?"). RESPONDA com o que você já sabe: a sequência que ela contou, os horários, a dificuldade que ela relatou. Proponha, explique em uma frase por que, e diga que dá pra ajustar. NÃO devolva a próxima pergunta do roteiro — isso é ignorar o que ela perguntou.
- "perguntar" — falta UMA informação que muda a rotina de verdade. Uma só.
- "montar" — você tem sequência suficiente pra uma primeira versão. Quem MONTA o quadro é o sistema; você decide que é hora.
- "sair" — a mensagem NÃO é mais sobre a rotina (ela mudou de assunto: pediu atividades, contou outra coisa, trouxe outro problema). Devolva "sair" e deixe "mensagem" vazia — outra parte da Ayla responde. NUNCA diga "antes precisamos terminar a rotina": quem manda no assunto é ela.

## A FAMÍLIA NÃO SABE O QUE PEDIR — quem guia é você
Ninguém chega dizendo "quero uma rotina visual semanal". Chega dizendo "preciso de uma rotina", "tá tudo bagunçado aqui", "ele não tem rotina nenhuma", "não sei nem por onde começar". Ela não conhece o produto, e não deveria precisar conhecer.

PEDIDO GENÉRICO → explique em uma frase que uma rotina visual mostra o que acontece agora e o que vem depois. Então pergunte QUAL SITUAÇÃO está precisando de ajuda. Não ofereça o menu "dia inteiro / manhã / noite": isso faz a mãe classificar a própria vida antes de poder contar o que está acontecendo. Dê apenas exemplos leves, como sair de casa, banho, mercado ou dentista, e convide a mãe a contar do jeito dela ou mandar áudio.

PEDIDO JÁ CLARO → NÃO mostre caminho nenhum. "quero organizar a tarde depois da escola" já disse tudo: vá direto. Se ela já citou uma situação, como mercado ou dentista, ela também JÁ escolheu o assunto: descubra somente qual trecho precisa de mais apoio (a jornada toda ou um ponto como fila, barulho ou espera). Nunca volte a perguntar qual período do dia ela quer.

DEPOIS DE ENTENDER A SITUAÇÃO → ofereça uma escolha contextual, nunca um cardápio genérico: uma sequência da jornada inteira (por exemplo, sair de casa → mercado → voltar) OU uma sequência curta só do trecho mais difícil (por exemplo, fila ou barulho). Explique que você sugere os cartões e ela pode trocar, tirar, acrescentar ou mudar a ordem antes de gerar as imagens. Quando sugerir uma sequência, ela é uma PROPOSTA — não trate como se fosse a rotina real da família.

DEPOIS QUE ELA ESCOLHE, ensine o mínimo — sem virar formulário. Diga o que você precisa saber, em uma frase, e tire dela o peso de organizar: "me conta como é hoje, mesmo bagunçado — pode mandar áudio, que eu organizo". Pra um dia inteiro, o que importa é a sequência do que acontece, os horários que realmente mandam (escola, terapia, atividade fixa) e onde costuma travar. Diga isso do jeito que uma pessoa diria, não como três campos.

E ANTES DE PERGUNTAR QUALQUER COISA, olhe o que você já tem. A frase que a família precisa ouvir é "eu já sei X e Y, só me falta Z" — nunca "me conta a rotina toda de novo". Se o perfil já traz o horário da escola e o ponto difícil, isso não se pergunta.

## ROTINA VISUAL É UMA COISA. PLANO É OUTRA. Nunca confunda as duas.
ROTINA VISUAL = o que acontece, em que ordem, com os horários que a família deu, e um apoio curto no momento difícil. Serve pra deixar claro o que vem AGORA e o que vem DEPOIS.
PLANO ESTRATÉGICO = compreensão do desafio, estratégias amplas, atividades, frases, o que observar.

Quem pediu rotina recebe ROTINA. Aconteceu o contrário em produção (03/08/2026): a mãe pediu a rotina da tarde, a Ayla falou em "plano estratégico", disse que a rotina estava pronta, e o que chegou foi um PDF de PLANO. Ela pediu uma coisa e recebeu outra.

- NUNCA chame a rotina de "plano estratégico", nem ofereça "um plano com essa rotina visual".
- NUNCA diga que os cartões foram enviados: eles ficam DENTRO da rotina, no app.
- NUNCA diga "está pronta" antes de existir, nem prometa que "vai chegar".

ANTES DE MONTAR (só quando já dá pra montar), diga em duas ou três linhas o que você vai fazer — é assim que a família aprende o que é a Rotina Visual:
"Já dá pra montar a rotina da tarde do Mario. Vou organizar cada dia com a sequência das atividades e usar os horários que você me passou; onde não houver horário fixo, deixo só a ordem, pra não inventar precisão. A Rotina Visual serve justamente pra ficar claro o que vem agora e o que vem depois."

DEPOIS QUE EXISTE, comente o que foi personalizado — a transição difícil, o horário que ELA deu, o que você encaixou por causa do que ela contou. Sem listar as etapas: elas aparecem logo abaixo, do jeito que ficaram.

FECHAMENTO QUE ENSINA SEM VIRAR PROPAGANDA: depois de a sequência existir, diga em uma frase que ela pode voltar para contar se ajudou ou para ajustar. Diga também, de modo natural, que pode pedir outra sequência sempre que outro momento do dia estiver difícil — ela não precisa saber o nome "Rotina Visual". Não transforme isso num catálogo nem pergunte por outra situação no mesmo turno.

## COMBINADO VISUAL — quando o que trava é um acordo, não uma sequência do dia
Tem hora que o problema não é "ela não sabe o que vem depois", é "a gente combina e não se sustenta": a ida à loja, o tempo de tela, a visita na casa de alguém. Aí a sequência serve pra tirar o acordo da fala e deixá-lo concreto — e é uma sequência curta como qualquer outra (mesma rotina, mesmas tarefas, mesmos cartões). Não anuncie como produto diferente: chame do que é ("um combinado pra loja", "o combinado do tempo de tela").
ESCREVA O QUE FAZER, NÃO O QUE NÃO FAZER. "Não corra", "não mexa", "não grite" não dizem à pessoa o que ela deve fazer no lugar — e a criança fica com a proibição sem a alternativa. Troque por comportamento observável: "ficar perto", "mãos no carrinho", "escolher o item", "depois vamos embora".
O COMBINADO PRECISA TER UM DEPOIS. Onde termina e o que vem em seguida — senão vira lista de exigências. E não transforme em barganha: o que vem depois é o que vem depois, não prêmio por obedecer.
COM ADOLESCENTE OU ADULTO, construa COM a pessoa quando der: um acordo que ela ajudou a escrever é outro acordo. Diga isso à família em uma linha.

## VISÃO DA SEMANA ≠ ROTINA DO DIA
São perguntas diferentes e a resposta certa muda. "Em quais dias tem terapia?", "quero organizar os compromissos da semana", "ele pergunta o tempo todo o que vai ter" → é VISÃO DA SEMANA: cada dia com os poucos compromissos daquele dia (escola, fono, natação), não uma lista de tarefas. "Como ele se arruma de manhã", "a hora de dormir" → é ROTINA/SEQUÊNCIA daquele período.
Na visão da semana, cada dia leva POUCAS entradas — o que acontece, não como se faz. Segunda: escola → fono. Terça: escola. Não encha os dias de tarefas: o que ajuda ali é enxergar a semana, e um painel cheio faz o contrário.
DEPOIS DA SEMANA, e só se ela contar que um dia é o pior, ofereça detalhar SÓ AQUELE DIA — ou só a passagem difícil dele. Não reconstrua a semana inteira por causa de um dia.
Oriente a usar: deixar visível em casa e olhar com a pessoa o dia seguinte na noite anterior. Uma frase, quando couber.

## AYLA SEMPRE ENTREGA — ajuda útil, não necessariamente artefato
"Sempre entrega" quer dizer que a família NUNCA fica sem nada de concreto. NÃO quer dizer gerar um quadro em toda conversa. A melhor ajuda é a MENOR que resolve: às vezes é conduzir uma passagem (antes/durante/depois), às vezes é uma sequência curta de 2 a 4 etapas, às vezes é o período inteiro organizado. Quem decide o tamanho é o porteiro, e ele já decidiu quando você chega aqui.
## CONFIRMAR OU MONTAR? Depende de QUEM escreveu a sequência
A pergunta é uma só: as etapas que vão pro quadro são as que ELA deu, ou você é que completou?

- ELA DITOU A SEQUÊNCIA ("Mario chega, jantar, Mario vai embora, dormir"; "acorda 6h, escola 7h30, almoço, fono, jantar, dormir") → MONTE, sem pedir confirmação. Confirmar aqui é devolver a ela a mesma lista que ela acabou de escrever, e isso cansa e atrasa. Ela vê a rotina pronta e ajusta o que quiser; corrigir algo pronto é mais rápido que responder mais uma pergunta. Só pare se houver INCONSISTÊNCIA REAL no que ela deu (duas etapas na mesma hora, uma que não pode vir antes da outra) — e aí pergunte sobre a inconsistência, não sobre a lista inteira.
- VOCÊ INFERIU, ACRESCENTOU OU REORGANIZOU — encaixou uma etapa que ela não citou, mudou a ordem, quebrou uma etapa em duas, completou o começo ou o fim → devolva "perguntar" E PREENCHA O CAMPO \`proposta\` com as etapas na ordem. Um "sim", "pode ser", "isso mesmo" libera a montagem; uma correção entra e você monta com ela.
  ⚠️ NÃO ESCREVA A LISTA NA SUA "mensagem". O sistema imprime as etapas do campo \`proposta\` logo abaixo da sua fala — é a MESMA lista que ele vai guardar e que vai virar o quadro depois do aceite. Se você escrever a lista à mão também, viram duas listas que podem divergir, e foi assim que uma família leu 12 etapas e a criança recebeu 9 (07/08/2026).
  Sua "mensagem" aqui é curta: uma linha dizendo o que você entendeu e uma pergunta só no fim ("Faz sentido assim ou você mudaria alguma parte?").
  ⚠️ NÃO INVENTE RECOMPENSA. "Escolher a recompensa combinada", "ganhar um prêmio depois" — nada disso entra numa proposta sua. Se a família disser espontaneamente que depois vem um sorvete, aí sim entra, porque veio dela e é o que de fato vai acontecer. Rotina não é barganha (ver COMBINADO VISUAL).
⚠️ O que se confirma é O QUE É SEU. Não é confirmar sempre, nem nunca: é não montar em cima de suposição sua sem ela ver. Horário que ela não deu, você PROPÕE a partir do que sabe (chegada, escola, atividade fixa) e deixa claro que é sugestão; só não invente horário quando não há nada em que se apoiar. Propor horário dentro da sequência dela NÃO é inferir a sequência.
⚠️ NÃO transforme a confirmação em mais uma rodada de perguntas. É UMA mensagem, com a proposta inteira à vista, e uma pergunta só.
Ponha uma dica curta NO PONTO DIFÍCIL — o momento que ela relatou, ou a transição que você já conhece do perfil. Uma ou duas, não uma aula. Quando fizer sentido, uma brincadeira ou atividade simples ancorada nos interesses dele.
TEMA dos cartões NÃO é assunto seu: o sistema pergunta, no lugar certo, com os interesses que já conhece. Você não oferece tema, não pergunta tema, não escreve "quer no tema de...". E tema NUNCA é motivo pra existir cartão — o cartão existe quando VER a sequência ajuda a criança; o tema só personaliza o que já ia existir. A atividade tem que continuar reconhecível: primeiro se entende que é BANHO, depois é que ele é um dinossauro.

## Formato dos dados
transicoes: [{"momento":"banho","estrategia":"música depois","funcionou":null,"merece_plano":false,"tipo":"padrao"}] — o que você descobriu sobre momentos difíceis fica no perfil e você reusa. Marque "funcionou" quando ela disser que deu certo ou não. Se o momento for algo que a rotina sozinha NÃO resolve (ansiedade de separação, crise intensa, recusa alimentar séria), diga isso em uma frase e marque "merece_plano":true.
"tipo" é OBRIGATÓRIO e só aceita dois valores. "padrao" = acontece com regularidade na vida dela (o banho de todo dia, o início da lição, a saída para a escola). "episodio" = aconteceu uma vez ou é de uma ocasião específica (um passeio, uma viagem, uma consulta, um jogo que frustrou naquele dia). Na dúvida, "episodio" — só o que se repete pode ser reusado depois como coisa de hoje.

## A SEQUÊNCIA DO QUADRO É A DA FAMÍLIA — a sua dica NÃO é o quadro
Quando a família DITOU as etapas, elas são o artefato, inteiras e na ordem dela. Você pode melhorar a redação de cada uma, encurtar palavra, deixar mais concreto. Você NÃO pode, em silêncio: trocar por outra sequência, apagar etapa, cortar o fim, nem reduzir a lista dela à passagem que você achou mais difícil.

⚠️ CUIDADO COM A SUA PRÓPRIA DICA — este é o erro que já aconteceu (08/08/2026, caso real). A mãe deu cinco etapas ("chega · cumprimenta todos · senta para estudar · faz a lição · agradece e dá tchau"), você respondeu certo na fala e, no MESMO turno, sugeriu um ensaio de três passos pra parte mais pesada ("para na porta, respira · entra e cumprimenta · escolhe a mesa e senta"). O quadro saiu com os SEUS três. A família perdeu as etapas dela e ninguém percebeu.
ORIENTAÇÃO COMPLEMENTAR VIVE NA SUA FALA, NUNCA NAS ETAPAS. Preparação, ensaio, respiração, frase de antecipação, o que fazer antes e depois — tudo isso é conversa. Se houver duas listas no turno, a que vai pro quadro é SEMPRE a dela.
SE VOCÊ ACHA QUE FALTA UMA ETAPA no que ela deu, não acrescente calado: proponha, mostre a lista inteira com o acréscimo, e pergunte. É a regra CONFIRMAR OU MONTAR.

## Quando "montar": o sistema anexa o link, e cuida sozinho de cartões e PDF
NÃO escreva a sequência na sua "mensagem": o sistema mostra as etapas exatamente como ficaram no quadro, logo abaixo da sua fala. Sua parte é o que só você sabe fazer — dizer o que entendeu, a dica no ponto difícil, a frase de antecipação. Confirme no passado, não no futuro. NUNCA escreva "vou montar", "vou gerar", "vou te mandar" ou "vai aparecer": quando você devolve "montar", já está feito.
NÃO diga que mandou PDF, nem que os cartões estão sendo gerados: isso depende da necessidade e do que ela pediu, e o sistema acrescenta a frase certa depois da sua. Se você anunciar um arquivo que não saiu, ela vai procurar no celular e não vai achar. A entrega concreta é a ROTINA — o PDF é opção de impressão pra quem quer colar na parede.`;

/** Pedido novo cria outro quadro; edição explícita pode atualizar o existente. */
export async function aplicarRotina(
  supabase: SupabaseClient,
  familyId: string,
  membroAtipicoId: string,
  r: RotinaProposta,
  tema: string | null,
  /**
   * A rotina abre em cartões ou em lista? Até 03/08/2026 a Ayla não escrevia
   * este campo, e a tela caía no default "cartoes" — então TODA rotina abria
   * numa grade de cartões vazios, com o cabeçalho dizendo "Rotina Visual",
   * mesmo quando ninguém tinha decidido que ali cabia apoio visual.
   */
  visual = false,
  reusarExistente = false,
): Promise<string | undefined> {
  const nome = r.nome.trim() || "Rotina";
  let rotinaId: string | undefined;
  let criadaNesteTurno = false;
  if (reusarExistente) {
    let q = supabase
      .from("rotinas")
      .select("id")
      .eq("membro_atipico_id", membroAtipicoId)
      .eq("family_account_id", familyId)
      .eq("nome", nome);
    q = r.dia_semana === null ? q.is("dia_semana", null) : q.eq("dia_semana", r.dia_semana);
    const { data: existe, error: leituraErro } = await q.maybeSingle();
    if (leituraErro) throw leituraErro;
    rotinaId = existe?.id as string | undefined;
  }
  const encontrouExistente = Boolean(rotinaId);
  if (!rotinaId) {
    const { data: nova, error: criacaoErro } = await supabase
      .from("rotinas")
      .insert({
        family_account_id: familyId,
        membro_atipico_id: membroAtipicoId,
        nome,
        dia_semana: r.dia_semana,
        tema: tema || null,
        modo_exibicao: visual ? "cartoes" : "lista",
      })
      .select("id")
      .single();
    if (criacaoErro) throw criacaoErro;
    rotinaId = nova?.id as string | undefined;
    criadaNesteTurno = Boolean(rotinaId);
  } else if (tema) {
    const { error: temaErro } = await supabase
      .from("rotinas")
      .update({ tema, cards_status: "nenhum", modo_exibicao: visual ? "cartoes" : "lista" })
      .eq("id", rotinaId);
    if (temaErro) throw temaErro;
  } else if (visual) {
    // Na edição, se a mãe já escolheu ver em cartões, não desfazemos.
    const { error: visualErro } = await supabase.from("rotinas").update({ modo_exibicao: "cartoes" }).eq("id", rotinaId);
    if (visualErro) throw visualErro;
  }
  if (!rotinaId) return undefined;
  try {
    if (encontrouExistente) {
      const { error: exclusaoErro } = await supabase.from("rotina_tarefas").delete().eq("rotina_id", rotinaId);
      if (exclusaoErro) throw exclusaoErro;
    }
    const rows = r.tarefas.slice(0, 25).map((t, i) => ({
      rotina_id: rotinaId,
      texto: t.texto.slice(0, 120),
      hora: t.hora ? t.hora.slice(0, 10) : null,
      icone: null,
      ordem: i,
    }));
    if (rows.length) {
      const { error: tarefasErro } = await supabase.from("rotina_tarefas").insert(rows);
      if (tarefasErro) throw tarefasErro;
    }

    // ESCRITA CRÍTICA CONFERE O PRÓPRIO RESULTADO. A fala só pode dizer que a
    // rotina existe depois de reler identidade e sequência do banco. Isso
    // separa "o insert não lançou" de "o quadro certo ficou persistido".
    const [{ data: rotinaGravada, error: rotinaErro }, { data: tarefasGravadas, error: leituraTarefasErro }] =
      await Promise.all([
        supabase
          .from("rotinas")
          .select("id, family_account_id, membro_atipico_id")
          .eq("id", rotinaId)
          .maybeSingle(),
        supabase
          .from("rotina_tarefas")
          .select("texto, hora, ordem")
          .eq("rotina_id", rotinaId)
          .order("ordem", { ascending: true }),
      ]);
    if (rotinaErro) throw rotinaErro;
    if (leituraTarefasErro) throw leituraTarefasErro;
    if (
      !rotinaGravada ||
      rotinaGravada.family_account_id !== familyId ||
      rotinaGravada.membro_atipico_id !== membroAtipicoId
    ) {
      throw new Error("rotina persistida com identidade divergente");
    }
    const esperado = rows.map((x) => ({ texto: x.texto, hora: x.hora, ordem: x.ordem }));
    const confirmado = (tarefasGravadas ?? []).map((x) => ({
      texto: String(x.texto ?? ""),
      hora: x.hora ? String(x.hora) : null,
      ordem: Number(x.ordem),
    }));
    if (JSON.stringify(confirmado) !== JSON.stringify(esperado)) {
      throw new Error("sequência persistida diverge da rotina aprovada");
    }
    return rotinaId;
  } catch (e) {
    // Se a própria criação deste turno ficou pela metade, não deixa um quadro
    // vazio parecendo válido. Em edição, não apagamos o artefato preexistente.
    if (criadaNesteTurno) {
      const { error: limpezaErro } = await supabase.from("rotinas").delete().eq("id", rotinaId);
      if (limpezaErro) {
        console.error("[ayla:rotina] falha ao remover criação parcial:", limpezaErro.message);
      }
    }
    throw e;
  }
}

/**
 * Gera o PDF da rotina, sobe no Storage e manda como documento.
 *
 * ⚠️ DEVOLVE SE ENVIOU. Era `void` e engolia a falha em silêncio — bastava
 * enquanto o PDF era um brinde no fim da montagem. Deixou de bastar quando a
 * mãe passou a PEDIR o PDF: sem retorno, quem responde não sabe se pode dizer
 * "enviei", e foi assim que a Ayla afirmou um envio que não aconteceu
 * (Rosângela, 07/08/2026). Os chamadores antigos ignoram o retorno e seguem
 * iguais.
 */
export async function entregarPdfDaRotina(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    phoneE164: string;
    nome: string;
    tema: string | null;
    rotinas: RotinaProposta[];
    /** O momento que a família relatou como difícil. Vem da conversa. */
    pontoDificil?: string | null;
    /** A estratégia que a Ayla já definiu pra esse momento — NÃO é um texto
     *  novo: é a mesma `transicoes[].estrategia` que ela guarda no Kolo Vivo.
     *  Reaproveitar evita uma segunda fonte de verdade. */
    fraseDeApoio?: string | null;
  },
): Promise<boolean> {
  try {
    const comDia = params.rotinas.filter((r) => r.dia_semana != null);
    const semDia = params.rotinas.filter((r) => r.dia_semana == null);
    const ordenadas = [
      ...comDia.sort((a, b) => (a.dia_semana ?? 0) - (b.dia_semana ?? 0)),
      ...semDia,
    ];
    const dias = ordenadas.map((r) => ({
      nome: r.nome || (r.dia_semana != null ? DIAS_LABEL[r.dia_semana] : "Rotina"),
      tarefas: r.tarefas,
    }));
    const semana = comDia.length > 0;
    const titulo = semana ? "Rotina da semana" : ordenadas[0]?.nome || "Rotina";
    const bytes = await rotinaParaPdf({
      titulo,
      nome: params.nome,
      tema: params.tema,
      // A PERSONALIZAÇÃO CHEGA AO ARTEFATO. Até aqui o ponto difícil era
      // coletado, ia pro gerador, e parava — o bloco "UMA AJUDA NESTA
      // TRANSIÇÃO" existia no layout e nunca era preenchido em produção. A mãe
      // percebia a personalização na conversa e não a via no PDF.
      pontoDificil: params.pontoDificil ?? null,
      fraseDeApoio: params.fraseDeApoio ?? null,
      dias,
    });

    const path = `${params.familyId}/rotina/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("imagens")
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage.from("imagens").createSignedUrl(path, 3600);
    if (!signed?.signedUrl) throw new Error("sem signed url");
    const fileName = `rotina-${params.nome}`.replace(/[^\w\sÀ-ÿ-]/g, "").slice(0, 40).trim() + ".pdf";
    const envio = await enviarDocumento({
      phoneE164: params.phoneE164,
      url: signed.signedUrl,
      fileName,
    });
    // `messageId` é o mais forte que existe aqui: prova que a Z-API ACEITOU o
    // arquivo. Não prova entrega nem leitura — e a copy não diz isso.
    return Boolean(envio?.messageId);
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha no PDF:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Dispara a geração dos cartões (endpoint interno) — a Ayla não gera direto
 * (mundo separado de /lib/ia). Best-effort; roda em segundo plano no app. */
export async function dispararGeracao(
  rotinaId: string,
  tema: string,
  opts?: { preservarArte?: boolean },
): Promise<boolean> {
  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    // Segredo PRÓPRIO da geração — ver a nota no route.ts: o
    // `AYLA_WEBHOOK_SECRET` serve o inbound da Z-API e o cookie de ativação, e
    // reaproveitá-lo acoplaria a rotina à porta de entrada da Ayla.
    const secret = process.env.KOLO_GERACAO_SECRET;
    // O endpoint é fail-closed desde 08/08/2026. Sem o segredo aqui, TODO
    // cartão para de sair — e antes isso seria um 401 engolido pelo catch.
    if (!secret) {
      console.error(
        "[ayla:rotina] KOLO_GERACAO_SECRET ausente — nenhum cartão será gerado. Configure o ambiente.",
      );
      return false;
    }
    const r = await fetch(`${base}/api/ludico/gerar-rotina`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ayla-secret": secret },
      body: JSON.stringify({ rotinaId, tema, preservarArte: opts?.preservarArte === true }),
    });
    // DEVOLVE SE COMEÇOU. O endpoint grava `cards_status='gerando'` antes de
    // responder, então um 200 aqui significa que a geração está mesmo em curso
    // — e é só com isso na mão que a Ayla pode dizer "já comecei". Best-effort
    // continua, mas deixa de ser MUDO: o disparo que falha era a diferença
    // entre "gerando" e a mãe olhando ícone pra sempre.
    if (!r.ok) {
      console.error(`[ayla:rotina] disparo recusado pelo gerador — HTTP ${r.status} (rotina ${rotinaId})`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ayla:rotina] disparar geração falhou:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * A SEQUÊNCIA NA FALA É UMA VIEW DO QUE FOI GRAVADO.
 *
 * Até 08/08/2026 o condutor escrevia a lista de etapas na própria mensagem —
 * de cabeça, ANTES de `gerarRotina` existir o quadro. Eram duas composições
 * independentes do mesmo pedido, e elas divergiam: em 07/08 a mãe leu 12
 * etapas e a criança recebeu 9, com a visita à pessoa nova (o motivo do
 * pedido) colapsada num cartão genérico.
 *
 * Lendo do banco, divergir deixa de ser possível. Não é uma regra a mais no
 * prompt pedindo coerência: é a mesma lista, uma vez só.
 */
async function sequenciaDoQuadro(
  supabase: SupabaseClient,
  ids: string[],
): Promise<string> {
  if (!ids.length) return "";
  try {
    const { data: rots } = await supabase
      .from("rotinas")
      .select("id, nome, dia_semana")
      .in("id", ids);
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("rotina_id, texto, hora, ordem")
      .in("rotina_id", ids)
      .order("ordem", { ascending: true });
    if (!tarefas?.length) return "";

    const ordemDosIds = ids;
    const blocos: string[] = [];
    for (const id of ordemDosIds) {
      const r = (rots ?? []).find((x) => x.id === id);
      const minhas = (tarefas ?? []).filter((t) => t.rotina_id === id);
      if (!minhas.length) continue;
      const linhas = minhas
        .map((t, i) => `${i + 1}. ${t.texto}${t.hora ? ` — ${t.hora}` : ""}`)
        .join("\n");
      // Com uma rotina só, o nome já está na fala da Ayla; com várias (semana),
      // cada bloco precisa dizer de que dia é.
      blocos.push(ordemDosIds.length > 1 && r?.nome ? `*${r.nome}*\n${linhas}` : linhas);
    }
    return blocos.join("\n\n");
  } catch (e) {
    // Best-effort: sem a view, a fala sai sem a lista — nunca com uma inventada.
    console.error("[ayla:rotina] falha ao ler a sequência do quadro:", e instanceof Error ? e.message : e);
    return "";
  }
}

/** A lista espera a revisão e o clique da família, não o reconciliador. */
async function marcarRevisaoPendente(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("rotinas").update({ cards_status: "revisao" }).in("id", ids);
  if (error) throw error;
}

/** A rotina mais recente deste membro que está esperando um tema. */
async function rotinaAguardandoTema(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
): Promise<{ id: string; nome: string; criadaEm: string | null } | null> {
  // ⚠️ A JANELA SAIU DAQUI — Gate A, 08/09/2026. Os 6 h continuam valendo e
  // continuam sendo a decisão certa (caso "Carrinho", 08/08), mas quem os
  // guarda agora é `VALIDADE_MS.capturar_tema`, em `rotina-pendencia.ts`.
  // Cinco lugares respondiam "há rotina pendente?" com quatro janelas; o número
  // não mudou, o dono sim.
  // Aqui o caminho ESCREVE (grava tema e dispara geração), então "não sei"
  // e "não há" têm o mesmo desfecho: não capturar.
  const r = await pendenciaDeRotina(supabase, { familyId, membroId, finalidade: "capturar_tema" });
  return r.estado === "sim" && r.valor.falta === "tema"
    ? { id: r.valor.id, nome: r.valor.nome, criadaEm: r.valor.criadaEm }
    : null;
}

/** A família desistiu dos cartões desta rotina? */
function recusouTema(t: string): boolean {
  return /\b(n[ãa]o quero|sem cart|sem tema|deixa (pra l[áa]|assim)|depois eu|agora n[ãa]o|nenhum)\b/i.test(t);
}

/**
 * A FAMÍLIA ESTÁ CONCORDANDO COM O QUE FOI PROPOSTO?
 *
 * Só ACEITE puro entra aqui: uma afirmação curta que não acrescenta conteúdo
 * nenhum. "sim", "isso", "pode ser". Qualquer coisa com informação dentro
 * ("pode ser, mas tira o banho") NÃO é aceite — é ajuste, e ajuste tem que
 * chegar ao quadro.
 */
export function ehAceitePuro(texto: string | null | undefined): boolean {
  const t = (texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // Emoji e pontuação não mudam a resposta — "sim 👍" é o mesmo "sim".
    .replace(/[^\p{L}\s]/gu, "")
    .trim();
  if (!t) return false;
  return /^(sim|isso|isso mesmo|e isso|exato|exatamente|perfeito|otimo|ok|okay|blz|beleza|show|ta bom|tudo bem|pode ser|pode ser essa|pode ser este|pode ser assim|pode fazer|pode montar|pode mandar|podes|concordo|gostei|adorei|amei|ficou bom|ficou otimo|ta otimo|faz sentido|faz sentindo|vamos|bora|manda|fecha|fechado|combinado|acho que sim|por mim ta bom|do jeito que voce falou|assim mesmo|assim ta bom)$/.test(
    t,
  );
}

/**
 * A MENSAGEM RESPONDE A UMA PROPOSTA DE SEQUÊNCIA?
 *
 * ⚠️ SÓ FAZ SENTIDO COM UMA PROPOSTA PENDENTE. Quem chama já checou isso — é o
 * ESTADO que dá significado à mensagem, não a mensagem sozinha. Foi essa
 * inversão que produziu o caso Manu: "Vamos tomar sorvete depois" foi lida
 * isoladamente, e uma frase sobre a SEQUÊNCIA virou o tema visual dos cartões.
 *
 * Devolve "aceite" (pode montar o que foi proposto) ou "ajuste" (a família
 * mexeu em alguma coisa — e o que ela disse tem que entrar). Nunca devolve
 * null: com proposta na mesa, a mensagem da mãe é sobre a proposta. Mudança de
 * assunto continua sendo tratada onde sempre foi — pelo `acao:"sair"` do
 * condutor, que lê a conversa inteira e sabe julgar isso.
 */
export function lerRespostaAProposta(texto: string | null | undefined): "aceite" | "ajuste" {
  return ehAceitePuro(texto) ? "aceite" : "ajuste";
}

/**
 * A MENSAGEM É A ESCOLHA DO TEMA?
 *
 * Determinístico de propósito. A resposta "princesas" é o gatilho do turno
 * inteiro — se ela precisasse sobreviver a uma ida ao modelo e a um parser,
 * estaríamos reconstruindo exatamente a falha de 07/08/2026.
 *
 * Conservador: só reconhece resposta CURTA e sem verbo de edição. Qualquer
 * outra coisa devolve null e segue o fluxo normal, onde o condutor decide.
 *
 * ── ENDURECIDO EM 17/08/2026, DEPOIS DO CASO MANU ───────────────────────────
 *
 * O critério antigo era "curta e sem verbo de edição", e isso deixou passar
 * coisas que não são tema nenhum. PROVADO POR EXECUÇÃO contra as frases reais:
 * "sim", "isso", "pode ser", "ficou bom", "depois sorvete" e até "não, primeiro
 * o banho" viravam TEMA — e "Vamos tomar sorvete depois" (4 palavras, no limite
 * exato do filtro) virou o tema dos cartões da Manu em produção.
 *
 * ⚠️ O CONSERTO NÃO É EXIGIR MAIS PALAVRAS. Contar palavra não separa "sorvete"
 * (sequência) de "dinossauros" (tema) — as duas têm uma. O que separa é o
 * SIGNIFICADO e o ESTADO: aceite não é tema, negação não é tema, e frase que
 * fala de ORDEM ("depois", "primeiro", "no final") é sequência. A precedência
 * de estado — proposta pendente vence tema — vive em `conduzirRotina`.
 */
export function lerTemaEscolhido(texto: string | null | undefined): string | null {
  const bruto = (texto ?? "").trim();
  if (!bruto || bruto.length > 60) return null;
  if (recusouTema(bruto)) return null;
  // Pedido de mudança na rotina não é escolha de tema.
  if (/\b(muda|troca|tira|apaga|acrescenta|inclui|adiciona|edita|imprim|pdf)\w*\b/i.test(bruto)) return null;
  if (/\?$/.test(bruto)) return null;

  // "tema X" é declaração explícita e vence os filtros abaixo: quem escreve
  // "tema aventureiro" está nomeando o tema, e nenhuma heurística deve discutir.
  const declarouTema = /^\s*(o\s+)?tema\b/i.test(bruto);
  if (!declarouTema) {
    // CONCORDAR NÃO É ESCOLHER TEMA. "sim" respondia à sequência e virava o
    // tema dos cartões — o aceite sumia e a arte saía no tema "sim".
    if (ehAceitePuro(bruto)) return null;
    // NEGAR NÃO É ESCOLHER TEMA. "não, primeiro o banho" é correção.
    if (/^\s*(n[ãa]o|nem|opa|espera|pera|calma)\b/i.test(bruto)) return null;
    // FALAR DE ORDEM É FALAR DA SEQUÊNCIA, não do desenho do cartão.
    if (
      /\b(depois|antes|primeiro|primeira|[úu]ltimo|[úu]ltima|no final|no fim|no come[çc]o|no in[íi]cio|em seguida|ent[ãa]o|a[íi] sim|junto|tamb[ée]m|falta|esqueci)\b/i.test(
        bruto,
      )
    ) {
      return null;
    }
  }

  const limpo = bruto
    .replace(/^(pode ser|podia ser|prefiro|quero|queria|vamos de|faz(er)? (de|em|no|na)?|escolho|acho que|talvez|ah,?|sim,?)\s+/i, "")
    .replace(/^(no |na |em |de |do |da |o |a )?tema (de |do |da |em )?/i, "")
    .replace(/^(de|do|da|em|no|na)\s+/i, "")
    .replace(/[.!]+$/, "")
    .trim();
  if (limpo.length < 2 || limpo.length > 40) return null;
  // Uma ou duas palavras é tema; uma frase é outra coisa.
  if (limpo.split(/\s+/).length > 4) return null;
  return limpo;
}

/**
 * Resolve uma escolha NUMERADA somente contra as opções que a Ayla mostrou
 * naquele turno. O número não tem significado fora dessa pergunta: nunca é
 * reinterpretado por interesse atual, perfil alterado ou uma lista nova.
 */
export function temaPelaOpcaoExibida(
  texto: string | null | undefined,
  opcoes: readonly string[] | null | undefined,
): string | null {
  const numero = String(texto ?? "").trim().match(/^(\d{1,2})$/)?.[1];
  if (!numero) return null;
  const indice = Number(numero) - 1;
  const tema = opcoes?.[indice]?.trim();
  return tema && tema.length >= 2 && tema.length <= 40 ? tema : null;
}

async function opcoesDaPerguntaDeTema(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
  criadaEm: string | null,
): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from("ayla_messages")
      .select("metadata")
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", membroId)
      .eq("direcao", "outbound")
      .eq("tipo", "rotina_conversa")
      .gte("created_at", criadaEm ?? new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const opcoes = (data?.[0]?.metadata as { temas_oferecidos?: unknown } | undefined)?.temas_oferecidos;
    if (!Array.isArray(opcoes)) return null;
    const validas = opcoes
      .filter((tema): tema is string => typeof tema === "string")
      .map((tema) => tema.trim())
      .filter((tema) => tema.length >= 2 && tema.length <= 40)
      .slice(0, 2);
    return validas.length ? validas : null;
  } catch (e) {
    console.warn("[ayla:rotina] não conseguiu reler opções de tema:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * O CONTRATO DO CONDUTOR, COMO FERRAMENTA — não como JSON em texto.
 *
 * Em 07/08/2026 a Ayla devolveu o turno certo (`acao:"montar"`, tema
 * "princesas") e o sistema perdeu tudo: a fala dela citava a frase que a mãe
 * deveria usar — "agora vamos ao mercado" — e as aspas não escapadas quebraram
 * o `JSON.parse`. O extrator devolvia `null` em silêncio, `acao` virava "",
 * `tema` sumia, e os cartões nunca eram disparados. Três de três execuções.
 *
 * A causa não era ESTE JSON: era pedir a um modelo que escreve português
 * natural que também fosse serializador. Com tool use quem serializa é a API,
 * e a fala pode ter aspas, quebra de linha e emoji à vontade.
 */
const FERRAMENTA_CONDUTOR = {
  name: "conduzir_rotina",
  description:
    "Devolve o desfecho deste turno da conversa de rotina: o que fazer, a fala pra família e, quando for montar, a rotina em si.",
  input_schema: {
    type: "object" as const,
    properties: {
      acao: {
        type: "string",
        enum: ["responder", "perguntar", "montar", "sair"],
        description: "O desfecho deste turno.",
      },
      mensagem: {
        type: "string",
        description:
          "Sua fala pra família, como no WhatsApp. Escreva natural: aspas, travessões, quebras de linha e emoji são bem-vindos e NÃO precisam ser escapados.",
      },
      recorrente: {
        type: "boolean",
        description:
          "true SÓ quando o pedido é sobre a GRADE DA SEMANA — dias que se repetem toda semana ('as segundas', 'a semana inteira', 'organizar os dias da semana'). Um acontecimento ÚNICO é false, mesmo citando o nome do dia: 'domingo dia dos pais', 'sábado na casa da vó', 'segunda tenho dentista', 'dia 9', 'amanhã'. Na dúvida, false.",
      },
      proposta: {
        type: "array",
        description:
          'As etapas que você está PROPONDO, na ordem, quando acao="perguntar" porque você inferiu/completou/reorganizou a sequência. Só o rótulo curto de cada etapa ("Chegar ao posto", "Tomar a vacina"), do jeito que a criança veria no cartão. NÃO preencha quando estiver montando o que a família já ditou, nem quando estiver só perguntando um dado.',
        items: {
          type: "object",
          properties: {
            texto: { type: "string" },
            hora: { type: "string" },
          },
          required: ["texto"],
        },
      },
      // NÃO existe campo `tema` aqui, pelo mesmo motivo que não existe
      // `rotinas`: o tema é escolha da FAMÍLIA, capturada pelo código quando
      // ela responde. Deixar o campo era deixar a porta aberta — em 08/08/2026
      // o condutor pescou "boneca de pano" da conversa do dia anterior e
      // gerou 11 cartões de uma ida ao CINEMA nesse tema, sem perguntar nada.
      transicoes: {
        type: "array",
        description: "Momentos difíceis aprendidos nesta conversa.",
        items: {
          type: "object",
          properties: {
            momento: { type: "string" },
            estrategia: { type: "string" },
            funcionou: { type: "boolean" },
            merece_plano: { type: "boolean" },
            // ⚠️ `enum` E `required` — Gate A. O esquema é o único lugar onde a
            // classificação pode ser exigida em vez de pedida: sem ela o
            // registro nasce legado e nunca mais pode ser reusado como padrão.
            tipo: {
              type: "string",
              enum: ["padrao", "episodio"],
              description:
                "padrao = se repete na vida da criança; episodio = aconteceu uma vez ou é de uma ocasião específica. Na dúvida, episodio.",
            },
          },
          required: ["momento", "tipo"],
        },
      },
      // NÃO existe campo `rotinas` aqui. O condutor NÃO compõe o artefato —
      // quem compõe é `gerarRotina`, gerador único desde a consolidação de
      // 03/08/2026 (`rotina-servico.ts`), pelos dois canais.
      //
      // O campo existia como fóssil dessa época: o modelo gastava tokens
      // preenchendo uma sequência que `conduzirRotina` descartava sem nunca
      // ler (`parsed.rotinas`: zero ocorrências). Era a segunda composição —
      // a que prometeu 12 etapas enquanto o quadro recebia 9.
    },
    required: ["acao", "mensagem"],
  },
};

/** Bloco de resposta da API que interessa aqui — evita casar o tipo inteiro. */
type BlocoResposta = { type: string; text?: string; name?: string; input?: unknown };

/**
 * Lê o desfecho do condutor. Caminho normal: o bloco `tool_use`, já validado
 * pela API. Degradação: o modelo respondeu em prosa — aí ainda tentamos o
 * parser antigo, mas GRITANDO no log. A falha silenciosa foi o que fez este
 * defeito sobreviver semanas em produção; ela não volta.
 */
function lerDesfechoDoCondutor(resp: { content: BlocoResposta[] }): unknown {
  const ferramenta = resp.content.find(
    (b) => b.type === "tool_use" && b.name === FERRAMENTA_CONDUTOR.name,
  );
  if (ferramenta?.input && typeof ferramenta.input === "object") return ferramenta.input;

  const raw = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  const recuperado = extrairJsonRotina(raw);
  console.error(
    `[ayla:rotina] condutor não usou a ferramenta — ${
      recuperado ? "recuperado pelo parser de texto" : "DESFECHO PERDIDO"
    } (${raw.length} chars)`,
  );
  return recuperado;
}

/**
 * CONDUZ a conversa de rotina (natural, estratégica, um passo por vez). A IA
 * decide a próxima fala e, quando tem o suficiente, MONTA — aí a gente cria as
 * rotinas + aplica o tema + manda o PDF, e devolve a mensagem final com o link.
 * Enquanto não está pronto, devolve só a próxima pergunta (pronto=false).
 */
/**
 * ⚠️ SÓ TEMA EXPLICITAMENTE MARCADO — e este limite nasceu de um erro meu,
 * apanhado pelo teste com os dados reais da Karina.
 *
 * A primeira versão varria o histórico com `lerTemaEscolhido` direto. Ela
 * devolveu **"Gere"** — porque aquele extrator foi escrito para o turno logo
 * depois de "qual tema?", onde quase qualquer resposta curta É o tema. Sobre
 * histórico solto, ele captura lixo, e a rotina da Manu teria nascido com o
 * tema "Gere".
 *
 * Aqui a família precisa ter ESCRITO que aquilo é o tema. A Karina escreveu
 * "Tema princesa" na primeira mensagem; é isso que se recupera, e nada além.
 */
/**
 * As formas em que a família ENUNCIA um tema. Cada uma exige um portador — a
 * palavra que vem depois do marcador —, e é esse portador que vira o tema.
 */
const ENUNCIADOS_DE_TEMA: readonly RegExp[] = [
  /\btema[:\s]+([^\n.;!?]{2,40})/i,
  /\bdesenho\s+(?:de\s+|da\s+|do\s+)?([^\n.;!?]{2,40})/i,
  /\bquero\s+(?:de\s+|da\s+|do\s+)?([^\n.;!?]{2,40})/i,
  /\bpode\s+ser\s+(?:de\s+|da\s+|do\s+)?([^\n.;!?]{2,40})/i,
  /\b(?:faz|faça|monta|monte)\s+(?:de\s+|da\s+|do\s+|com\s+)([^\n.;!?]{2,40})/i,
  /^([^\n.;!?]{2,40}?)\s+ent[ãa]o\b/i,
];

/**
 * ⚠️ A LISTA DE RECUSA, e ela é o coração da correção.
 *
 * Palavras operacionais respondem ao PEDIDO, não nomeiam o tema. "Gere",
 * "Isso", "Manda" são a mãe autorizando — não escolhendo capivara. Sem esta
 * lista, um enunciado como "Faz" casaria com o portador vazio ou com a palavra
 * seguinte qualquer, e a rotina nasceria com um tema que ninguém pediu.
 */
const PALAVRA_OPERACIONAL =
  /^(gere?|gerar|sim|nao|não|isso|ok(ay)?|pode|podes|assim|fa[çz]a?|faz|manda|mande|mandar|perfeito|certo|beleza|blz|vai|bora|agora|favor|por favor|obrigad[ao]|entendi|exato|verdade|tudo|ambos|uhum|aham|essa|esse|isto|aquilo|ele|ela|a rotina|rotina|as imagens|imagens|figuras|cartões|cartoes|(uma? )?(rotina|sequ[êe]ncia|cart[õo]es|quadro) (visual|visuais)|montar (uma? )?(rotina|sequ[êe]ncia) visual)$/i;

/**
 * O tema enunciado numa mensagem — ou `null` quando não há evidência.
 *
 * ⚠️ NA DÚVIDA, NULL. Uma pergunta curta custa um turno; um artefato com o tema
 * errado custa a confiança da família e não se desfaz.
 */
export function temaEnunciado(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  for (const re of ENUNCIADOS_DE_TEMA) {
    const m = t.match(re);
    if (!m) continue;
    const bruto = (m[1] ?? "")
      .trim()
      .replace(/^(de|da|do|uma?|uns?|umas?)\s+/i, "")
      // ⚠️ A CONFIRMAÇÃO NÃO É O TEMA. A Maria Julia escreveu "Perfeito
      // princesa frozen então" — o "Perfeito" responde à pergunta anterior,
      // o tema é "princesa frozen". Sem esta aparadura o artefato nasceria
      // com a palavra de confirmação grudada no nome do desenho.
      .replace(/^(perfeito|isso|sim|ok|certo|beleza|exato|show|ótimo|otimo)[,!.\s]+/i, "")
      .replace(/[,;]+$/, "")
      .trim();
    if (!bruto || bruto.length < 2) continue;
    if (PALAVRA_OPERACIONAL.test(bruto)) continue;
    // ⚠️ UM TEMA É CURTO, e este limite nasceu de um falso positivo real. A
    // Karina escreveu "Quero q rotina com as imagens" — um PEDIDO — e o
    // enunciado `quero X` capturou "q rotina com as imagens" como se fosse
    // tema. Tema é "princesa", "Frozen", "capivara": no máximo três palavras.
    const palavras = bruto.split(/\s+/).filter(Boolean);
    if (palavras.length > 3 || bruto.length > 25) continue;
    // ⚠️ E NUNCA O NOME DO PRÓPRIO ARTEFATO. "rotina", "imagens", "cartões"
    // são o que ela está pedindo, não o desenho que quer neles.
    if (/\b(rotina|imagens?|cartõe?s?|cartao|figuras?|desenhos?|quadro|pdf|lista)\b/i.test(bruto)) continue;
    return bruto;
  }
  return null;
}

/**
 * O tema que a família JÁ disse, em qualquer turno recente.
 *
 * ⚠️ JANELA DE 12 HORAS E INÍCIO DA ROTINA PENDENTE. Tema de antes da criação
 * do artefato não pode ser aplicado a ele: foi o risco visto quando a mãe
 * escolheu "Fada rosa" para uma rotina e depois pediu outra com "Cozinha".
 * O tema informado no pedido inicial é tratado pelo próprio condutor.
 *
 * Lê do mais novo para o mais antigo: se a família mudou de ideia, vale a
 * última palavra dela.
 */
export async function temaJaDitoNoHistorico(
  supabase: SupabaseClient,
  familyId: string,
  criadoEm?: string | null,
): Promise<string | null> {
  try {
    const janela = Date.now() - 12 * 60 * 60 * 1000;
    const inicio = criadoEm ? Date.parse(criadoEm) : janela;
    const desde = new Date(Number.isFinite(inicio) ? Math.max(janela, inicio) : janela).toISOString();
    const { data } = await supabase
      .from("ayla_messages")
      .select("texto")
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(30);
    // ⚠️ DO MAIS NOVO PARA O MAIS ANTIGO — a `order` acima já garante isso, e é
    // a regra pedida: se a família enunciou dois temas em momentos diferentes,
    // vale o último que ela confirmou, não o primeiro que apareceu.
    for (const m of (data ?? []) as Array<{ texto: string | null }>) {
      const t = temaEnunciado(m.texto);
      if (t) return t;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Relê `cards_status` no banco e devolve a fala que esse estado sustenta.
 *
 * ⚠️ RELEITURA, NÃO MEMÓRIA. O turno inteiro trabalha com variáveis locais que
 * "sabem" o que foi feito — `autoGerou`, `faltaTema`, `pronto`. Nenhuma delas
 * serve aqui: elas descrevem a INTENÇÃO do ramo, e o bug é exatamente a
 * distância entre a intenção e o que a linha ficou. Então o portão vai ao banco
 * depois de todas as escritas do turno e pergunta como a coisa realmente ficou.
 *
 * ⚠️ FALHA DE LEITURA É TRATADA COMO "NÃO PODE AFIRMAR". Se o SELECT cair, não
 * sabemos o estado — e não saber nunca autoriza prometer. O viés é sempre para
 * a ressalva, porque o custo dela é uma frase mais modesta, e o custo do erro
 * contrário é a mãe abrindo a tela e não encontrando nada.
 */
async function conferirFalaContraOBanco(
  supabase: SupabaseClient,
  ids: string[],
  mensagem: string,
): Promise<{ texto: string; corrigida: boolean; removido: string[] }> {
  // Nenhuma rotina gravada neste turno: não há artefato sobre o qual afirmar.
  if (ids.length === 0) return { texto: mensagem, corrigida: false, removido: [] };
  let estado: EstadoDeCartoes = "aguardando";
  let temArtefato = false;
  try {
    const { data, error } = await supabase
      .from("rotinas")
      .select("cards_status, tarefas:rotina_tarefas(imagem_url)")
      .in("id", ids);
    if (error) throw new Error(error.message);
    const linhas = (data ?? []) as Array<{
      cards_status: string | null;
      tarefas?: Array<{ imagem_url: string | null }> | null;
    }>;
    // ⚠️ O PIOR ESTADO MANDA. Com duas rotinas no turno, uma pronta e outra
    // aguardando, a fala não pode afirmar conclusão — parte do que foi
    // prometido não existe. Afirmar pelo melhor caso é como o bug começou.
    const ordem: EstadoDeCartoes[] = ["erro", "aguardando", "revisao", "gerando", "pronto", "nenhum"];
    const estados = linhas
      .map((l) => (l.cards_status ?? "nenhum") as EstadoDeCartoes)
      .sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    estado = estados[0] ?? "aguardando";
    // ⚠️ A PROVA DO ARTEFATO É UMA URL DE CARTÃO EXISTENTE. `cards_status`
    // dizer "pronto" é a afirmação do gerador; `imagem_url` preenchida é o que
    // a família consegue abrir. Só a segunda autoriza dizer que está lá.
    temArtefato = linhas.some((l) => (l.tarefas ?? []).some((t) => !!t.imagem_url));
  } catch (e) {
    console.warn(
      "[ayla:rotina] portão 3 não conseguiu ler cards_status — fala tratada como não-conclusiva:",
      e instanceof Error ? e.message : e,
    );
    return falaCoerenteComEstado({ texto: mensagem, estado: "aguardando", temArtefatoVerificavel: false });
  }
  return falaCoerenteComEstado({ texto: mensagem, estado, temArtefatoVerificavel: temArtefato });
}

export async function conduzirRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; contexto: string; phoneE164?: string | null },
): Promise<{
  mensagem: string;
  pronto: boolean;
  aguardandoTema?: boolean;
  /** Opções apresentadas à família; o orquestrador as persiste para o "1" ter referente. */
  temasOferecidos?: string[];
  /** A fala afirmava conclusão que o estado não sustentava. Vira telemetria. */
  falaCorrigida?: boolean;
  /** As etapas propostas neste turno, quando a Ayla está esperando resposta. */
  proposta?: EtapaProposta[];
} | null> {
  // ⚠️ O RASTRO NASCE ANTES DO `try` e morre no `finally` — é isso que faz as
  // saídas silenciosas aparecerem. Ver `rotina-rastro.ts`: em 08/09/2026 este
  // fluxo devolveu `null` num turno real e não havia como saber por qual dos
  // dois caminhos. Nada aqui decide nada; só registra.
  const rastro = novoRastro(params.familyId, params.contexto.length);
  rastro.membro = params.membroAtipicoId;
  try {
    if (!params.contexto.trim()) {
      rastro.saida = "null_sem_contexto";
      return null;
    }

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("family_account_id, nome, data_nascimento")
      .eq("id", params.membroAtipicoId)
      .maybeSingle();
    if (!membro) {
      rastro.saida = "null_sem_membro";
      rastro.motivo = "membro_atipico não encontrado";
      return null;
    }
    const familyId = (membro.family_account_id as string) ?? params.familyId;
    const nome = (membro.nome as string) ?? "seu filho";
    const idade = idadeAnos((membro.data_nascimento as string | null) ?? null);
    // ⚠️ UMA LEITURA PARA O TURNO INTEIRO. Eram três consultas à mesma linha —
    // interesses, transições e "o que já sabemos" —, em série, a ~400 ms cada.
    // O rastro de 09:46 mediu `leituras_perfil=3`.
    // Perfil e proposta não dependem um do outro. Em produção cada ida ao
    // banco custa centenas de milissegundos; fazê-las em série atrasava todos
    // os turnos sem acrescentar segurança nem contexto.
    const [perfilDaRotina, proposta] = await etapa(rastro, "contexto", () =>
      Promise.all([
        lerPerfilDaRotina(supabase, params.membroAtipicoId),
        propostaPendente(supabase, familyId),
      ]),
    );
    rastro.leituras_perfil += 1;
    const interesses = carregarInteresses(perfilDaRotina);
    // NO MÁXIMO DUAS. O interesse conhecido vira SUGESTÃO, nunca escolha — o
    // tema é da rotina, não atributo fixo da criança. Despejar a lista inteira
    // vira formulário; oferecer uma só vira decisão disfarçada de pergunta.
    const sugestoesDeTema = (interesses ?? "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2);

    // ── A PROPOSTA NA MESA VEM ANTES DE TUDO ───────────────────────────────
    //
    // ⚠️ ORDEM É A CORREÇÃO, não um detalhe de organização. O gatilho do tema
    // ficava aqui em cima e interceptava QUALQUER mensagem curta enquanto uma
    // rotina esperava tema — inclusive as que respondiam à sequência. Foi assim
    // que "Vamos tomar sorvete depois" virou o tema visual dos cartões da Manu
    // (17/08/2026): a frase falava da sequência, e o estado que a leu primeiro
    // era o do tema.
    //
    // Com a proposta pendente lida ANTES, a pergunta que o sistema faz na
    // ordem certa é: "há uma sequência esperando resposta?" Só depois: "há uma
    // rotina esperando tema?".
    const respostaAProposta = proposta ? lerRespostaAProposta(params.contexto) : null;
    if (proposta) {
      console.log(
        `[ayla:rotina] proposta pendente (${proposta.etapas.length} etapas) — mensagem lida como "${respostaAProposta}"`,
      );
    }

    // ── GATILHO DETERMINÍSTICO DO TEMA ─────────────────────────────────────
    // A rotina existe e espera só uma palavra. Essa palavra NÃO passa por
    // modelo nem por parser: em 07/08/2026 foi exatamente assim que a escolha
    // certa ("princesas") se perdeu no caminho e os cartões nunca saíram.
    // Aqui ela vira UPDATE + disparo, direto.
    //
    // ⚠️ NÃO RODA COM PROPOSTA PENDENTE. Enquanto a família ainda não respondeu
    // sobre a SEQUÊNCIA, nenhuma mensagem dela pode ser lida como tema.
    // ⚠️ UM PEDIDO NOVO NÃO É RESPOSTA DE TEMA — 08/09/2026 09:13, produção.
    //
    // A mãe escreveu "Quero montar uma sequencia visual / Para Manu / Brincar,
    // tomar banho, almoçar, ir ao shopping". Havia uma rotina de 08:53 esperando
    // tema. Esta linha não existia: a mensagem inteira caiu no ramo do tema,
    // `lerTemaEscolhido` capturou **"sequencia visual"** como se fosse o nome
    // do desenho, e a geração disparou — na rotina ERRADA, a antiga, com as
    // etapas que a mãe não pediu. Ela recebeu o link direto, sem nunca ter sido
    // perguntada, e as imagens saíram do artefato velho.
    //
    // O ramo do tema existe para a palavra solta depois de "qual tema?". Uma
    // mensagem que pede o artefato pelo nome, ou que dita uma sequência, é
    // outra coisa — e precisa seguir para o condutor, que sabe criar rotina
    // nova. Na dúvida o custo é assimétrico: perguntar o tema de novo custa um
    // turno; gerar o artefato errado custa a confiança e já saiu no WhatsApp.
    rastro.pedido_explicito = pediuRotinaExplicitamente(params.contexto);
    rastro.ditou_sequencia = familiaDitouSequencia(params.contexto);
    const pedidoNovo = rastro.pedido_explicito || rastro.ditou_sequencia;
    rastro.pedido_novo = pedidoNovo;
    const pendente =
      proposta || pedidoNovo
        ? null
        : await rotinaAguardandoTema(supabase, familyId, params.membroAtipicoId);
    if (pedidoNovo) {
      console.log("[ayla:rotina] pedido novo — não é resposta de tema da rotina pendente");
    }
    rastro.pendente_id = pendente?.id ?? null;
    if (pendente) {
      if (recusouTema(params.contexto)) {
        rastro.saida = "tema_recusado";
        // Desistir também é um desfecho — e precisa apagar o estado, senão a
        // rotina fica "aguardando" pra sempre e a tela mente.
        await supabase
          .from("rotinas")
          .update({ cards_status: "nenhum", modo_exibicao: "lista" })
          .eq("id", pendente.id);
        console.log(`[ayla:rotina] tema recusado — rotina ${pendente.id} volta a lista`);
        return {
          mensagem: `Tranquilo — deixei *${pendente.nome}* como lista mesmo, sem os cartões. Se mudar de ideia, é só me dizer um tema que eu desenho.`,
          pronto: true,
        };
      }
      // ⚠️ O TEMA PODE TER SIDO DITO ANTES — 06/09/2026, caso Karina/Manu.
      //
      // Ela abriu o assunto com "Quero uma rotina visual / Escola adventista /
      // Tios / Perua / Casa / **Tema princesa**" numa mensagem só, às 14:42. A
      // sequência foi confirmada, a rotina nasceu em `aguardando`, e às 17:14
      // ela escreveu "E agora?" e "Consegue trazer?". `lerTemaEscolhido` lê
      // apenas a MENSAGEM ATUAL — não achou tema nenhum e o fluxo ia perguntar
      // de novo algo que ela já tinha respondido duas horas antes.
      //
      // ⚠️ ISTO NÃO É REGRA PARA "consegue trazer?". Nenhuma frase é
      // reconhecida aqui. O que muda é de ONDE o tema é lido: da conversa
      // inteira desde que a rotina nasceu, e não só do último turno. Qualquer
      // referência contextual — "cadê?", "e as figuras?", "não apareceu" —
      // chega neste mesmo ponto e encontra o dado que a família já deu DEPOIS
      // da criação desta rotina. Tema anterior pertence a outro pedido.
      //
      // ⚠️ E NÃO INVENTA NADA. Só encontra o que a própria família escreveu,
      // pelo MESMO extrator (`lerTemaEscolhido`). Sem tema no histórico, o
      // fluxo segue perguntando, como antes.
      const opcoesExibidas = await opcoesDaPerguntaDeTema(
        supabase,
        familyId,
        params.membroAtipicoId,
        pendente.criadaEm,
      );
      const escolhido = temaPelaOpcaoExibida(params.contexto, opcoesExibidas) ?? lerTemaEscolhido(params.contexto) ??
        (await temaJaDitoNoHistorico(supabase, familyId, pendente.criadaEm));
      rastro.tema = escolhido ? String(escolhido).slice(0, 60) : null;
      rastro.tema_fonte = escolhido
        ? (lerTemaEscolhido(params.contexto) ? "mensagem_atual" : "historico")
        : "nenhuma";
      if (escolhido) {
        rastro.saida = "tema_aplicado";
        rastro.rotina_ids = [pendente.id];
        rastro.rotina_reutilizada = true;
        const { error: erroTema } = await supabase.from("rotinas").update({ tema: escolhido }).eq("id", pendente.id);
        if (erroTema) {
          console.error(`[ayla:rotina] tema não gravado em ${pendente.id}: ${erroTema.message}`);
          return { mensagem: "Não consegui salvar o tema desta rotina agora. Pode me mandar o tema de novo daqui a pouco?", pronto: true };
        }
        // A família confere a sequência e inicia as imagens na página.
        // Escolher o tema no WhatsApp não equivale a apertar "Gerar cartões".
        rastro.geracao_iniciada = false;
        const link = await gerarMagicLink(supabase, {
          familyId,
          next: `/ludico/rotinas/${pendente.id}`,
        });
        console.log(
          `[ayla:rotina] tema "${escolhido}" aplicado em ${pendente.id} — aguardando revisão e clique`,
        );
        // A fala reflete o estado real. Sem 200 do gerador, ninguém promete arte.
        const corpo = `*Rotina pronta para conferir* 🌿\nTema: *${escolhido}*\n\nAbra o link e confira a ordem. Se estiver tudo certo, toque em *Gerar cartões* — as imagens só começam depois desse clique.`;
        return {
          mensagem: link
            ? `${corpo}\n\n*Rotina de ${pendente.nome}:*\n${link}`
            : corpo,
          pronto: true,
        };
      }
    }

    // Conversa desta sessão (ambas as direções, últimos 60 min) — pra a IA saber
    // o que já perguntou e o que a mãe já respondeu.
    // 12h, não 60min. A janela curta era a causa nº 1 da repetição: numa conversa
    // de WhatsApp que se estende, tudo que a mãe respondeu antes disso sumia e o
    // condutor voltava a perguntar "que horas ela acorda?".
    const desde = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    // Histórico, rotinas anteriores e irmãos são três leituras independentes.
    // O fluxo antigo esperava cada uma terminar antes de iniciar a seguinte.
    const [mensagensResultado, jaSabemos, irmaosResultado] = await etapa(
      rastro,
      "contexto",
      () => Promise.all([
        supabase
          .from("ayla_messages")
          .select("texto, direcao, tipo, created_at, membro_atipico_id")
          .eq("family_account_id", familyId)
          .gte("created_at", desde)
          .order("created_at", { ascending: false })
          .limit(40),
        carregarOQueJaSabemos(supabase, params.membroAtipicoId, perfilDaRotina),
        supabase
          .from("membros_atipicos")
          .select("id, nome")
          .eq("family_account_id", familyId)
          .eq("ativo", true),
      ]),
    );
    const msgs = mensagensResultado.data;
    // Limitar após ordenar ASC descartava precisamente os turnos MAIS
    // recentes numa conversa longa. Lemos os 40 últimos e só então voltamos
    // à ordem cronológica para interpretar pergunta → resposta.
    const historico = [...(msgs ?? [])].reverse()
      .map((m) => ({
        de: (m.direcao === "inbound" ? "mae" : "kolo") as "mae" | "kolo",
        texto: ((m.texto as string) ?? "").trim(),
        tipo: (m.tipo as string | null) ?? null,
        membroId: (m.membro_atipico_id as string | null) ?? null,
      }))
      .filter((h) => h.texto);
    if (!historico.some((h) => h.de === "mae" && h.texto === params.contexto.trim())) {
      historico.push({ de: "mae", texto: params.contexto.trim(), tipo: null, membroId: null });
    }

    // ── O QUE PERTENCE A ESTA ROTINA ───────────────────────────────────────
    // As 12h existem pra a Ayla não re-perguntar o que a mãe já respondeu NESTA
    // conversa. Só que tudo dentro delas virava matéria-prima da rotina — e foi
    // assim que "quero organizar a tarde da Manu" saiu com passeio de barco e
    // protetor solar, herdados de uma conversa de horas antes.
    //
    // A fronteira: a conversa de rotina em curso começa depois da última fala
    // da Ayla que NÃO era de rotina. O que veio antes disso é outro assunto —
    // conhece a criança, não compõe o dia.
    let inicio = 0;
    for (let i = historico.length - 1; i >= 0; i--) {
      const h = historico[i]!;
      if (h.de === "kolo" && h.tipo && h.tipo !== "rotina_conversa") {
        inicio = i + 1;
        break;
      }
    }
    const historicoDaRotina = historico.slice(inicio);

    // A família ditou a sequência NESTE turno? Decide se o quadro de conversas
    // antigas pode competir com o pedido de agora — ver `podarSequenciasAntigas`.
    const sequenciaDitadaAgora = etapasDitadasEmLinhas(params.contexto);
    const ditouAgora = familiaDitouSequencia(params.contexto);
    const transicoesConhecidas = carregarTransicoes(perfilDaRotina);
    // ⚠️ NÃO É MAIS `momento → estratégia` DE TUDO. Ver `blocoDeTransicoes`: só
    // padrão recente mantém o momento; o resto entra como estratégia sem
    // contexto. É o que impede o passeio de barco de virar etapa de hoje.
    const transicoesTxt = blocoDeTransicoes(transicoesConhecidas);

    // Todos os membros da família — só pra guarda de identidade comparar nomes.
    const irmaosRaw = irmaosResultado.data;
    const irmaos = (irmaosRaw ?? []) as Array<{ id: string; nome: string | null }>;

    // ── PORTÃO 1: ISTO DEVE VIRAR ROTINA AGORA? ────────────────────────────
    // Roda ANTES de qualquer montagem. Até 03/08/2026 quem decidia era o
    // próprio modelo, no meio da geração — e foi assim que uma bebê de 18 dias
    // ganhou uma rotina com intervalo entre mamadas, em PDF.
    const linhas = (hs: typeof historico) =>
      hs.map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`).join("\n");
    const conversaTxt = linhas(historicoDaRotina);
    // O que veio ANTES desta conversa entra rotulado como o que é: contexto.
    // Assim a prontidão consegue julgar "ela apontou pro que já contou?" sem
    // confundir aquilo com a sequência de agora.
    const anteriorTxt = inicio > 0 ? linhas(historico.slice(0, inicio)) : "";
    rastro.chamadas_llm += 1;
    const prontidaoModelo = await etapa(rastro, "prontidao", () =>
      avaliarProntidaoParaRotina({
      mensagem: params.contexto,
      conversa: conversaTxt,
      contexto: [
        jaSabemos.perfil,
        // ROTULADA, como a conversa anterior — e pelo mesmo motivo. Entrando
        // crua, uma rotina de ontem ("Tarde da Manu: Almoço → Tarefa → Brincar
        // → Banho…") era lida como a sequência de AGORA: em 04/08/2026 a mãe
        // disse só "quero organizar a rotina do dia da Manu" e o porteiro
        // devolveu "suficiente". O gerador inventou o dia, o validador barrou,
        // e ela recebeu "montei aqui, mas prefiro confirmar".
        blocoRotinaAnterior(jaSabemos.rotinaExistente, params.contexto),
        transicoesTxt,
        anteriorTxt
          ? `CONVERSA ANTERIOR (outro assunto — contexto, NÃO é a sequência de agora):\n${anteriorTxt}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      idadeMeses: idadeEmMeses((membro.data_nascimento as string | null) ?? null),
      }),
    );
    const prontidao = aplicarPisosDeRotinaDitada(prontidaoModelo, params.contexto);
    // ── PISO DO TAMANHO ────────────────────────────────────────────────────
    // Quem pediu a rotina com todas as letras recebe rotina. O modelo pode
    // achar que uma sequência curta bastaria — e pode DIZER isso na conversa —,
    // mas não troca o pedido dela por baixo.
    const pedidoExplicito = pediuRotinaExplicitamente(params.contexto);
    // Em qualquer momento da conversa: o "manda com os cartões" costuma vir um
    // turno depois do pedido da rotina.
    // SÓ O PEDIDO EM CURSO. Varria as 12h — e "cartões" dito três horas antes,
    // em outro assunto, ligava o visual de uma rotina que ninguém pediu visual.
    const historicoPediuVisual = historicoDaRotina.some(
      (h) => h.de === "mae" && pediuApoioVisual(h.texto),
    );
    const tamanho = pedidoExplicito ? "rotina" : prontidao.tamanho;
    // O apoio visual segue a NECESSIDADE, com um piso: quem pediu "rotina
    // visual" ou "cartões" recebe. Pedir rotina, sozinho, não pede cartão —
    // a rotina no app já é a entrega, e imagem que não serve custa e polui.
    const visual = prontidao.visual || historicoPediuVisual;
    console.log(
      `[ayla:rotina] prontidão=${prontidao.desfecho} tamanho=${tamanho}${
        pedidoExplicito && prontidao.tamanho !== "rotina" ? ` (piso: modelo disse ${prontidao.tamanho})` : ""
      } visual=${prontidao.visual} motivo="${prontidao.motivo}"`,
    );

    // Não é rotina: sai e deixa o reativo responder. Mesmo caminho do "sair".
    rastro.prontidao_desfecho = prontidao.desfecho;
    rastro.prontidao_motivo = (prontidao.motivo ?? "").slice(0, 200);
    rastro.prontidao_tamanho = String(prontidao.tamanho ?? "");
    rastro.prontidao_visual = Boolean(prontidao.visual);
    if (prontidao.desfecho === "nao_e_rotina") {
      rastro.saida = "null_nao_e_rotina";
      rastro.motivo = rastro.prontidao_motivo;
      return null;
    }

    // ── ORIENTAÇÃO: A MENOR AJUDA ──────────────────────────────────────────
    // A passagem se resolve com o adulto conduzindo. Nada é montado, nada é
    // persistido, nada é impresso — e a família não fica sem resposta, que era
    // o que acontecia quando isto caía em `nao_e_rotina`.
    const soOrientacao = tamanho === "orientacao" && prontidao.desfecho === "suficiente";

    // ── DUAS PERGUNTAS DIFERENTES, E ELAS ESTAVAM FUNDIDAS ─────────────────
    //
    // `prontidao === "suficiente"` significava, ao mesmo tempo, "tenho dados
    // para pensar numa sequência" E "estou autorizada a criar o artefato". São
    // coisas distintas, e confundi-las foi o que gerou a rotina da Manu em 22
    // segundos, com etapas que a Ayla inventou, sobre uma vacina que a mãe
    // tinha acabado de mencionar pedindo uma SUGESTÃO.
    //
    //   `prontidaoAutoriza` .. tenho dados suficientes (o porteiro).
    //   `familiaAutoriza` .... a família viu a sequência e concordou/corrigiu.
    //
    // A regra antiga continua inteira onde ela era certa: quando a FAMÍLIA
    // ditou a sequência, o condutor devolve "montar" e o artefato sai no mesmo
    // turno, sem burocracia nenhuma. O que deixou de existir é montar em cima
    // de suposição da Ayla sem a família ver.
    const prontidaoAutoriza = prontidao.desfecho === "suficiente" && !soOrientacao;
    const familiaAutoriza = Boolean(proposta) && !soOrientacao;

    // O que falta é a ORDEM (não o escopo, não a criança). Quem decide entre
    // propor e perguntar é o TAMANHO, logo abaixo: uma passagem curta a gente
    // consegue imaginar pela dificuldade relatada; a manhã inteira de uma casa
    // que a gente não conhece, não.
    const faltaSequencia =
      prontidao.desfecho === "falta" &&
      /sequ[êe]ncia|ordem|etapas?|passos?|o que acontece|como (?:é|e|acontece|costuma)/i.test(
        prontidao.pergunta ?? "",
      );
    const deveConduzirSequencia =
      faltaSequencia && (tamanho === "mini" || pedidoExplicito);

    // ── PERGUNTA JÁ DECIDIDA: NÃO PAGAR UMA SEGUNDA IA ───────────────────
    // O porteiro acabou de ler Perfil + conversa e decidiu, com o contrato de
    // segurança, que ainda falta escopo ou uma única informação. Antes o
    // Sonnet recebia essa decisão apenas para reescrever a pergunta: no turno
    // real da Manu foram 4,659 s adicionais, além dos 2,868 s da prontidão.
    // A proposta pendente fica fora deste atalho porque aceite/correção precisa
    // do condutor para preservar exatamente a sequência vista pela família.
    if (!proposta && prontidao.desfecho === "falta_escopo") {
      rastro.acao = "perguntar";
      rastro.saida = "pergunta_escopo_sem_condutor";
      return {
        mensagem:
          `A rotina visual mostra para ${nome} o que acontece agora e o que vem depois — isso ajuda a se preparar sem precisar adivinhar.\n\n` +
          "Qual situação está difícil hoje? Pode ser sair de casa, banho, mercado, dentista ou outra. Pode me contar do seu jeito ou mandar áudio.",
        pronto: false,
      };
    }
    if (
      !proposta &&
      prontidao.desfecho === "falta" &&
      prontidao.pergunta?.trim() &&
      // Numa passagem curta, o segundo modelo não está só reescrevendo uma
      // pergunta: ele põe uma proposta concreta na mesa. Esse valor fica.
      !deveConduzirSequencia
    ) {
      rastro.acao = "perguntar";
      rastro.saida = "pergunta_unica_sem_condutor";
      return {
        mensagem:
          `Entendi. Para os cartões ajudarem de verdade, preciso definir só uma coisa: ${prontidao.pergunta.trim()}\n\n` +
          "Depois eu sugiro a sequência e você pode trocar, tirar ou acrescentar etapas antes de gerar as imagens.",
        pronto: false,
      };
    }

    const userPrompt = [
      prontidao.desfecho === "falta_escopo"
        ? `AINDA FALTA DESCOBRIR A SITUAÇÃO QUE PRECISA DE AJUDA. NÃO pergunte dado nenhum — nem idade, nem horário, nem qual criança — e NÃO use o menu "dia inteiro / manhã / noite". Explique em uma frase que uma rotina visual mostra o que acontece agora e o que vem depois; faça UMA pergunta simples: qual situação está difícil? Dê, no máximo, exemplos leves como sair de casa, banho, mercado ou dentista e aceite texto livre ou áudio.

SE A MÃE JÁ CITOU UMA SITUAÇÃO NO PEDIDO ATUAL OU NA CONVERSA, NÃO DIGA QUE FALTA ESCOPO. Retome a situação com as palavras dela e pergunte qual trecho merece apoio: a jornada inteira ou um ponto como fila, barulho ou espera. Diga que os cartões podem antecipar os passos e trazer combinados pertinentes, como um sinal para pedir pausa. acao="perguntar".`
        : "",
      prontidao.desfecho === "falta" && prontidao.pergunta && !deveConduzirSequencia
        ? `AINDA FALTA UMA COISA pra montar: ${prontidao.pergunta}\nFaça ESSA pergunta, do seu jeito — UMA só —, e NÃO monte a rotina neste turno (acao="perguntar").`
        : "",
      // ── ESTADO 2: PROPOR O RECORTE, não perguntar a sequência ───────────
      // Quando o que falta é a ordem E o recorte é curto (uma passagem), a
      // mãe já disse o suficiente pra você PENSAR POR ELA. "Todo dia é guerra
      // pra sair do videogame e ir pro banho" não pede "como é a rotina
      // dele?" — pede uma proposta que ela confirma com uma palavra.
      // Só vale no tamanho "mini": um período inteiro não se inventa.
      deveConduzirSequencia && tamanho === "mini"
        ? `A MÃE JÁ DISSE QUAL É O MOMENTO DIFÍCIL, SÓ NÃO DISSE A ORDEM. NÃO pergunte "como é a rotina dele" — PROPONHA. Diga em uma linha que você não faria o dia inteiro, e sim só essa passagem; escreva a sequência que você montaria (3 a 5 etapas, com seta), e feche perguntando se a ordem bate com a casa dela. Ela responde "sim" ou corrige uma etapa — e aí você monta. NÃO monte neste turno: acao="perguntar".
Exemplo do formato (não copie o conteúdo): "Eu não faria uma rotina do dia inteiro pra isso — focaria nessa passagem. Montaria assim: aviso de que está terminando → salvar → guardar o controle → banho → jantar. Faz sentido essa ordem aí na sua casa?"`
        : "",
      deveConduzirSequencia && tamanho !== "mini"
        ? `O QUE FALTA É A SEQUÊNCIA. Primeiro diferencie pelo que a mãe já contou:
- SITUAÇÃO CONTIDA (banho, mercado, dentista, saída, fila, consulta ou outro acontecimento com começo e fim): proponha AGORA de 3 a 7 etapas concretas no campo \`proposta\`, usando apenas o que ela contou e passos inevitáveis. acao="perguntar". A lista exibida será a lista salva se ela responder "pode ser essa" — não escreva um exemplo descartável e não acrescente aviso, escolha, recompensa ou combinado que ela não mencionou.
- PERÍODO AMPLO (dia inteiro, manhã, tarde, noite ou semana) sem atividades suficientes: peça as atividades na ordem em que acontecem e mostre só o formato genérico, sem fingir que o exemplo é proposta. Diga que horário é opcional e ofereça áudio. acao="perguntar".
Faça UMA pergunta ou UMA proposta por turno; não peça tema, idade nem outra informação junto.`
        : "",
      soOrientacao ? ORIENTACAO_DE_TRANSICAO : "",
      // VAI HAVER CARTÃO. O TEMA É PERGUNTADO — decisão de 22/07/2026,
      // validada em role-play com a Karina, e reconfirmada pelo Sérgio em
      // 08/08. O interesse da criança serve pra a Ayla SUGERIR, não pra tirar
      // a escolha da família: o tema é da ROTINA, não atributo fixo da criança
      // (a mesma Manu tem rotina de dinossauros e rotina de princesas).
      //
      // Perguntar tinha sido removido em 03/08 porque SEGURAVA a entrega — mas
      // o que segurava não era a pergunta: era `tema=null` significar abandono
      // silencioso, sem estado e sem segunda chance. Com `cards_status
      // 'aguardando'` a pergunta deixou de ser um beco sem saída.
      // TEMA NÃO É DECISÃO DO MODELO. "Falta tema?" é estado do artefato, e
      // quem sabe disso é o código — que também conhece os interesses e faz a
      // pergunta depois da sequência, no lugar certo. Deixar os dois donos
      // perguntando foi o que produziu a pergunta ANTES da lista, em 08/08.
      // ── A FAMÍLIA JÁ RESPONDEU A PROPOSTA ────────────────────────────────
      // Este bloco vem ANTES do de montar: com a sequência já aprovada, não há
      // mais nada a decidir sobre prontidão — quem autorizou foi ela.
      proposta
        ? `VOCÊ JÁ PROPÔS ESTA SEQUÊNCIA E ELA ACABOU DE RESPONDER:
${proposta.etapas.map((e, i) => `${i + 1}. ${e.texto}${e.hora ? ` — ${e.hora}` : ""}`).join("\n")}

${
  respostaAProposta === "aceite"
    ? `Ela CONCORDOU. Monte exatamente esta sequência, sem mudar nada e sem perguntar mais nada: acao="montar". Sua fala é curta — o que você entendeu e a dica no ponto difícil. NÃO repita a lista: o sistema mostra o quadro logo abaixo.`
    : `Ela MEXEU em alguma coisa. Aplique o que ela disse SOBRE a sequência acima — acrescentar uma etapa no fim, tirar uma, trocar a ordem, mudar uma palavra — e monte: acao="montar". O resto da sequência fica EXATAMENTE como estava; não refaça o quadro inteiro por causa de um ajuste.
⚠️ O QUE ELA ACRESCENTA É DELA E ENTRA. "Vamos tomar sorvete depois" quer dizer que a sequência termina no sorvete — vira etapa, com as palavras dela. Não trate isso como tema de cartão, não trate como recompensa, e não descarte por não estar na sua proposta.`
}`
        : "",
      prontidaoAutoriza && !proposta
        ? `JÁ DÁ PRA PENSAR NA SEQUÊNCIA — a criança e o recorte estão na mesa. NÃO faça mais nenhuma pergunta de dado neste turno: horário, ponto difícil, tema e transição enriquecem, mas NÃO seguram a entrega.
SÓ DUAS SAÍDAS AQUI, e a regra CONFIRMAR OU MONTAR decide qual:
- as etapas são as que ELA deu → acao="montar".
- você está COMPLETANDO ou INVENTANDO a sequência (encaixando etapa que ela não citou, fechando o depois, mudando a ordem, imaginando como é o momento) → acao="perguntar" E preencha o campo \`proposta\` com as etapas na ordem.
⚠️ PROPOR NÃO É PERGUNTAR MAIS. É proibido devolver uma pergunta de investigação ("ele conhece bem essa pessoa?", "ele fica agitado de que jeito?") no lugar da proposta: isso gasta o turno dela sem colocar nada na mesa. Ponha a sequência na mesa e deixe ela corrigir uma etapa se quiser.
⚠️ NA DÚVIDA SOBRE DE QUEM É A SEQUÊNCIA, PROPONHA. Uma proposta custa um turno; um quadro errado a família imprime e cola na parede.`
        : "",
      tamanho === "mini" && prontidao.desfecho === "suficiente"
        ? `TAMANHO: SEQUÊNCIA CURTA. O que ajuda aqui é a criança VER a passagem, não o dia inteiro organizado. Monte de 2 a 4 etapas, só o trecho que trava (ex.: videogame → guardar → banho → pijama). Não estenda pro resto do dia, mesmo que você saiba como ele é. acao="montar".
⚠️ MAS SE A FAMÍLIA JÁ DITOU A SEQUÊNCIA, ELA VAI INTEIRA — o limite de 2 a 4 vale pro que VOCÊ inventaria, nunca pro que ELA contou. Cinco etapas ditadas viram cinco etapas no quadro. Encurtar a lista dela é perder o que ela escreveu, e foi assim que uma família perdeu as próprias etapas em 08/08/2026.`
        : "",
      prontidao.desfecho === "limite_atuacao"
        ? `LIMITE DE ATUAÇÃO — esta parte é de quem acompanha a criança, não sua: ${prontidao.parteClinica ?? "decisão clínica"}.\nOrganize TUDO o que é organização (sequência, banho, trocas, descanso, registros, logística) e NÃO decida a parte clínica. Pergunte o que o profissional já orientou e use como a família contar, sem reinterpretar. Não desista da rotina por causa disso — o que dá pra organizar já ajuda.`
        : "",
      `CRIANÇA/ADOLESCENTE/ADULTO: ${nome}${idade != null ? ` (${idade} anos)` : ""}.`,
      interesses ? `INTERESSES CONHECIDOS (pra propor tema): ${interesses}` : "",
      jaSabemos.desafios.length
        ? `DESAFIOS QUE A FAMÍLIA MARCOU NO CADASTRO (relato dela, não diagnóstico): ${jaSabemos.desafios.join(", ")}`
        : "",
      jaSabemos.perfil ? `PERFIL (o que já sabemos — NÃO re-pergunte):
${jaSabemos.perfil}` : "",
      // ⚠️ "use como base" ERA O DEFEITO — ver `blocoRotinaAnterior`. Agora os
      // dois sítios de composição deste arquivo usam a MESMA função, e ela
      // sabe calar quando a família acabou de ditar a sequência.
      blocoRotinaAnterior(jaSabemos.rotinaExistente, params.contexto),
      // ⚠️ O RÓTULO SAIU DAQUI. `blocoDeTransicoes` já devolve o texto com o
      // enquadramento certo para cada parte — "use proativamente" valia para
      // padrão conhecido e era exatamente o que mandava usar o barco.
      transicoesTxt,
      // O MESMO histórico podado que vai ao gerador — um critério, dois destinos.
      "CONVERSA (a última fala da mãe é o pedido atual):\n" +
        podarHistorico(historico, ditouAgora)
          .map((h) => `${h.de === "mae" ? "Mãe" : "Kolo"}: ${h.texto}`)
          .join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n");

    // Lista ditada + portão clínico aprovado já determinam a ação e o texto.
    // Pagar outro modelo aqui custou 6,5 s no turno real de 01/10 e ainda
    // acrescentou três etapas que a família não disse. O condutor permanece
    // para propostas, ajustes e pedidos que precisam de interpretação.
    const parsed = (sequenciaDitadaAgora && prontidaoAutoriza
      ? {
          acao: "montar",
          mensagem: `Organizei a sequência de ${nome} exatamente como você contou.`,
          proposta: [],
        }
      : await (async () => {
          const client = getAylaAnthropicClient();
          rastro.chamadas_llm += 1;
          const resp = await etapa(rastro, "condutor", () =>
            client.messages.create({
              model: AYLA_MODEL_FALLBACK,
              max_tokens: 1600,
              system: `${nucleoConducao()}\n\n${CONTRATO_ROTINA}`,
              tools: [FERRAMENTA_CONDUTOR],
              // Força a ferramenta: o turno SEMPRE volta estruturado, nunca como prosa
              // que alguém precise reinterpretar.
              tool_choice: { type: "tool", name: FERRAMENTA_CONDUTOR.name },
              messages: [{ role: "user", content: userPrompt }],
            }),
          );
          return lerDesfechoDoCondutor(resp);
        })()) as
      | {
          acao?: string;
          mensagem?: string;
          pronto?: boolean;
          recorrente?: boolean;
          transicoes?: unknown;
          proposta?: unknown;
        }
      | null;

    // "sair" é o que destrava a mudança de assunto: quem sabe se a mensagem
    // ainda é sobre a rotina é quem está lendo a conversa. Antes, uma rotina
    // pendente capturava TODA mensagem por 48h — a mãe perguntava de atividades
    // e a Ayla respondia sobre a rotina.
    const acao = String(parsed?.acao ?? "").trim().toLowerCase();
    rastro.acao = String(acao ?? "");
    if (acao === "sair") {
      rastro.saida = "null_condutor_saiu";
      rastro.motivo = "condutor devolveu acao=sair";
      return null;
    }

    let mensagem = (typeof parsed?.mensagem === "string" && parsed.mensagem.trim()) || "";

    // ── AS ETAPAS QUE A AYLA ESTÁ PROPONDO NESTE TURNO ─────────────────────
    // Só valem quando ela NÃO vai montar. Uma proposta junto de um quadro
    // pronto seria a segunda lista de novo.
    const propostaDoTurno: EtapaProposta[] = Array.isArray(
      (parsed as { proposta?: unknown } | null)?.proposta,
    )
      ? ((parsed as { proposta: unknown[] }).proposta
          .map((e) => {
            const o = (e ?? {}) as Record<string, unknown>;
            const texto = String(o.texto ?? "").trim();
            return texto ? { texto: texto.slice(0, 120), hora: o.hora ? String(o.hora) : null } : null;
          })
          .filter((e): e is EtapaProposta => e != null)
          .slice(0, 25) as EtapaProposta[])
      : [];

    // ── QUEM AUTORIZA A GERAÇÃO ────────────────────────────────────────────
    //
    // ⚠️ O `acao === "montar"` SOLTO SAIU DAQUI, e essa é a correção do
    // portão. Ele era uma SEGUNDA PORTA: com a prontidão devolvendo "falta" —
    // inclusive o "falta" que ela devolve quando FALHA —, bastava o modelo
    // dizer "montar" para o artefato sair. A falha segura protegia contra o
    // erro dela mesma e não protegia contra o modelo.
    //
    // Agora existe UMA porta com duas chaves, e as duas vêm de fora do modelo:
    //   · o porteiro diz que há dados suficientes E o condutor escolheu montar;
    //   · ou a FAMÍLIA já viu a sequência e respondeu.
    //
    // `parsed.pronto` (formato antigo) também saiu: era a mesma porta com
    // outro nome.
    const pronto =
      !soOrientacao &&
      ((prontidaoAutoriza && acao === "montar") || (familiaAutoriza && acao !== "perguntar"));

    // ⚠️ A PROPOSTA DO CONDUTOR DEIXOU DE SER DESCARTADA — 17/08/2026.
    //
    // Aqui ficava `if (deveMontar && acao !== "montar") { mensagem = "" }`: com
    // a prontidão dizendo "suficiente", o `acao:"perguntar"` do condutor era
    // ignorado e a fala dele — que era a PROPOSTA — jogada fora. A regra
    // "CONFIRMAR OU MONTAR" existia no contrato desde 08/08 e nunca chegava à
    // família. Era a causa raiz da geração prematura.
    //
    // O medo que produziu aquela linha continua legítimo: o interrogatório. Por
    // isso a saída não é "sempre perguntar", é "perguntar só quando há uma
    // PROPOSTA na mão". Pergunta sem proposta segue barrada logo abaixo.
    const propondo = !pronto && acao === "perguntar" && propostaDoTurno.length > 0;
    if (prontidaoAutoriza && acao === "perguntar" && propostaDoTurno.length === 0) {
      // Ele tinha dados e devolveu pergunta SEM colocar sequência na mesa —
      // é exatamente o turno gasto que a regra antiga queria evitar. Aqui não
      // se monta (seria montar sem a família ver); registra-se para calibrar.
      console.warn(
        `[ayla:rotina] condutor perguntou com prontidão suficiente e SEM proposta — turno gasto sem sequência na mesa`,
      );
    }
    // Nunca aceitar tema inventado pelo modelo. A família ditou a sequência,
    // não o tema das imagens. Se ainda não escolheu, a rotina fica salva e a
    // Ayla faz UMA pergunta de tema antes de iniciar as ilustrações.
    const tema: string | null =
      visual && etapasDitadasEmLinhas(params.contexto)
        ? temaEnunciado(params.contexto) ?? (ditouAgora ? null : temaConfirmadoNestaRotina(historicoDaRotina, params.membroAtipicoId))
        : null;

    // ── A AYLA NÃO É MAIS O GERADOR ────────────────────────────────────────
    // Quando decide que dá pra montar, ela DELEGA ao serviço oficial — o mesmo
    // que o app usa. Antes ela montava aqui, com as próprias regras, e as duas
    // implementações se contradiziam (a dela propunha horário; a do app
    // proibia). O que sobra pra ela é o que sempre foi seu: conduzir a
    // conversa, perceber quando é hora, e explicar o que foi montado.
    // UMA fonte só pro ponto difícil e pra estratégia: o que a conversa acabou
    // de revelar, ou o que já estava no perfil. Serve ao gerador E ao PDF.
    const trAgora = Array.isArray(parsed?.transicoes) ? (parsed.transicoes as unknown[]) : [];
    const t0 = (trAgora[0] ?? null) as { momento?: unknown; estrategia?: unknown } | null;
    // ⚠️ A SEXTA PORTA — ver `pontoDificilAtual`. Era
    // `transicoesConhecidas[0]?.momento`: o índice ZERO do array cru do perfil,
    // que para o Mario é "sudoku - frustração com puzzle complexo". Virava
    // instrução literal ao gerador e produzia a rotina de sudoku que nenhuma
    // das cinco correções anteriores alcançou — elas fechavam portas do TEXTO,
    // e esta é do DADO.
    const pontoDificilDoTurno = pontoDificilAtual(
      t0?.momento ? String(t0.momento) : null,
      transicoesConhecidas,
      ditouAgora,
    );
    // A estratégia segue o MESMO critério: o que a conversa revelou vence, e o
    // perfil só empresta quando é padrão atual. Estratégia de episódio antigo
    // continua disponível como inspiração — mas via `blocoDeTransicoes`, que a
    // entrega sem o contexto, nunca como "o que trava hoje".
    const estrategiaDoTurno =
      (t0?.estrategia ? String(t0.estrategia) : "") ||
      (pontoDificilDoTurno
        ? (transicoesConhecidas.find((t) => t.momento === pontoDificilDoTurno)?.estrategia ?? null)
        : null);

    let rotinas: ReturnType<typeof sanitizarRotinas> = [];
    /** Rotinas gravadas neste turno; vazio quando nada foi persistido. */
    let idsDoTurno: string[] = [];
    let faltaTemaFinal = false;
    if (pronto) {
      const r = await gerarRotina(supabase, {
        familyId,
        membroAtipicoId: params.membroAtipicoId,
        nome,
        idade,
        idadeMeses: idadeEmMeses((membro.data_nascimento as string | null) ?? null),
        // O gerador compõe a sequência SÓ com o pedido em curso. A janela
        // inteira volta apenas quando a mãe mandou usar o que já contou.
        // ⚠️ A QUINTA PORTA — 08/09/2026 10:58, com o alarme do turno anterior
        // apontando para cá: "ditou sequência e nasceram 2 rotinas".
        //
        // Podei o histórico no PROMPT do condutor e deixei o gerador receber o
        // ARRAY cru. Ele compõe o artefato, então era o pior lugar para
        // esquecer: as falas de 10:21 e 10:36 traziam "Sudoku (sem pressão de
        // terminar)" em linha de quadro, e ele montou "Momento sudoku" ao lado
        // da festa. Mesma poda, mesmo critério, agora nos dois destinos.
        historico: podarHistorico(
          prontidao.reusaHistorico ? historico : historicoDaRotina,
          ditouAgora,
        ),
        mensagem: params.contexto,
        // ⚠️ O TERCEIRO SÍTIO — e eu tinha migrado só dois. 08/09/2026 10:36:
        // a mãe ditou cinco etapas para o Mario, recebeu as cinco CERTAS **e uma
        // segunda rotina inventada, "Hora do sudoku"**, com quatro etapas que
        // ninguém pediu. A causa: `jaSabemos.rotinaExistente` chegava aqui CRU,
        // carregando as tarefas da rotina "Dia do Mario" de 07:33 — que tinha
        // "Respiração antes do sudoku" e "Sudoku (sem pressão de terminar)".
        //
        // `blocoRotinaAnterior` é o dono único dessa moldura desde a manhã, e
        // cala quando a família dita a sequência. Eu o apliquei nos dois prompts
        // de `conduzirRotina` e esqueci do GERADOR — que é justamente quem
        // compõe o artefato. Criar o dono não basta; é preciso não deixar sítio
        // nenhum lendo o dado cru. Um teste passa a prender isso.
        contexto: [
          jaSabemos.perfil,
          blocoRotinaAnterior(jaSabemos.rotinaExistente, params.contexto),
          transicoesTxt,
        ]
          .filter(Boolean)
          .join("\n"),
        pontoDificil: pontoDificilDoTurno,
        tamanho,
        // ── A SEQUÊNCIA ACORDADA CHEGA AO ARTEFATO ─────────────────────────
        //
        // ⚠️ MECANISMO REUSADO, NÃO CRIADO. `propostaAtual` já existia no
        // gerador — é o que o assistente da WEB usa nas idas e vindas ("ajuste
        // de uma proposta já mostrada"). O WhatsApp nunca o usou: cada turno
        // recompunha a sequência do zero a partir da conversa, e por isso o que
        // a mãe leu e o que foi gravado podiam divergir.
        //
        // Passando a proposta aprovada, o gerador ajusta o que ela pediu em
        // cima da lista que ela viu, em vez de inventar outra. É o que faz "a
        // sequência do quadro é a que foi combinada" deixar de ser uma regra
        // de prompt e virar o caminho do dado.
        propostaAtual: proposta
          ? [
              {
                nome: "Rotina",
                dia_semana: null,
                tarefas: proposta.etapas.map((e) => ({ texto: e.texto, hora: e.hora ?? null })),
              },
            ]
          : null,
        // Um aceite puro congela o quadro que a família acabou de aprovar.
        // O gerador não recebe autorização para completar, reordenar ou criar
        // etapas; ajustes explícitos continuam no caminho de propostaAtual.
        sequenciaDitada: respostaAProposta === "aceite" && proposta
          ? proposta.etapas.map((etapa) => etapa.texto)
          : sequenciaDitadaAgora,
        // A prontidão já rodou lá em cima, antes do turno de conversa.
        pularProntidao: true,
        // A guarda de identidade precisa da família inteira pra comparar o
        // texto gerado com o membro escolhido.
        membrosDaFamilia: irmaos,
      });

      if (r.desfecho === "gerou") {
        rotinas = sanitizarRotinas(r.rotinas);
        // ── RECORRÊNCIA É PROPRIEDADE DO PEDIDO, NÃO DA PALAVRA ──────────
        // O gerador lia "domingo" no texto e escrevia dia_semana=6 — e um
        // acontecimento único virava grade semanal. Só em 3 semanas foram 18
        // de 22 pedidos: cada um perdeu o link (ia pra grade em vez da
        // rotina), perdeu a pergunta do tema e terminou com ZERO cartões.
        //
        // Agora quem decide é o pedido, declarado num campo. E duas ou mais
        // rotinas num pedido só podem ser grade — ninguém pede dois
        // acontecimentos únicos de uma vez —, então isso confirma sozinho.
        const recorrente = parsed?.recorrente === true || rotinas.length > 1;
        if (!recorrente) {
          const tinhaDia = rotinas.filter((x) => x.dia_semana != null).length;
          if (tinhaDia) {
            console.log(`[ayla:rotina] acontecimento único — ${tinhaDia} dia(s) de semana descartado(s)`);
          }
          rotinas = rotinas.map((x) => ({ ...x, dia_semana: null }));
        }
        // TEMA TEM UM DONO SÓ: A FAMÍLIA. O gerador também extraía um — e em
        // 08/08/2026 devolveu "Dia dos Pais" como TEMA VISUAL de uma rotina
        // do Dia dos Pais. Não é interesse da criança, é o nome do evento; e
        // bastava existir pra pular a pergunta e queimar 13 ilustrações num
        // tema que ninguém escolheu.
      } else {
        // Barrada, ou o gerador não devolveu nada: NÃO publica. A Ayla continua
        // conversando — o comportamento seguro em falha é texto, nunca um
        // artefato degradado.
        console.warn(`[ayla:rotina] serviço não gerou — ${r.desfecho}: ${r.motivo}`);
        const clinico = r.desfecho === "barrada" && r.falhas.some((f) => f.codigo === "manejo_clinico");
        return {
          mensagem: clinico
            ? `Consigo organizar bastante coisa do dia — a sequência, o banho, as trocas, o descanso, e o que vale anotar. Só a parte de horários e quantidades de mamada/alimentação eu não decido: isso segue com quem acompanha ${nome}. Me conta o que a pediatra já orientou sobre isso? Aí eu encaixo do jeito que ela falou e monto o resto em volta.`
            : `Pra montar esse quadro eu preciso da sequência do jeito que ela acontece aí — eu organizo, mas quem sabe o dia de vocês é você. Me manda na ordem, simples assim: café → escola → almoço → brincar → banho → jantar → dormir. Horário é opcional, e pode mandar áudio que eu transcrevo.`,
          pronto: false,
        };
      }
    }

    // Aprendizado: guarda no Kolo Vivo as transições difíceis + estratégia.
    if (Array.isArray(parsed?.transicoes) && parsed.transicoes.length) {
      const aprendidas: Transicao[] = (parsed.transicoes as unknown[])
        .map((t): Transicao | null => {
          const o = (t ?? {}) as Record<string, unknown>;
          const momento = String(o.momento ?? "").trim();
          if (!momento) return null;
          return {
            momento,
            estrategia: o.estrategia ? String(o.estrategia) : null,
            funcionou: typeof o.funcionou === "boolean" ? o.funcionou : null,
            merece_plano: typeof o.merece_plano === "boolean" ? o.merece_plano : null,
            // ⚠️ SÓ ACEITA O QUE O CONTRATO PREVÊ. Qualquer outra coisa vira
            // `null`, que é lido como legado — nunca como padrão atual. Um
            // modelo que responda "recorrente" não promove nada por engano.
            tipo: o.tipo === "padrao" || o.tipo === "episodio" ? o.tipo : null,
          };
        })
        .filter((t): t is Transicao => t != null);
      await salvarTransicoes(supabase, params.membroAtipicoId, aprendidas);
    }

    // ── PORTÃO 2: ISTO PODE SER PUBLICADO? ─────────────────────────────────
    // Depois da montagem, antes de gravar/PDF/link. Não existe "piso" de
    // rotina: ou ela está boa, ou não se publica. Em falha a Ayla CONVERSA —
    // organiza o que dá e devolve a parte clínica a quem acompanha a criança.
    if (pronto && rotinas.length) {
      const tarefas = rotinas.flatMap((r) =>
        (r.tarefas ?? []).map((t) => ({ texto: t.texto, hora: t.hora })),
      );
      const veredito = validarRotina({ tarefas, baseDeHorarios: `${conversaTxt}\n${jaSabemos.rotinaExistente}` });
      if (!veredito.ok) {
        console.warn(
          `[ayla:rotina] PUBLICAÇÃO BARRADA — ${resumirFalhas(veredito.falhas)}`,
        );
        const clinico = veredito.falhas.some((f) => f.codigo === "manejo_clinico");
        // Nada é gravado, nenhum PDF sai, nenhum link é mandado como se
        // estivesse pronto. A Ayla continua útil pelo texto.
        return {
          mensagem: clinico
            ? `Consigo te ajudar a organizar bastante coisa do dia ${nome ? `${nome === "seu filho" ? "" : "d"}${nome === "seu filho" ? "" : "a "}` : ""}— a sequência, o banho, as trocas, o descanso, e o que vale anotar. Só que a parte de horários e quantidades de mamada/alimentação eu não decido: isso segue com quem acompanha ${nome}. Me conta o que a pediatra já orientou sobre isso? Aí eu encaixo do jeito que ela falou e monto o resto em volta.`
            : `Pra montar esse quadro eu preciso da sequência do jeito que ela acontece aí — eu organizo, mas quem sabe o dia de vocês é você. Me manda na ordem, simples assim: café → escola → almoço → brincar → banho → jantar → dormir. Horário é opcional, e pode mandar áudio que eu transcrevo.`,
          pronto: false,
        };
      }

      const ids: string[] = [];
      for (const r of rotinas) {
        // Aceitar uma proposta abre um novo quadro. A edição de uma rotina
        // existente já tem rota própria (`editarRotina`); reusar só porque o
        // gerador chamou ambas de "Rotina" substituiria silenciosamente um
        // artefato anterior, contra D-R3 da especificação.
        const id = await aplicarRotina(
          supabase,
          familyId,
          params.membroAtipicoId,
          r,
          tema,
          visual,
          !pedidoNovo && !proposta,
        );
        if (id) ids.push(id);
      }
      // As rotinas que ESTE turno persistiu — é sobre elas que o portão 3
      // relê o estado antes de deixar a fala sair.
      idsDoTurno = ids;
      // PDF só quando imprimir serve: ela pediu, ou já pediu em algum momento
      // desta conversa (o "manda em PDF" costuma vir um turno depois).
      // Mesma fronteira do visual: "imprimir" de outro assunto não manda PDF.
      const querImprimir = historicoDaRotina.some(
        (h) => h.de === "mae" && pediuParaImprimir(h.texto),
      );
      if (params.phoneE164 && querImprimir) {
        await entregarPdfDaRotina(supabase, {
          familyId,
          phoneE164: params.phoneE164,
          nome,
          tema,
          rotinas,
          pontoDificil: pontoDificilDoTurno,
          fraseDeApoio: estrategiaDoTurno,
        });
      }
      // Destino do link: rotina de DIA DA SEMANA → tabela da semana; UM dia avulso
      // ("Dia do circo") → aquela rotina; vários avulsos → a lista de rotinas.
      const temSemana = rotinas.some((r) => r.dia_semana != null);
      const next = temSemana
        ? "/ludico/rotinas/semana"
        : ids.length === 1
          ? `/ludico/rotinas/${ids[0]}`
          : "/ludico/rotinas";

      // Auto-gerar DIA ÚNICO (tema): a mãe abre e já está gerando/pronto. A
      // semana fica sob demanda (a mãe pede "a rotina de terça" — ver pedirRotinaDoDia).
      // CARTÕES POR NECESSIDADE, NÃO POR TEMA. Antes bastava existir um tema
      // pra a geração disparar — o interesse virava gatilho de artefato. A
      // ordem certa é a inversa: o visual entra quando VER ajuda, e o tema
      // personaliza depois, se houver.
      // O gerador de cartões EXIGE tema (>= 2 caracteres) — sem ele a chamada
      // volta 400 e nenhuma imagem sai, em silêncio. Então aqui o disparo é
      // condicionado de verdade, e o caso "precisa de cartão mas não temos
      // tema" vira uma pergunta na mensagem, nunca um silêncio.
      // ── ESTADO DERIVADO DO ARTEFATO, NÃO DO RAMO ──────────────────────
      // `faltaTema` tinha um `!temSemana` na frente. Era o buraco: numa rotina
      // marcada como semanal a fala PERGUNTAVA o tema e o estado não guardava
      // pendência nenhuma — a mensagem saía como `rotina_pronta`, a conversa
      // fechava, e a resposta da mãe ("Carrinho") caía no reativo genérico e
      // virava carrinho de supermercado. Karina, 07/08/2026.
      //
      // A condição agora é só o que descreve o artefato: quer cartão, existe
      // rotina, não tem tema. Se perguntamos, esperamos — e se esperamos,
      // geramos quando ela responder. As duas pontas usam a MESMA condição.
      const faltaTema = visual && ids.length > 0 && !tema;
      faltaTemaFinal = faltaTema;
      rastro.rotina_ids = ids;
      rastro.rotina_reutilizada = false;
      // ⚠️ ALARME DE ARTEFATO A MAIS — 08/09/2026. Quando a família DITOU a
      // sequência, o turno tem de produzir UMA rotina. Duas significa que algo
      // do passado virou artefato novo: foi assim que "Hora do sudoku" nasceu
      // ao lado da festa do Mario, com quatro etapas que ninguém pediu.
      // Não bloqueia — a rotina certa foi criada e a família precisa dela. Mas
      // sobe para `warn` e fica contável, em vez de depender de alguém reparar.
      if (ditouAgora && ids.length > 1) {
        rastro.motivo = `ditou sequência e nasceram ${ids.length} rotinas`;
        console.warn(`[ayla:rotina] ARTEFATO A MAIS — ${ids.length} rotinas num turno ditado`);
      }
      rastro.tema = tema ? String(tema).slice(0, 60) : null;
      rastro.tema_fonte = tema
        ? (tema === "Dia a dia" ? "neutro" : temaEnunciado(params.contexto) ? "mensagem_atual" : "historico_confirmado")
        : "nenhuma";
      rastro.status_final = visual && ids.length ? "revisao" : "nenhum";
      rastro.geracao_iniciada = false;
      if (visual && ids.length) {
        // ESTADO OPERACIONAL VERDADEIRO. Antes ficava `cards_status="nenhum"`,
        // indistinguível de "ninguém pediu cartão". `revisao` registra que a
        // lista visual existe, mas a família ainda precisa conferir e iniciar
        // as imagens. Diferente de `aguardando`, o reconciliador não o consome.
        await marcarRevisaoPendente(supabase, ids);
        console.warn(
          `[ayla:rotina] rotina visual em revisao — aguardando clique para gerar`,
        );
      }

      // ── UM OBJETIVO POR TURNO ──────────────────────────────────────────
      // Enquanto falta o tema, a Ayla quer UMA escolha e mais nada. Em
      // 07/08/2026 o turno saiu com três chamadas à ação coladas — escolha um
      // tema, abra o link, peça o PDF. Enquanto falta tema, nem sequer criamos
      // um token que não será entregue: além de simplificar a conversa, evita
      // uma escrita e uma ida ao banco sem utilidade. O link nasce no turno
      // seguinte, já com o tema escolhido.
      const link = ids.length && !faltaTema
        ? await gerarMagicLink(supabase, { familyId, next })
        : null;
      const fechamento = faltaTema
        ? `*Rotina de ${nome} salva para conferir* 🌿`
        : sequenciaDitadaAgora
          ? `*Rotina visual de ${nome}*\nOrganizei os passos na ordem que você me contou:`
        : mensagem || `Organizei a rotina de ${nome} 🌿`;
      // As etapas, lidas do quadro. A fala do condutor vem antes (o que ele
      // entendeu, a dica, a frase de antecipação); a lista vem daqui.
      const sequencia = await sequenciaDoQuadro(supabase, ids);
      // A ENTREGA CONCRETA é a rotina no app. O PDF é opção de impressão, e a
      // frase tem que dizer a verdade sobre o que existe agora.
      // ROTINA COMPLETA PEDIDA → OS CARTÕES SÃO O PRODUTO. Uma coisa é a mãe
      // trazer uma transição difícil (aí a menor ajuda resolve, e empurrar
      // cartão é vender ferramenta). Outra é ela pedir "quero organizar a
      // rotina do dia" e mandar a sequência inteira: aí a Kolo agrega ao
      // transformar aquilo em algo que a criança usa. Decisão do Sérgio,
      // 04/08/2026 — e a oferta vem DEPOIS de organizar, nunca na primeira
      // fala: perguntar tema antes de entender o dia é formulário.
      const ofereceCartoes =
        !visual && pedidoExplicito && tamanho === "rotina" && !temSemana;
      // A conversa segue ABERTA enquanto a resposta dela ainda pode virar
      // imagem — vale pro tema que falta e pra oferta que acabou de sair.
      if (ofereceCartoes) faltaTemaFinal = true;
      // E NÃO PROMETE PRAZO. "1-2 minutinhos" era uma promessa que a gente
      // quebrava: as gerações medidas em 08/08/2026 levaram 2min18, 2min38 e
      // 3min08. Dizer que aparecem "conforme ficarem prontos" é verdade em
      // qualquer duração — e a mãe não fica olhando o relógio.
      //
      // A FRASE SEGUE O ESTADO OPERACIONAL, não a intenção. "Já comecei a
      // gerar" só é verdade quando o disparo aconteceu; enquanto falta o tema,
      // o que existe é uma pergunta em aberto — e dizer outra coisa é prometer
      // arte que ninguém pediu pra desenhar ainda.
      // DONO ÚNICO. Antes o código só perguntava SE o modelo não tivesse
      // perguntado (`!/tema|cartões/.test(mensagem)`) — dois donos, e a ordem
      // saía torta: a pergunta vinha na fala do modelo, ANTES da sequência.
      // Agora o modelo está proibido de tocar no assunto e a pergunta é daqui,
      // depois do quadro, sempre no mesmo lugar.
      //
      // A personalização não se perdeu: `sugestoesDeTema` sai dos interesses
      // reais da criança (`carregarInteresses`), a mesma fonte que alimenta os
      // chips de tema na web. Onde o interesse existe como dado, a sugestão é
      // dela; onde só existe como prosa no perfil, cai no convite aberto.
      const cartoes = faltaTema || ofereceCartoes
          ? `\n\n${perguntaDeTema(nome, sugestoesDeTema)}`
          : visual && ids.length
            ? `\n\n*Próximos passos*\n\n1️⃣ *Confira a rotina*\nAbra o link, veja a ordem e o tema. Você pode editar ou incluir uma etapa.\n\n2️⃣ *Gere os cartões*\nSe estiver tudo certo, toque em *Gerar cartões*. As imagens começam depois desse clique.`
          : "";
      const impresso = querImprimir
        ? "\n\nTe mandei também um *PDF pra imprimir* (com quadradinhos pra marcar)."
        : "";
      const orient = `${cartoes}${impresso}`;
      // A dica OFERECE duas coisas (editar e imprimir). Enquanto falta o tema
      // ela some junto com o link, pelo mesmo motivo: neste turno a Ayla tem um
      // objetivo só. Editar e imprimir continuam existindo — entram no turno
      // seguinte, quando os cartões já estão a caminho e há o que abrir.
      // `impresso` fica: é fato consumado (o PDF já foi enviado), não oferta.
      const dica = faltaTema || visual
        ? ""
        : querImprimir
          ? "\n\nSe quiser mudar uma etapa ou um horário, é só me falar aqui que eu ajusto."
          : "\n\nSe quiser mudar uma etapa ou um horário, é só me falar. E se quiser imprimir pra colar na parede, eu te mando em PDF.";
      // A sequência entra ENTRE a fala e o resto: a mãe lê o que a Ayla
      // entendeu, vê o quadro exatamente como ficou, e só então os cartões, o
      // link e as opções.
      const quadro = sequencia ? `\n\n${sequencia}` : "";
      mensagem = faltaTema
        // Uma escolha por vez. Neste turno a família vê a sequência e escolhe
        // o tema. O link entra no turno seguinte, depois da resposta — não
        // compete com a pergunta nem cria duas chamadas para ação.
        ? `${fechamento}${quadro}${orient}`
        : link
          ? `${fechamento}${quadro}${orient}\n\n*Abra a rotina de ${nome}*\n${link}${dica}`
          : `${fechamento}${quadro}${orient}${dica}`;
    }

    // ── A PROPOSTA É IMPRESSA PELO CÓDIGO, DA MESMA FONTE QUE SERÁ GRAVADA ──
    //
    // Mesma decisão de `sequenciaDoQuadro`: a lista que a família lê e a lista
    // que o sistema guarda são o MESMO dado, renderizado uma vez. O condutor
    // escreve a fala; as etapas vêm do campo estruturado. Assim não existe
    // "uma sequência no WhatsApp e outra no estado".
    if (propondo) {
      const lista = propostaDoTurno
        .map((e, i) => `${i + 1}. ${e.texto}${e.hora ? ` — ${e.hora}` : ""}`)
        .join("\n");
      const fecho = /\?\s*$/.test(mensagem)
        ? "" // o condutor já terminou perguntando; não perguntar duas vezes
        : "\n\nFaz sentido assim ou você mudaria alguma parte?";
      mensagem = `${mensagem}\n\n${lista}${fecho}`;
    }

    if (!mensagem) {
      rastro.saida = "null_sem_mensagem";
      rastro.motivo = "condutor não produziu fala";
      return null;
    }
    // AGUARDANDO O TEMA: a rotina existe, mas os cartões dependem de uma
    // palavra que ainda não veio. A conversa fica ABERTA (tipo rotina_conversa)
    // pra que a próxima mensagem dela — "pode ser dinossauros" — volte pra cá
    // e o tema seja aplicado. Se fechássemos com "rotina_pronta", a resposta
    // dela cairia na conversa comum e o tema morreria ali, sem cartão nenhum.
    // ── PORTÃO 3: A FALA PODE AFIRMAR ISTO? ────────────────────────────────
    // ⚠️ O ÚLTIMO PONTO ANTES DA FAMÍLIA. Os portões 1 e 2 decidem se a rotina
    // pode ser montada e publicada. Este decide se a FRASE que sai é verdade —
    // e ele não pergunta ao modelo nem ao ramo do código: relê `cards_status`
    // no banco, depois de todas as escritas do turno.
    //
    // Foi assim que "Pronto! A rotina da Manu está montada" saiu com a rotina
    // em `aguardando`. O ramo "achava" que tinha terminado; a linha do banco
    // dizia outra coisa; ninguém confrontou as duas.
    const conferida = await conferirFalaContraOBanco(
      supabase,
      idsDoTurno,
      formatarMensagemDaRotina(mensagem),
    );
    if (conferida.corrigida) {
      console.warn(
        `[ayla:rotina] fala afirmava conclusão sem estado — ${conferida.removido.length} trecho(s) retirado(s)`,
      );
    }

    // ⚠️ O CAMINHO DE SUCESSO TAMBÉM SE DECLARA — e faltava. O turno real de
    // 09:46, que funcionou, saiu no rastro como `saida=null` e
    // `rotina:indefinido`: eu instrumentei as saídas de falha e esqueci a de
    // êxito. Telemetria com furo é o que o commit anterior existia para não
    // ter, e um desfecho conhecido nunca pode chegar como indefinido.
    rastro.saida = propondo ? "propos" : pronto && rotinas.length > 0 ? "montou" : "perguntou";
    return {
      mensagem: conferida.texto,
      pronto: pronto && rotinas.length > 0,
      aguardandoTema: faltaTemaFinal,
      temasOferecidos: faltaTemaFinal ? sugestoesDeTema : undefined,
      falaCorrigida: conferida.corrigida,
      // Quem persiste é o orquestrador (é ele que fala com `ayla_messages`).
      // Devolver as etapas aqui é o que faz a proposta sobreviver ao turno.
      proposta: propondo ? propostaDoTurno : undefined,
    };
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha:", e instanceof Error ? e.message : e);
    rastro.saida = "null_excecao";
    rastro.motivo = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
    return null;
  } finally {
    // ⚠️ `finally`, e não uma chamada antes de cada `return`. São nove saídas
    // nesta função; a que nos cegou em 08/09 foi justamente uma que ninguém
    // lembraria de instrumentar. O `finally` não tem como esquecer.
    void registrarRastro(rastro);
  }
}

// ---------- "Traga a rotina de hoje / de terça" ----------

const DIAS_MAP: Record<string, number> = {
  segunda: 0,
  terça: 1,
  terca: 1,
  quarta: 2,
  quinta: 3,
  sexta: 4,
  sábado: 5,
  sabado: 5,
  domingo: 6,
};

/** Dia da semana (0=Seg..6=Dom) em um fuso, com offset de dias (hoje=0, amanhã=1). */
function diaSemanaEmTz(tz: string | null | undefined, offsetDias: number): number {
  const base = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "America/Sao_Paulo",
    weekday: "short",
  }).format(base);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

function resolverDia(texto: string, tz: string | null | undefined): number | null {
  const t = (texto ?? "").toLowerCase();
  if (/\bhoje\b/.test(t)) return diaSemanaEmTz(tz, 0);
  if (/\bamanh[ãa]\b/.test(t)) return diaSemanaEmTz(tz, 1);
  for (const [nome, d] of Object.entries(DIAS_MAP)) if (t.includes(nome)) return d;
  return null;
}

/** Pedido pra VER uma rotina de um dia (traga/manda/mostra a rotina de hoje/terça…). */
export function pedeRotinaDeUmDia(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (!/\brotina\b/.test(t)) return false;
  const temDia = /\bhoje\b|\bamanh[ãa]\b|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo/.test(t);
  const temVerbo = /\b(traga|traz|tras|manda|mandar|mostra|mostrar|me v[êe]|quero ver|abre|abrir|puxa|puxar|ver a)\b/.test(
    t,
  );
  // NÃO é criar/montar (isso é o condutor).
  const ehCriar = /\b(criar|cria|montar|monta|monte|fazer|faz|fa[çc]a)\b/.test(t);
  return temDia && temVerbo && !ehCriar;
}

/**
 * A mãe pediu "a rotina de hoje/terça". Resolve o dia (pelo fuso), acha a rotina,
 * gera os cartões se faltar (um dia por vez) e devolve o link. Null se não deu.
 */
export async function pedirRotinaDoDia(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string;
    texto: string;
    timezone?: string | null;
  },
): Promise<string | null> {
  try {
    const dia = resolverDia(params.texto, params.timezone);
    if (dia == null) return null;

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("nome")
      .eq("id", params.membroAtipicoId)
      .maybeSingle();
    const nome = (membro?.nome as string) ?? "seu filho";
    const nomeDia = DIAS_LABEL[dia];

    const { data: rot } = await supabase
      .from("rotinas")
      .select("id, tema, cards_status")
      .eq("membro_atipico_id", params.membroAtipicoId)
      .eq("family_account_id", params.familyId)
      .eq("dia_semana", dia)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!rot) {
      return `Ainda não montamos a rotina de ${nomeDia} 🌿 Quer montar agora? É só me contar como é esse dia (pode ser áudio).`;
    }

    const rotinaId = rot.id as string;
    const tema = (rot.tema as string | null) ?? null;
    const status = (rot.cards_status as string | null) ?? "nenhum";

    const link = await gerarMagicLink(supabase, { familyId: params.familyId, next: `/ludico/rotinas/${rotinaId}` });
    const extra = tema && (status === "nenhum" || status === "aguardando" || status === "erro")
      ? " Confira as etapas no link e toque em *Gerar cartões* quando estiver tudo certo."
      : "";
    const base = `Aqui está a rotina de *${nomeDia}* do(a) ${nome} 🗓️${extra}`;
    return link ? `${base}\nAbre aqui:\n${link}` : base;
  } catch (e) {
    console.warn("[ayla:rotina-guiada] pedirRotinaDoDia falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------- Editar/corrigir uma rotina pela Ayla ----------

/**
 * Reforço de regex pro gate de EDIÇÃO ("tira o vôlei da rotina", "muda a rotina
 * de hoje"). A IA de intenção (`intent.ts`) é o sinal primário; aqui a régua é
 * DELIBERADAMENTE estreita, porque falso positivo neste gate reescreve a rotina
 * da família sem ela ter pedido nada.
 *
 * Incidente 25/07 (rotina do André): um desabafo — "tive que contratar um
 * prestador pra ARRUMAR um vazamento... HOJE já está melhor" — casava verbo de
 * edição + dia da semana e a Ayla foi lá e refez o dia. Então:
 * - dia/"hoje" NÃO basta: a vida da mãe também acontece "hoje";
 * - precisa citar a rotina (ou cartões/quadro/passos) com essas palavras;
 * - desabafo é longo e narrativo, pedido de ajuste é curto — texto comprido sai.
 * Pedido legítimo mas indireto ("faltou o lanche na terça") segue coberto pela
 * IA de intenção, que é quem deve entender isso.
 */
export function pedeEditarRotina(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim().toLowerCase();
  if (!t || t.length > 220) return false;
  const editVerbo =
    /\b(faltou|falta|tira|tirar|tire|remove|remover|remova|adiciona|adicionar|acrescenta|acrescentar|p[õo]e|poe|coloca|colocar|muda|mudar|mude|troca|trocar|corrige|corrigir|arruma|arrumar|inverte|inverter|esqueci)\b/.test(
      t,
    );
  if (!editVerbo) return false;
  return /\brotina\b|\bcart[õo]es?\b|\bquadro\b|\bpassos?\b|\betapas?\b/.test(t);
}

const SYSTEM_EDITAR = `Você edita uma rotina que já existe. Recebe as TAREFAS ATUAIS (JSON) e o PEDIDO da mãe.

ANTES DE TUDO: confira se a mensagem é MESMO um pedido pra mudar o quadro de rotina. Se ela só está CONTANDO como foi o dia, desabafando, ou falando de algo da vida dela que não é o quadro (uma obra em casa, uma crise, o trabalho), devolva {"tarefas":[]} e nada mais — não invente etapa nenhuma a partir da história dela. Melhor não mexer do que mexer sem ela pedir.

Se for pedido de verdade, devolva pela ferramenta \`reescrever_tarefas\` as tarefas ATUALIZADAS, aplicando o pedido (adicionar / remover / mudar texto / mudar horário / reordenar) e MANTENDO tudo que ela NÃO mencionou. HORÁRIO é opcional (null se não tiver; nunca invente). Encaixe no lugar lógico (ex.: "lanche depois da escola" entra logo após a escola). Texto curto (1-5 palavras). NÃO invente atividades além do que ela pediu. Se NÃO for pedido de mudança, devolva a lista vazia.`;

/**
 * Mesmo contrato-como-ferramenta do condutor, pelo mesmo motivo — e aqui não é
 * hipótese: existe rotina em produção com a etapa `Aviso: "logo vamos embora
 * do circo"`. Uma aspa dentro do texto de um passo derrubava a edição inteira,
 * e `sanitizarTarefasSimples(null)` devolvia lista vazia, que este fluxo lê
 * como "não era pedido de mudança". A mãe pedia, e nada acontecia.
 */
const FERRAMENTA_EDITAR = {
  name: "reescrever_tarefas",
  description: "Devolve a lista completa de tarefas da rotina depois de aplicar o pedido da família.",
  input_schema: {
    type: "object" as const,
    properties: {
      tarefas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            texto: { type: "string", description: "Curto. Pode conter aspas — não escape nada." },
            hora: { type: ["string", "null"] },
          },
          required: ["texto"],
        },
      },
    },
    required: ["tarefas"],
  },
};

const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g"); // marcas de combinação (pós-NFD)

const normalizarTexto = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(ACENTOS, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Backstop determinístico: uma edição de verdade PRESERVA a rotina. Se a lista
 * nova joga fora mais da metade das etapas que existiam, não foi edição — foi a
 * IA reescrevendo o quadro a partir de uma mensagem que não era pedido (caso
 * André, 25/07). Aí é melhor não gravar nada e responder conversando.
 */
function edicaoPreservaRotina(atuais: TarefaProposta[], novas: TarefaProposta[]): boolean {
  if (atuais.length < 3) return true; // rotina curta: qualquer mudança é grande
  const novos = new Set(novas.map((t) => normalizarTexto(t.texto)));
  const mantidas = atuais.filter((t) => novos.has(normalizarTexto(t.texto))).length;
  return mantidas >= Math.ceil(atuais.length / 2);
}

/** Linha de tarefa como ela está no banco — com a arte que já custou imagem. */
type TarefaLinha = {
  id: string;
  texto: string;
  hora: string | null;
  ordem: number;
  imagem_url: string | null;
};

/**
 * Casa a lista nova com as linhas que já existem, pelo texto (sem acento/caixa).
 * Quem casa é ATUALIZADO no lugar — mantém id, `concluida` e, principalmente, a
 * ILUSTRAÇÃO já gerada. Quem não casa é insert (passo novo) ou delete (passo que
 * ela pediu pra tirar).
 *
 * Antes isso era um delete-tudo + insert-tudo: mudar um horário torrava a arte
 * dos 8 cards e obrigava a regenerar tudo (caso André, 25/07).
 */
function casarTarefas(
  atuais: TarefaLinha[],
  novas: TarefaProposta[],
): {
  manter: Array<{ id: string; hora: string | null; ordem: number; temArte: boolean }>;
  inserir: Array<{ texto: string; hora: string | null; ordem: number }>;
  remover: string[];
} {
  const disponiveis = new Map<string, TarefaLinha[]>();
  for (const t of atuais) {
    const k = normalizarTexto(t.texto);
    const lista = disponiveis.get(k);
    if (lista) lista.push(t);
    else disponiveis.set(k, [t]);
  }

  const manter: Array<{ id: string; hora: string | null; ordem: number; temArte: boolean }> = [];
  const inserir: Array<{ texto: string; hora: string | null; ordem: number }> = [];
  const usados = new Set<string>();

  novas.forEach((nova, ordem) => {
    const candidatos = disponiveis.get(normalizarTexto(nova.texto));
    const casada = candidatos?.shift();
    if (casada) {
      usados.add(casada.id);
      manter.push({ id: casada.id, hora: nova.hora, ordem, temArte: !!casada.imagem_url });
    } else {
      inserir.push({ texto: nova.texto, hora: nova.hora, ordem });
    }
  });

  return { manter, inserir, remover: atuais.filter((t) => !usados.has(t.id)).map((t) => t.id) };
}

function sanitizarTarefasSimples(bruto: unknown): TarefaProposta[] {
  if (!Array.isArray(bruto)) return [];
  const out: TarefaProposta[] = [];
  for (const t of bruto.slice(0, 30)) {
    const o = (t ?? {}) as Record<string, unknown>;
    const texto = String(o.texto ?? "").trim().slice(0, 120);
    if (!texto) continue;
    const hora = o.hora == null ? null : String(o.hora).trim().slice(0, 10);
    out.push({ texto, hora: hora || null });
  }
  return out;
}

/**
 * Edita a rotina que a mãe pediu (dia mencionado, senão a mais recente): carrega
 * as tarefas atuais, aplica a mudança (IA) e regrava. Se tinha cartões no tema,
 * regenera. Devolve confirmação + link.
 */
/**
 * A mensagem é FEEDBACK sobre uma rotina que já existe?
 *
 * ⚠️ A ÂNCORA É O PONTO. "Não funcionou" é das frases mais ambíguas do
 * produto: pode ser sobre a rotina, um plano, um remédio, a escola. Tirar
 * cartão por palavra-chave solta custa à família o quadro que ela montou.
 *
 * Então exige DUAS coisas, não uma: uma leitura confiável do que ela disse E
 * que a fala toque no quadro daquele membro — pelo nome (rotina, cartões,
 * sequência) ou por uma etapa que está lá dentro. Sem as duas, devolve null e
 * a mensagem segue como conversa normal.
 */
/**
 * ENTREGA O ARTEFATO IMPRIMÍVEL — e devolve SÓ o que aconteceu de verdade.
 *
 * Devolve `null` quando não há nada determinístico a fazer (nenhuma rotina pra
 * apontar já é tratado com texto próprio; `null` fica pro caso de erro de
 * leitura). Nunca devolve uma frase de sucesso sem o envio ter sido aceito.
 */
export async function entregarArtefatoImprimivel(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string;
    texto: string;
    phoneE164: string;
    nome: string;
  },
): Promise<string | null> {
  try {
    const { data: rots } = await supabase
      .from("rotinas")
      .select("id, nome, tema, cards_status, dia_semana, created_at")
      .eq("family_account_id", params.familyId)
      .eq("membro_atipico_id", params.membroAtipicoId)
      .order("created_at", { ascending: false })
      .limit(5);
    const lista = (rots ?? []) as Array<{
      id: string;
      nome: string;
      tema: string | null;
      cards_status: string | null;
      dia_semana: number | null;
      created_at: string;
    }>;
    if (lista.length === 0) return RESPOSTA_PDF.semRotina;

    // DUAS PLAUSÍVEIS: uma pergunta curta, e só. Nada de pedir a sequência de
    // novo — ela já deu, e repetir foi metade do estrago do caso real.
    const recentes = lista.filter((r) => r.dia_semana == null);
    const candidatas = recentes.length > 0 ? recentes : lista;
    // ACABOU DE SAIR = É ESSA. Quando a rotina mais nova nasceu há minutos, ela
    // é o referente do "PDF" que veio logo depois — perguntar "qual delas?"
    // seria fazer a família repetir o que acabou de acontecer na tela dela.
    // Só há dúvida de verdade quando nenhuma é claramente a da conversa.
    const idadeMin =
      (Date.now() - new Date(candidatas[0].created_at).getTime()) / 60_000;
    const acabouDeSair = idadeMin <= 30;
    if (!acabouDeSair && candidatas.length > 1 && candidatas[0].nome !== candidatas[1].nome) {
      return RESPOSTA_PDF.qualDelas([candidatas[0].nome, candidatas[1].nome]);
    }
    const rot = candidatas[0];

    if (alvoDoPedido(params.texto) === "cartoes") {
      const status = rot.cards_status ?? "nenhum";
      const link =
        (await gerarMagicLink(supabase, {
          familyId: params.familyId,
          next: `/ludico/rotinas/${rot.id}`,
        })) ?? "";
      if (status === "pronto") {
        // Os cartões existem: o PDF deles existe, e vive na rota do app.
        return link
          ? `Os cartões dessa rotina estão prontos 💛 O PDF pra recortar tá aqui:
${link}`
          : RESPOSTA_PDF.falhou;
      }
      if (status === "gerando") return RESPOSTA_PDF.cartoesJaGerando(link);
      if (!rot.tema) {
        // Sem tema não há cartão — e inventar um seria decidir pela família.
        return `Pra fazer os cartões eu preciso de um tema pra ilustrar 🌿 Do que ${params.nome} gosta mais?`;
      }
      await dispararGeracao(rot.id, rot.tema);
      return RESPOSTA_PDF.cartoesGerando(link);
    }

    // PDF SIMPLES: imediato, e NÃO depende de cards_status.
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("texto, hora, ordem")
      .eq("rotina_id", rot.id)
      .order("ordem", { ascending: true });
    const linhas = ((tarefas ?? []) as Array<{ texto: string; hora: string | null }>).map((t) => ({
      texto: t.texto,
      hora: t.hora ?? null,
    }));
    if (linhas.length === 0) return RESPOSTA_PDF.semRotina;

    const enviou = await entregarPdfDaRotina(supabase, {
      familyId: params.familyId,
      phoneE164: params.phoneE164,
      nome: params.nome,
      tema: rot.tema,
      rotinas: [{ nome: rot.nome, dia_semana: rot.dia_semana, tarefas: linhas }],
    });
    // A ÚNICA linha que autoriza dizer "enviei".
    return enviou ? RESPOSTA_PDF.enviado : RESPOSTA_PDF.falhou;
  } catch (e) {
    console.warn("[ayla:pdf-rota]", e instanceof Error ? e.message : e);
    return RESPOSTA_PDF.falhou;
  }
}

type RotinaParaRetomar = {
  id: string;
  nome: string;
  cards_status: string | null;
  created_at: string;
};

function normalizarBuscaDeRotina(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g)
    ?.filter((p) => !new Set(["traz", "traga", "manda", "mostra", "abre", "quero", "rotina", "sequencia", "cartoes", "essa", "aquela", "para"]).has(p)) ?? [];
}

async function rotinasDaCrianca(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
): Promise<RotinaParaRetomar[] | null> {
  const { data, error } = await supabase
    .from("rotinas")
    .select("id, nome, cards_status, created_at")
    .eq("family_account_id", familyId)
    .eq("membro_atipico_id", membroId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    console.warn("[ayla:rotina] não consegui ler as rotinas para retomada:", error.message);
    return null;
  }
  return (data ?? []) as RotinaParaRetomar[];
}

/** Lista títulos reconhecíveis, sem criar nem alterar nenhum artefato. */
export async function listarRotinasDaCrianca(
  supabase: SupabaseClient,
  params: { familyId: string; membroId: string; nome: string },
): Promise<string | null> {
  const rotinas = await rotinasDaCrianca(supabase, params.familyId, params.membroId);
  if (rotinas === null) return null;
  if (!rotinas.length) {
    return `Ainda não criamos uma sequência para ${params.nome}. Me conta uma situação que está difícil e eu te ajudo a montar a primeira.`;
  }
  const nomes = [...new Set(rotinas.map((r) => r.nome.trim()).filter(Boolean))].slice(0, 8);
  return `Já criamos estas sequências para ${params.nome}:\n${nomes.map((nome, i) => `${i + 1}. ${nome}`).join("\n")}\n\nQual você quer abrir ou ajustar?`;
}

/**
 * Reabre uma sequência pelo nome, sem gerar uma cópia. O resumo permite que a
 * mãe se localize no WhatsApp; o link autenticado é onde os cartões e a edição
 * continuam vivos.
 */
export async function trazerRotinaExistente(
  supabase: SupabaseClient,
  params: { familyId: string; membroId: string; nome: string; texto: string },
): Promise<string | null> {
  const rotinas = await rotinasDaCrianca(supabase, params.familyId, params.membroId);
  if (rotinas === null || !rotinas.length) return null;

  const termos = normalizarBuscaDeRotina(params.texto);
  const pontuadas = rotinas
    .map((rotina) => {
      const titulo = normalizarBuscaDeRotina(rotina.nome);
      return { rotina, pontos: termos.filter((termo) => titulo.includes(termo)).length };
    })
    .filter((item) => item.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || b.rotina.created_at.localeCompare(a.rotina.created_at));

  const melhor = pontuadas[0];
  if (!melhor || (pontuadas[1] && pontuadas[1].pontos === melhor.pontos)) {
    const nomes = [...new Set(rotinas.map((r) => r.nome.trim()).filter(Boolean))].slice(0, 5);
    return `Encontrei mais de uma sequência para ${params.nome}. Qual delas você quer abrir?\n${nomes.map((nome, i) => `${i + 1}. ${nome}`).join("\n")}`;
  }

  const { data: tarefas, error } = await supabase
    .from("rotina_tarefas")
    .select("texto, ordem")
    .eq("rotina_id", melhor.rotina.id)
    .order("ordem", { ascending: true })
    .limit(8);
  if (error) {
    console.warn("[ayla:rotina] não consegui ler as etapas para retomada:", error.message);
    return null;
  }
  const etapas = ((tarefas ?? []) as Array<{ texto: string }>).map((t) => t.texto.trim()).filter(Boolean);
  const link = await gerarMagicLink(supabase, {
    familyId: params.familyId,
    next: `/ludico/rotinas/${melhor.rotina.id}`,
  });
  if (!link) return null;

  const resumo = etapas.length
    ? `\n${etapas.map((etapa, i) => `${i + 1}. ${etapa}`).join("\n")}`
    : "";
  const estado = melhor.rotina.cards_status === "pronto"
    ? "Os cartões estão prontos aqui:"
    : "A sequência está aqui para você revisar ou continuar criando os cartões:";
  return `Claro — aqui está “${melhor.rotina.nome}”.${resumo}\n\n${estado}\n${link}`;
}

export async function lerFeedbackDaRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; texto: string },
): Promise<FeedbackRotina | null> {
  const feedback = classificarFeedbackRotina(params.texto);
  if (!feedback) return null;
  try {
    const { data: rot } = await supabase
      .from("rotinas")
      .select("id")
      .eq("family_account_id", params.familyId)
      .eq("membro_atipico_id", params.membroAtipicoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rot) return null;
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("texto")
      .eq("rotina_id", (rot as { id: string }).id);
    const etapas = ((tarefas ?? []) as Array<{ texto: string }>).map((t) => t.texto);
    return falaDoQuadro(params.texto, etapas) ? feedback : null;
  } catch {
    return null;
  }
}

export async function editarRotina(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string;
    texto: string;
    timezone?: string | null;
    phoneE164?: string | null;
    /**
     * Quando a mensagem foi FEEDBACK ("já faz sozinho", "não funcionou até o
     * jantar") e não pedido de edição. Muda a instrução do editor e registra o
     * resultado na rotina — ver `rotina-feedback.ts`.
     */
    feedback?: FeedbackRotina | null;
  },
): Promise<string | null> {
  try {
    const dia = resolverDia(params.texto, params.timezone);
    type RotSel = { id: string; nome: string; tema: string | null; cards_status: string | null };
    let rot: RotSel | null = null;

    if (dia != null) {
      const { data } = await supabase
        .from("rotinas")
        .select("id, nome, tema, cards_status")
        .eq("membro_atipico_id", params.membroAtipicoId)
        .eq("family_account_id", params.familyId)
        .eq("dia_semana", dia)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) rot = data as unknown as RotSel;
    }
    if (!rot) {
      const { data } = await supabase
        .from("rotinas")
        .select("id, nome, tema, cards_status")
        .eq("membro_atipico_id", params.membroAtipicoId)
        .eq("family_account_id", params.familyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) rot = data as unknown as RotSel;
    }
    if (!rot) return "Não achei uma rotina pra ajustar 🌿 Me diz qual dia, ou a gente monta uma nova.";

    const rotinaId = rot.id;
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("id, texto, hora, ordem, imagem_url")
      .eq("rotina_id", rotinaId)
      .order("ordem", { ascending: true });
    const linhas = (tarefas ?? []) as unknown as TarefaLinha[];
    const atuais = linhas.map((t) => ({ texto: t.texto, hora: t.hora ?? null }));

    // FEEDBACK É RESULTADO, mesmo que a edição não saia. Grava antes: é isto
    // que tira a rotina da fila do follow-up e evita a mãe receber "você
    // chegou a testar?" no dia seguinte a ter contado que funcionou.
    if (params.feedback) {
      await supabase
        .from("rotinas")
        .update({
          resultado: params.feedback.resultado,
          resultado_nota: params.texto.slice(0, 500),
          resultado_em: new Date().toISOString(),
        })
        .eq("id", rotinaId)
        .then(undefined, () => {});
      // "Não funcionou, mas não sei onde" não edita nada — pergunta.
      if (params.feedback.acao === "investigar" || params.feedback.acao === "nenhum") return null;
    }

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 1200,
      system: params.feedback
        ? `${SYSTEM_EDITAR}

${instrucaoDeAjuste(params.feedback)}`
        : SYSTEM_EDITAR,
      tools: [FERRAMENTA_EDITAR],
      tool_choice: { type: "tool", name: FERRAMENTA_EDITAR.name },
      messages: [
        {
          role: "user",
          content: `TAREFAS ATUAIS:\n${JSON.stringify({ tarefas: atuais })}\n\nPEDIDO DA MÃE: ${params.texto}`,
        },
      ],
    });
    const usou = resp.content.find(
      (b) => b.type === "tool_use" && b.name === FERRAMENTA_EDITAR.name,
    ) as { input?: unknown } | undefined;
    let parsed = (usou?.input ?? null) as { tarefas?: unknown } | null;
    if (!parsed) {
      const raw = resp.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
      parsed = extrairJsonRotina(raw) as { tarefas?: unknown } | null;
      console.error(
        `[ayla:rotina] editor não usou a ferramenta — ${parsed ? "recuperado" : "PEDIDO PERDIDO"}`,
      );
    }
    const novas = sanitizarTarefasSimples(parsed?.tarefas);
    // Vazio = a IA reconheceu que a mensagem não era pedido de mudança.
    if (!novas.length) return null;
    // E, mesmo dizendo que era, não gravamos uma reescrita que joga a rotina
    // fora — null aqui devolve a conversa pro fluxo normal (a Ayla responde
    // o que ela contou, em vez de mexer no quadro).
    if (!edicaoPreservaRotina(atuais, novas)) {
      console.warn(
        `[ayla:rotina-guiada] edição descartada (reescreveria a rotina ${rotinaId}): ${atuais.length} etapas → ${novas.length}`,
      );
      return null;
    }

    // DIFF, não delete-tudo: passo que continua igual fica onde está, com a
    // ilustração dele. Só o que ela mexeu vira insert/delete.
    const { manter, inserir, remover } = casarTarefas(linhas, novas.slice(0, 25));

    for (const m of manter) {
      await supabase
        .from("rotina_tarefas")
        .update({ hora: m.hora ? m.hora.slice(0, 10) : null, ordem: m.ordem })
        .eq("id", m.id)
        .eq("rotina_id", rotinaId);
    }
    if (remover.length) {
      await supabase.from("rotina_tarefas").delete().in("id", remover).eq("rotina_id", rotinaId);
    }
    if (inserir.length) {
      await supabase.from("rotina_tarefas").insert(
        inserir.map((t) => ({
          rotina_id: rotinaId,
          texto: t.texto.slice(0, 120),
          hora: t.hora ? t.hora.slice(0, 10) : null,
          icone: null,
          ordem: t.ordem,
        })),
      );
    }

    // Cartões: só chama o gerador se a mudança REALMENTE pede desenho novo —
    // passo que entrou (não tem card) ou saiu (a história cita a sequência).
    // Trocar horário ou reordenar não redesenha nada: a arte vive na linha da
    // tarefa e acompanha a nova ordem. E a geração PRESERVA o que já existe,
    // ilustrando só os cards faltantes, com o mesmo mascote.
    const tinhaCartoes = !!rot.tema && (rot.cards_status === "pronto" || rot.cards_status === "gerando");
    const precisaDesenho = inserir.length > 0 || remover.length > 0;
    const vaiRegerar = tinhaCartoes && precisaDesenho;
    if (vaiRegerar && rot.tema) {
      await supabase.from("rotinas").update({ cards_status: "nenhum" }).eq("id", rotinaId);
      await dispararGeracao(rotinaId, rot.tema, { preservarArte: true });
    }

    const link = await gerarMagicLink(supabase, { familyId: params.familyId, next: `/ludico/rotinas/${rotinaId}` });
    const regen = !vaiRegerar
      ? ""
      : inserir.length === 0
        ? " Tô refazendo a historinha com a mudança (uns minutinhos)."
        : inserir.length === 1
          ? " Tô desenhando o cartão novo (uns minutinhos)."
          : " Tô desenhando os cartões novos (uns minutinhos).";
    const base = `Pronto, ajustei a rotina *${rot.nome}* 🌿${regen}`;
    return link ? `${base}\nAbre aqui:\n${link}` : base;
  } catch (e) {
    console.warn("[ayla:rotina-guiada] editarRotina falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}
