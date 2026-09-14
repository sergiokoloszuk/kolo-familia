import type { UnidadeDaPos } from "./tipos";
import { UNIDADES_A } from "./unidades-a";
import { UNIDADES_B } from "./unidades-b";

/**
 * A BASE INTEIRA, EM MEMÓRIA.
 *
 * ⚠️ POR QUE NÃO HÁ TABELA, EMBEDDING NEM MIGRAÇÃO. A base inteira são ~50
 * unidades, ~30 KB de texto. Um índice vetorial existe para achar agulha em
 * corpus que não cabe na memória; aqui o corpus cabe num arquivo e a busca
 * inteira roda em menos de um milissegundo, sem rede.
 *
 * O que se ganharia com embedding é casar paráfrase ("ele fica agitado num
 * lugar cheio" com "hipersensibilidade auditiva"). O que se perderia é maior: a
 * decisão deixaria de ser auditável (ninguém explica um cosseno num laudo),
 * passaria a depender de uma chamada de rede dentro do turno, e exigiria
 * reindexar a cada edição da Karina. Como a pós é um GRAFO DE PRÉ-REQUISITOS e
 * não um saco de parágrafos, o que decide a pertinência quase sempre é
 * estrutura — tema, idade, o que o Perfil já sabe —, não semelhança textual.
 *
 * ⚠️ O GATILHO TEXTUAL É O ÚLTIMO CRITÉRIO, NÃO O PRIMEIRO, exatamente por
 * isso. Ele desempata; quem seleciona é a estrutura.
 */
export const BASE_DA_POS: readonly UnidadeDaPos[] = [...UNIDADES_A, ...UNIDADES_B];

const PORID = new Map(BASE_DA_POS.map((u) => [u.id, u]));

/** Uma unidade pelo id. Usado pelo grafo e pela auditoria. */
export function unidade(id: string): UnidadeDaPos | null {
  return PORID.get(id) ?? null;
}

export type ContextoDaPos = {
  /** A fala de agora. Minúscula ou não — os gatilhos são case-insensitive. */
  relato: string;
  /** Domínios do turno. LISTA: um turno real quase sempre tem mais de um. */
  temas: readonly string[];
  /** Idade da criança em foco, em meses. `null` = desconhecida. */
  idadeMeses: number | null;
  /**
   * Campos do Perfil JÁ CONHECIDOS, em `dominio.campo`.
   *
   * ⚠️ É O QUE IMPEDE A PÓS DE MANDAR PERGUNTAR O QUE JÁ SE SABE. Uma unidade
   * cujos campos de `investigar` estão TODOS preenchidos perde o valor de
   * investigação — mas NÃO é descartada: o mecanismo dela continua valendo para
   * interpretar. Ela só para de disputar a vaga com quem ainda revela algo.
   */
  camposConhecidos: readonly string[];
  /** Ids de unidades já usadas nos últimos turnos — não repetir de graça. */
  idsRecentes?: readonly string[];
  /**
   * O SINAL QUE JÁ EXISTE — `necessidade_conhecimento` do decisor do turno.
   *
   * ⚠️ É ELE QUEM DECIDE SE A PÓS É CONSULTADA, e não o recuperador. A bancada
   * de 14/09 provou que isso não é formalidade: sem o portão, a pós entrava em
   * "hoje ele me olhou nos olhos e falou mamãe" — um turno de celebração — e
   * explicava o mecanismo do contato visual. Tecnicamente pertinente, e a pior
   * resposta possível àquela mãe.
   *
   * O recuperador escolhe O QUE trazer; o sinal decide SE se traz. Dois donos
   * para duas decisões diferentes.
   */
  necessidade: "nenhum" | "boas_praticas" | "base2" | "pos_neurodesenvolvimento" | "combinacao";
};

export type UnidadeSelecionada = {
  unidade: UnidadeDaPos;
  pontos: number;
  /** Por que ela entrou. Vai para a telemetria; é o que torna a escolha auditável. */
  porque: readonly string[];
};

export type ResultadoDaPos = {
  selecionadas: readonly UnidadeSelecionada[];
  /** Campos que as unidades selecionadas mandam investigar e ainda não se sabe. */
  investigarSugerido: readonly string[];
  /** Todo id considerado, com o motivo de ter ficado de fora. Auditoria. */
  descartadas: ReadonlyArray<{ id: string; motivo: string }>;
  /** O portão de `necessidade_conhecimento` abriu neste turno? */
  porta: "aberta" | "fechada";
};

/** Teto de unidades por turno. Três explica; cinco vira aula. */
const MAX_UNIDADES = 3;
/** Teto de caracteres do bloco renderizado. */
// Desconta o cabeçalho do bloco, que também vai ao prompt — medir só o corpo
// foi o que deixou a bancada de 14/09 imprimir blocos de 1425 num teto de 1200.
const CABECALHO_CHARS = 230;
const MAX_CHARS = 1200 - CABECALHO_CHARS;

const PESO = {
  /** Papel que responde à natureza do turno. */
  sinal_de_alerta: 60,
  regra_decisao: 45,
  escada: 30,
  mecanismo: 25,
  marco_etario: 20,
  principio: 15,
  limite: 55,
} as const;

