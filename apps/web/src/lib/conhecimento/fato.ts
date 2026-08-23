import {
  SUBCAMPOS_DOMINIO,
  subcamposDe,
  parsearSubcampos,
  type SubCampo,
} from "@/lib/kolo-vivo/subcampos";
import { MEMBRO_CAMPOS_TOPLEVEL, MEMBRO_CAMPOS_EXTRAS } from "@/lib/kolo-vivo/campos";

/**
 * CONTRATO CANÔNICO DE FATO — o que a Kolo aceita aprender sobre uma criança.
 *
 * ── por que este arquivo existe ───────────────────────────────────────────
 *
 * A aquisição de conhecimento estava partida em dois cérebros. O WhatsApp
 * extraía UM fato por turno (`parser.ts`, campo singular
 * `texto_kolo_vivo_sugerido`), sem ver o perfil atual, e depois gastava uma
 * SEGUNDA chamada de modelo (`rotearFatoSubcampo`) só pra descobrir em que
 * sub-campo ele morava. A web extraía N fatos por chamada, já com o sub-campo
 * dentro, já vendo o perfil, e já tratando evolução — mas só quando a mãe
 * clicava "Guardar no Perfil".
 *
 * MEDI (21/08/2026): o canal com o extrator fraco carrega ~97% do volume —
 * 2.657 mensagens no WhatsApp contra 84 conversas na web; 555 diários pela
 * Ayla contra 20 pelo app. O extrator bom quase não roda.
 *
 * Consequência prática, e é a que importa: **a mesma frase da mesma mãe produz
 * conhecimento diferente conforme o canal.** Este arquivo é o contrato único
 * que os dois canais passam a respeitar depois da normalização da entrada.
 *
 * ── o que é deste arquivo, e o que NÃO é ──────────────────────────────────
 *
 * Aqui só mora o que é DETERMINÍSTICO: o vocabulário, a identidade do fato, a
 * procedência e as guardas. Nada aqui chama modelo. O extrator (`extrair.ts`)
 * chama; este arquivo julga o que ele devolveu.
 *
 * A regra que governa o julgamento:
 *
 *   **É melhor perder um fato do que ensinar à Ayla algo falso sobre uma
 *   criança.** Toda guarda daqui falha FECHADA — rejeita e diz por quê. Nada
 *   é "adaptado" em silêncio pra caber.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1 · IDENTIDADE DO FATO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `habilidade_id` é o endereço estável de uma informação no Mapa da Criança:
 * `dominio` ou `dominio.subcampo`.
 *
 * ⚠️ NUNCA vem do modelo. É DERIVADO de (campo, subcampo) por esta função. O
 * modelo escolhe campo e sub-campo dentro de um vocabulário fechado; a chave
 * canônica é montada aqui. Um id inventado pelo modelo seria um domínio que
 * não existe — e domínio que não existe é fato que ninguém vai ler de novo.
 *
 * Este é o mesmo endereço que o futuro Mapa de Conhecimento vai usar como
 * chave de junção. Por isso ele se estabiliza AGORA, antes de qualquer
 * importação de material externo.
 */
export function habilidadeId(campo: string, subcampo?: string | null): string {
  const c = (campo ?? "").trim();
  const s = (subcampo ?? "").trim();
  return s ? `${c}.${s}` : c;
}

/** Desmonta um `habilidade_id` de volta em (campo, subcampo). */
export function partesDaHabilidade(id: string): { campo: string; subcampo: string | null } {
  const i = (id ?? "").indexOf(".");
  if (i < 0) return { campo: id ?? "", subcampo: null };
  return { campo: id.slice(0, i), subcampo: id.slice(i + 1) || null };
}