/**
 * SELECIONA O QUE É PERTINENTE A ESTE TURNO.
 *
 * Determinístico e puro: sem rede, sem banco, sem modelo. A mesma entrada dá a
 * mesma saída, sempre — que é o que torna a bancada reproduzível e a decisão
 * explicável depois.
 */
export function recuperarDaPos(ctx: ContextoDaPos): ResultadoDaPos {
  // ⚠️ O PORTÃO, ANTES DE QUALQUER TRABALHO. Ver `necessidade` em
  // `ContextoDaPos`: turno que não pede fundamento não recebe fundamento.
  if (ctx.necessidade !== "pos_neurodesenvolvimento" && ctx.necessidade !== "combinacao") {
    return { selecionadas: [], investigarSugerido: [], descartadas: [], porta: "fechada" };
  }
  const relato = ctx.relato ?? "";
  const temas = new Set(ctx.temas ?? []);
  const conhecidos = new Set(ctx.camposConhecidos ?? []);
  const recentes = new Set(ctx.idsRecentes ?? []);
  const descartadas: Array<{ id: string; motivo: string }> = [];
  // Mutável enquanto se decide; `UnidadeSelecionada` congela na saída.
  type EmDisputa = { unidade: UnidadeDaPos; pontos: number; porque: string[] };
  const candidatas: EmDisputa[] = [];

  for (const u of BASE_DA_POS) {
    const porque: string[] = [];

    // ⚠️ FILTRO 2 — IDADE. Idade DESCONHECIDA não elimina: eliminar aqui faria a
    // pós sumir justamente para a família que ainda não preencheu nada, que é
    // quem mais precisa de condução.
    if (ctx.idadeMeses !== null) {
      if (u.faixaMesesMin !== null && ctx.idadeMeses < u.faixaMesesMin) {
        descartadas.push({ id: u.id, motivo: "faixa_etaria" });
        continue;
      }
      if (u.faixaMesesMax !== null && ctx.idadeMeses > u.faixaMesesMax) {
        descartadas.push({ id: u.id, motivo: "faixa_etaria" });
        continue;
      }
    }

    // ⚠️ FILTRO 3 — PERTINÊNCIA. Tema OU gatilho. Nunca só a existência.
    //
    // A regra é `OU` e não `E` de propósito: é a correção do achado 2 da bancada
    // da BIA. "Ele se joga no chão" com tema `emocional` precisa alcançar a
    // busca sensorial (B4.4), cujo tema principal é `sensorial` — num `E` ela
    // nunca apareceria no turno que mais precisa dela.
    const bateTema = u.temas.some((t) => temas.has(t));
    const bateGatilho = u.gatilhos.some((g) => g.test(relato));
    if (!bateTema && !bateGatilho) {
      descartadas.push({ id: u.id, motivo: "fora_do_turno" });
      continue;
    }
    /**
     * ⚠️ QUEM TEM GATILHO PRECISA DO GATILHO — a correção mais importante que a
     * bancada de 14/09 produziu.
     *
     * Antes, tema OU gatilho bastava, e o resultado foi ruído sistemático: no
     * caso "dispersão no shopping" a base devolvia sociometria escolar (B6.1) e
     * semântica × pragmática (A10.11) junto com a regra certa, só porque o tema
     * `escola` as alcançava. Três vagas, uma útil.
     *
     * Uma unidade que DECLARA gatilhos está dizendo "eu sou sobre esta situação
     * específica" — e o tema sozinho não prova a situação. Já as unidades sem
     * gatilho (a escada, os marcos por faixa, a prevalência sensorial) são
     * pano de fundo por desenho, e continuam entrando por tema.
     */
    if (u.gatilhos.length > 0 && !bateGatilho) {
      descartadas.push({ id: u.id, motivo: "tema_sem_gatilho" });
      continue;
    }

    let pontos = PESO[u.papel];
    porque.push(`papel:${u.papel}`);
    if (bateTema) {
      pontos += 20;
      porque.push("tema");
    }
    if (bateGatilho) {
      pontos += 35;
      porque.push("gatilho");
    }
    // Tema E gatilho juntos é sinal forte de que a unidade é sobre ESTE caso.
    if (bateTema && bateGatilho) pontos += 15;

    // ⚠️ O QUE O PERFIL JÁ SABE ENTRA NA CONTA — é o item que a missão pede
    // medir ("se perguntou algo que o Perfil já sabia"). Unidade cujos campos
    // estão todos preenchidos NÃO sai: ela perde a vantagem de investigação,
    // porque não revela nada novo, e continua valendo pelo mecanismo.
    const aInvestigar = u.investigar.filter((c) => !conhecidos.has(c));
    if (u.investigar.length > 0) {
      if (aInvestigar.length === 0) {
        pontos -= 25;
        porque.push("perfil_ja_sabe_tudo");
      } else {
        pontos += 10 * Math.min(2, aInvestigar.length);
        porque.push(`abre:${aInvestigar.length}`);
      }
    }

    // Repetir a mesma unidade turno após turno é o que transforma orientação em
    // ladainha. Penaliza, não proíbe: se ela continua sendo a certa, ela volta.
    if (recentes.has(u.id)) {
      pontos -= 30;
      porque.push("recente");
    }

    // ⚠️ O GRAFO. Uma unidade cujo pré-requisito é MAIS pertinente que ela
    // perde a vaga para ele — é a escada aplicada a toda a base, não só à
    // comunicação. Aqui só marca; a resolução é depois, com a lista pronta.
    candidatas.push({ unidade: u, pontos, porque });
  }

  // ⚠️ O PRÉ-REQUISITO VEM ANTES — a regra que a pós inteira ensina.
  //
  // Se A e seu pré-requisito B estão os dois na disputa, B sobe acima de A.
  // "Trabalhar vocabulário" não pode ganhar de "a atenção compartilhada ainda
  // não se formou" só porque a mãe falou de palavras.
  const naDisputa = new Set(candidatas.map((c) => c.unidade.id));
  for (const c of candidatas) {
    for (const pre of c.unidade.prerequisitos) {
      if (!naDisputa.has(pre)) continue;
      const alvo = candidatas.find((x) => x.unidade.id === pre)!;
      if (alvo.pontos <= c.pontos) {
        alvo.pontos = c.pontos + 5;
        alvo.porque.push(`prerequisito_de:${c.unidade.id}`);
      }
      c.pontos -= 10;
      c.porque.push(`depende_de:${pre}`);
    }
  }

  candidatas.sort((a, b) => b.pontos - a.pontos || a.unidade.id.localeCompare(b.unidade.id));

  /**
   * ⚠️ DUAS LISTAS, E A DIFERENÇA É A LIÇÃO DA BANCADA.
   *
   * A primeira versão descartava as unidades `jaNoCore` logo na entrada, e o
   * resultado foi o pior erro possível: no caso "do nada ele começou a ter
   * crise essa semana", a unidade que manda procurar DOR SILENCIOSA (B0.4) era
   * eliminada antes de disputar, e a investigação ia para `emocional.ajuda` —
   * plano de manejo para uma criança que pode estar com otite.
   *
   * A marca `jaNoCore` diz "o Core já FALA isto", não "isto não importa". Logo:
   * ela sai do TEXTO injetado (senão duplica o prompt) e continua governando
   * PARA ONDE OLHAR. Investigação e injeção são coisas distintas.
   */
  const ordenadas = candidatas.slice(0, 8);
  const selecionadas: UnidadeSelecionada[] = [];
  let chars = 0;
  for (const c of ordenadas) {
    if (c.unidade.jaNoCore) {
      descartadas.push({ id: c.unidade.id, motivo: "ja_no_core_texto" });
      continue;
    }
    if (selecionadas.length >= MAX_UNIDADES) {
      descartadas.push({ id: c.unidade.id, motivo: "teto_de_unidades" });
      continue;
    }
    const custo = renderizarUnidade(c.unidade).length;
    if (chars + custo > MAX_CHARS) {
      descartadas.push({ id: c.unidade.id, motivo: "teto_de_chars" });
      continue;
    }
    chars += custo;
    selecionadas.push(c);
  }

  // A investigação vem das TRÊS mais pertinentes, `jaNoCore` incluídas.
  const investigarSugerido = [
    ...new Set(
      ordenadas
        .slice(0, MAX_UNIDADES)
        .flatMap((s) => s.unidade.investigar.filter((c) => !conhecidos.has(c))),
    ),
  ];

  return { selecionadas, investigarSugerido, descartadas, porta: "aberta" };
}

/**
 * UMA UNIDADE, COMO TEXTO PARA O MODELO.
 *
 * ⚠️ NÃO É FALA PARA A FAMÍLIA, e o cabeçalho diz isso em voz alta. O Core
 * governa a voz da Ayla; se este bloco soasse como resposta pronta, o modelo o
 * copiaria, e a família receberia a pós em vez da Ayla.
 */
export function renderizarUnidade(u: UnidadeDaPos): string {
  const linhas = [`[${u.id}] ${u.titulo}`, u.mecanismo];
  if (u.direcao) linhas.push(`Direção: ${u.direcao}`);
  if (u.cautela) linhas.push(`Cuidado: ${u.cautela}`);
  return linhas.join("\n");
}

/**
 * O BLOCO DO TURNO. String vazia quando nada é pertinente — e o vazio é o caso
 * comum e correto: conversa social, desabafo e resposta operacional não pedem
 * fundamento de neurodesenvolvimento.
 */
export function blocoDaPos(r: ResultadoDaPos): string {
  if (r.selecionadas.length === 0) return "";
  const corpo = r.selecionadas.map((s) => renderizarUnidade(s.unidade)).join("\n\n");
  return [
    "<neurodesenvolvimento>",
    "Fundamento para VOCÊ raciocinar — não é texto para a família e não se cita nem se lê em voz alta.",
    "Se contradisser o que a família contou sobre esta criança, a família vence.",
    "",
    corpo,
    "</neurodesenvolvimento>",
  ].join("\n");
}