/** Todo `habilidade_id` que existe hoje. É a lista fechada — nada fora dela. */
export function vocabularioHabilidades(): string[] {
  const out: string[] = [];
  for (const campo of [...MEMBRO_CAMPOS_TOPLEVEL, ...MEMBRO_CAMPOS_EXTRAS]) {
    const subs = SUBCAMPOS_DOMINIO[campo];
    if (!subs || subs.length === 0) {
      out.push(campo);
      continue;
    }
    for (const s of subs) out.push(habilidadeId(campo, s.key));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · PROCEDÊNCIA — decidida pelo pipeline, nunca pelo modelo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * QUEM afirmou.
 *
 * ⚠️ A distinção que este campo existe pra proteger:
 *
 *   a mãe diz "ele não aponta"           → `familia` — é um relato
 *   a Ayla conclui "talvez tenha         → `ayla`    — é uma leitura NOSSA
 *   dificuldade de atenção compartilhada"
 *
 * As duas coisas nunca podem virar a mesma linha no perfil. Uma leitura nossa
 * que se disfarça de relato da família é a Ayla se citando como fonte — e a
 * conversa seguinte trata a hipótese como fato dado pela mãe.
 */
export type Por = "familia" | "ayla" | "sistema";

/**
 * POR ONDE entrou.
 *
 * ⚠️ Estes valores foram conferidos contra o que os pipelines REALMENTE
 * produzem hoje — não é uma taxonomia desejada:
 *
 *   `web_conversa`     — `conversar/actions.ts`, após "Guardar no Perfil"
 *   `web_diario`       — `registrar/diario/actions.ts`
 *   `whatsapp_texto`   — webhook da Ayla, mensagem escrita
 *   `whatsapp_audio`   — webhook da Ayla, depois do Whisper
 *   `onboarding`       — DECLARADO, ainda não produzido: o onboarding grava o
 *                        perfil direto (`onboarding/actions.ts:499` e
 *                        `salvar-conversacional.ts:162`), sem passar por
 *                        extrator. Fica na lista porque é o próximo candidato
 *                        óbvio, e um enum que muda depois é migração.
 *
 * `whatsapp_texto` e `whatsapp_audio` são o MESMO cérebro com entradas
 * diferentes. A distinção existe pra medir — áudio hoje produz muito menos
 * fato que texto — e não pra ramificar lógica.
 */
export type Via =
  | "web_conversa"
  | "web_diario"
  | "whatsapp_texto"
  | "whatsapp_audio"
  | "onboarding";

export type Procedencia = {
  por: Por;
  via: Via;
  /** ISO. Vem de quem chama — nunca de `new Date()` aqui dentro, senão o teste
   *  não consegue congelar o tempo e a simulação vira ruído. */
  em: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3 · O FATO
// ─────────────────────────────────────────────────────────────────────────────

/** O que o modelo devolve, antes de qualquer julgamento. */
export type FatoCandidato = {
  camada: "camada1" | "camada2";
  campo: string;
  subcampo?: string | null;
  /** O conteúdo. Em seletor, tem que ser EXATAMENTE uma das opções. */
  valor: string;
  operacao: "adicionar" | "reescrever";
  /**
   * TRECHO LITERAL da fala da família que sustenta o fato.
   *
   * Não é decoração: é a única prova verificável por código de que o fato veio
   * da mãe e não do modelo. A guarda confere por substring contra a entrada
   * normalizada — se não casar, o "fato" foi inventado no caminho.
   */
  citacao?: string | null;
  /** `true` = leitura da Ayla. `false` = a família afirmou. */
  inferido?: boolean;
};

/** O que sobreviveu às guardas e pode ser aplicado. */
export type FatoAceito = {
  habilidade_id: string;
  camada: "camada1" | "camada2";
  campo: string;
  subcampo: string | null;
  valor: string;
  operacao: "adicionar" | "reescrever";
  citacao: string | null;
  inferido: boolean;
  procedencia: Procedencia;
};

/**
 * As quatro classes que a missão pediu que ficassem separadas.
 *
 *   A `relato`      — a família afirmou, com citação comprovada. Persiste.
 *   B `leitura`     — a Ayla inferiu, mas ancorada em citação comprovada.
 *                     Persiste SÓ com `por: "ayla"`, e nunca se confunde com A.
 *   C `hipotese`    — a Ayla inferiu sem âncora. Serve ao turno, NÃO persiste.
 *   D (rejeitado)   — não vira classe; vira `FatoRejeitado` com motivo.
 */
export type ClasseFato = "relato" | "leitura" | "hipotese";

export type FatoRejeitado = {
  candidato: FatoCandidato;
  motivo: MotivoRejeicao;
  detalhe: string;
};

export type MotivoRejeicao =
  | "camada_invalida"
  | "campo_desconhecido"
  | "camada1_sem_membro"
  | "subcampo_desconhecido"
  | "valor_vazio"
  | "valor_fora_das_opcoes"
  | "subcampo_incompativel_com_o_estado"
  | "citacao_ausente"
  | "citacao_nao_comprovada"
  | "inferencia_sem_ancora";

export const CAMPOS_CAMADA2 = ["composicao", "rotina", "recursos", "dinamica"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 4 · AS GUARDAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `compativel` — exatamente o que a web já rejeitava hoje, mais as duas guardas
 *   determinísticas que só recusam dado inválido (enum e condicional). Não
 *   exige citação, porque o prompt de hoje não pede citação: exigir seria
 *   apagar 100% dos fatos da web num deploy.
 *
 * `estrito` — o modo para onde os dois canais vão depois que o prompt passar a
 *   pedir citação. Exige âncora e não persiste inferência solta.
 */
export type ModoGuarda = "compativel" | "estrito";

export type ResultadoGuardas = {
  aceitos: FatoAceito[];
  rejeitados: FatoRejeitado[];
  /** Classe C: inferência sem âncora. Útil ao turno, fora do perfil. */
  hipoteses: FatoCandidato[];
};

/**
 * Julga os candidatos do modelo contra o vocabulário e o estado atual.
 *
 * `estadoAtual` é o texto por domínio como está gravado hoje. Serve a UMA
 * guarda: a condicional (`mostrarSe`). Sem ele a guarda condicional é pulada,
 * e isso é explícito — não silencioso.
 */
export function avaliarFatos(params: {
  candidatos: FatoCandidato[];
  temMembro: boolean;
  entradaNormalizada: string;
  procedenciaBase: { via: Via; em: string };
  modo?: ModoGuarda;
  estadoAtual?: Record<string, string>;
}): ResultadoGuardas {
  const {
    candidatos,
    temMembro,
    entradaNormalizada,
    procedenciaBase,
    modo = "compativel",
    estadoAtual = {},
  } = params;

  const aceitos: FatoAceito[] = [];
  const rejeitados: FatoRejeitado[] = [];
  const hipoteses: FatoCandidato[] = [];

  const reject = (candidato: FatoCandidato, motivo: MotivoRejeicao, detalhe: string) => {
    rejeitados.push({ candidato, motivo, detalhe });
  };

  // ⚠️ A GUARDA CONDICIONAL PRECISA OLHAR O LOTE, NÃO SÓ O BANCO.
  //
  // "Ele começou a formar frases de três palavras" produz DOIS fatos no mesmo
  // lote: `comunicacao.forma = "Fala frases"` e `comunicacao.vocabulario =
  // "frases de três palavras"`. O segundo só é válido se `forma` for "Fala
  // frases" — e no banco `forma` ainda diz "Fala palavras soltas".
  //
  // Julgar contra o banco puro rejeitaria o fato CERTO. Por isso o estado
  // efetivo é o do banco com os seletores do próprio lote já sobrepostos.
  const seletoresDoLote = new Map<string, string>();
  for (const c of candidatos) {
    const subs = subcamposDe(c.campo);
    if (!subs || !c.subcampo) continue;
    const def = subs.find((s) => s.key === c.subcampo);
    if (def?.opcoes && def.opcoes.some((o) => igual(o, c.valor))) {
      seletoresDoLote.set(habilidadeId(c.campo, c.subcampo), canonizar(def.opcoes, c.valor));
    }
  }

  for (const c of candidatos) {
    // 1. camada
    if (c.camada !== "camada1" && c.camada !== "camada2") {
      reject(c, "camada_invalida", String(c.camada));
      continue;
    }

    // 2. camada1 exige uma criança — fato de criança sem criança não tem dono
    if (c.camada === "camada1" && !temMembro) {
      reject(c, "camada1_sem_membro", c.campo);
      continue;
    }

    // 3. campo dentro do vocabulário fechado
    const camposValidos =
      c.camada === "camada1"
        ? [...MEMBRO_CAMPOS_TOPLEVEL, ...MEMBRO_CAMPOS_EXTRAS]
        : (CAMPOS_CAMADA2 as readonly string[]);
    if (!(camposValidos as readonly string[]).includes(c.campo)) {
      reject(c, "campo_desconhecido", c.campo);
      continue;
    }

    // 4. valor não vazio
    const valor = (c.valor ?? "").trim();
    if (!valor) {
      reject(c, "valor_vazio", c.campo);
      continue;
    }

    // 5. sub-campo dentro do domínio
    //
    // ⚠️ MUDANÇA DELIBERADA DE COMPORTAMENTO. A web de hoje, ao receber um
    // sub-campo inválido, o troca por `null` — e `aplicarTextoCampo` então cai
    // no ÚLTIMO sub-campo do domínio, que quase sempre é "Outras observações".
    // O fato não some: ele é arquivado no lugar errado, calado. Aqui ele é
    // rejeitado com motivo, que é a única forma de alguém descobrir.
    const subs = subcamposDe(c.campo);
    let subcampo: string | null = null;
    let def: SubCampo | undefined;
    if (subs) {
      if (c.subcampo) {
        def = subs.find((s) => s.key === c.subcampo);
        if (!def) {
          reject(c, "subcampo_desconhecido", `${c.campo}.${c.subcampo}`);
          continue;
        }
        subcampo = def.key;
      } else {
        // Sem sub-campo declarado num domínio que tem sub-campos: o
        // comportamento antigo (cair no último) é preservado, porque é o
        // caminho por onde o texto livre legitimamente entra.
        def = subs[subs.length - 1];
        subcampo = def.key;
      }
    }

    // 6. seletor: valor tem que ser EXATAMENTE uma das opções
    //
    // MEDI em produção (22/08/2026): 258 seletores preenchidos, 1 fora do enum
    // — `comunicacao.forma = "Fala frases curtas"`, quando o válido é "Fala
    // frases". 0,4% de falso positivo, e o estrago que evita é grande: um
    // seletor corrompido quebra as condicionais (`mostrarSe`) e faz
    // `detectarMarcos` inventar um marco na próxima escrita, porque a string
    // mudou sem a criança ter mudado.
    let valorFinal = valor;
    if (def?.opcoes) {
      if (!def.opcoes.some((o) => igual(o, valor))) {
        reject(c, "valor_fora_das_opcoes", `${habilidadeId(c.campo, subcampo)}="${valor}"`);
        continue;
      }
      valorFinal = canonizar(def.opcoes, valor);
    }

    // 7. condicional: o sub-campo faz sentido no estado em que a criança está?
    if (def?.mostrarSe) {
      const chave = habilidadeId(c.campo, def.mostrarSe.campo);
      const doLote = seletoresDoLote.get(chave);
      const atual = doLote ?? valorAtualDoSubcampo(c.campo, def.mostrarSe.campo, estadoAtual);
      if (atual && !def.mostrarSe.valores.some((v) => igual(v, atual))) {
        reject(
          c,
          "subcampo_incompativel_com_o_estado",
          `${habilidadeId(c.campo, subcampo)} exige ${def.mostrarSe.campo} ∈ [${def.mostrarSe.valores.join(", ")}], está "${atual}"`,
        );
        continue;
      }
    }

    // 8. citação e inferência
    const citacao = (c.citacao ?? "").trim() || null;
    const inferido = c.inferido === true;
    const ancorada = citacao != null && citacaoConfere(citacao, entradaNormalizada);

    if (citacao != null && !ancorada) {
      // Citação que não existe na fala é a prova de que o fato foi construído
      // pelo modelo. Rejeita nos DOIS modos: no compatível ela é opcional, mas
      // se veio, tem que ser verdadeira.
      reject(c, "citacao_nao_comprovada", citacao.slice(0, 80));
      continue;
    }

    if (modo === "estrito") {
      if (citacao == null) {
        reject(c, "citacao_ausente", habilidadeId(c.campo, subcampo));
        continue;
      }
      if (inferido && !ancorada) {
        reject(c, "inferencia_sem_ancora", habilidadeId(c.campo, subcampo));
        continue;
      }
    }

    // Classe C: inferência sem âncora não entra no perfil. Sai pelo lado, viva
    // pro turno e morta pro banco.
    if (inferido && !ancorada) {
      hipoteses.push(c);
      continue;
    }

    aceitos.push({
      habilidade_id: habilidadeId(c.campo, subcampo),
      camada: c.camada,
      campo: c.campo,
      subcampo,
      valor: valorFinal,
      operacao: c.operacao === "reescrever" ? "reescrever" : "adicionar",
      citacao,
      inferido,
      procedencia: {
        // ⚠️ QUEM decide `por` é o pipeline, a partir de `inferido` — não o
        // modelo, e não quem chama. Um fato que a Ayla leu nas entrelinhas
        // jamais recebe `familia` mesmo que o chamador peça.
        por: inferido ? "ayla" : "familia",
        via: procedenciaBase.via,
        em: procedenciaBase.em,
      },
    });
  }

  return { aceitos, rejeitados, hipoteses };
}

/** A classe de um fato já aceito — útil pra decidir o que persiste. */
export function classeDoFato(f: FatoAceito): ClasseFato {
  if (!f.inferido) return "relato";
  return f.citacao ? "leitura" : "hipotese";
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · auxiliares
// ─────────────────────────────────────────────────────────────────────────────

const igual = (a: string, b: string) => normalizar(a) === normalizar(b);

/** Devolve a opção EXATA do vocabulário — casar não é adaptar. */
const canonizar = (opcoes: string[], valor: string) =>
  opcoes.find((o) => igual(o, valor)) ?? valor;

/**
 * Acento e caixa não são divergência de conteúdo. "não-verbal" e "Não-verbal"
 * são o mesmo valor; rejeitar por causa disso seria perder fato por
 * formatação, que é justo o oposto do que as guardas existem pra fazer.
 */
function normalizar(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A citação é comprovável na entrada?
 *
 * Substring sobre o texto normalizado. Não é semântica de propósito: o que se
 * quer provar é PROVENIÊNCIA, não parecença. Um modelo que parafraseia a mãe
 * já está a um passo de inventar; a paráfrase cabe no `valor`, não na âncora.
 */
export function citacaoConfere(citacao: string, entrada: string): boolean {
  const c = normalizar(citacao);
  if (c.length < 3) return false;
  return normalizar(entrada).includes(c);
}

/** Lê o valor atual de um sub-campo a partir do texto serializado do domínio. */
function valorAtualDoSubcampo(
  campo: string,
  subKey: string,
  estadoAtual: Record<string, string>,
): string {
  const subs = subcamposDe(campo);
  const texto = estadoAtual[campo];
  if (!subs || !texto) return "";
  return (parsearSubcampos(subs, texto)[subKey] ?? "").trim();
}
