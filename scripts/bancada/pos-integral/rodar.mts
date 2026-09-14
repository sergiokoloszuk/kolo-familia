/**
 * BANCADA DA PÓS INTEGRAL — SEM PÓS × COM PÓS. 14/09/2026.
 *
 * ⚠️ OFFLINE E DETERMINÍSTICA, de propósito. Não chama modelo, não vai ao
 * banco, não manda WhatsApp. Ela exercita as funções REAIS de decisão —
 * `escolherLacunaDecisiva` (Gate B, produção) e `recuperarDaPos` (o módulo
 * novo) — e compara o que cada configuração escolheria no MESMO turno.
 *
 * ⚠️ O QUE ELA MEDE, E É O QUE A MISSÃO PEDIU: a pergunta escolhida, se a
 * pergunta cai em algo que o Perfil já sabia, se o pré-requisito foi percebido,
 * e o falso positivo — a pós aparecendo onde não devia. Não mede recall de
 * trecho: um recuperador com recall perfeito que faz a Ayla perguntar o degrau
 * errado piorou o produto.
 *
 *   cd apps/web && npx tsx ../../scripts/bancada/pos-integral/rodar.mts
 */
import { escolherLacunaDecisiva } from "../../../apps/web/src/lib/ayla/lacuna-decisiva";
import { recuperarDaPos, blocoDaPos } from "../../../apps/web/src/lib/pos/recuperar";
import type { PerfilConsultavel, DominioPerfil, CampoPerfil } from "../../../apps/web/src/lib/kolo-vivo/consultar";
import { SUBCAMPOS_DOMINIO } from "../../../apps/web/src/lib/kolo-vivo/subcampos";
import { CASOS } from "./casos.mjs";

/**
 * O PERFIL DA BANCADA — MONTADO SOBRE O CATÁLOGO REAL.
 *
 * ⚠️ A PRIMEIRA VERSÃO DESTE ARQUIVO INVALIDOU A PRÓPRIA MEDIÇÃO, e vale
 * registrar. Ela devolvia `lacunasDe: () => []`, e com zero lacunas candidatas
 * o Gate B respondia NO ASK em 18 de 18 casos. O relatório imprimiu "a pergunta
 * mudou em 15/18" — número que parecia ótimo e não media nada: comparava a pós
 * contra um baseline mudo que eu mesmo havia construído.
 *
 * Agora as lacunas vêm de `SUBCAMPOS_DOMINIO`, o mesmo catálogo que produção
 * usa, e o que não está em `conhecido` é lacuna de verdade.
 */
function perfilDe(conhecido: Record<string, Record<string, string>>): PerfilConsultavel {
  const dominios = new Map<string, DominioPerfil>();
  for (const [dom, subcampos] of Object.entries(SUBCAMPOS_DOMINIO)) {
    const campos: CampoPerfil[] = subcampos.map((sc) => {
      const valor = conhecido[dom]?.[sc.key] ?? null;
      return {
        key: sc.key,
        label: sc.label ?? sc.key,
        estado: (valor ? "respondido" : "vazio") as never,
        valor,
      };
    });
    dominios.set(dom, {
      dominio: dom,
      label: dom,
      campos,
      conhecidos: campos.filter((c) => c.valor !== null),
      lacunas: campos.filter((c) => c.valor === null),
    });
  }
  return {
    membroId: "bancada",
    dominios,
    sabemos: (d, c) => Boolean(conhecido[d]?.[c]),
    valorDe: (d, c) => conhecido[d]?.[c] ?? null,
    lacunasDe: (d) => dominios.get(d)?.lacunas ?? [],
  };
}

const chavesConhecidas = (c: Record<string, Record<string, string>>): string[] =>
  Object.entries(c).flatMap(([d, campos]) => Object.keys(campos).map((k) => `${d}.${k}`));

type Linha = {
  id: string;
  fonte_esperada: string;
  titulo: string;
  /** Gate B sozinho — o que a Ayla investiga HOJE, em produção. */
  semPos: string | null;
  /** Gate B + a pós — o que ela investigaria com a base ligada. */
  comPos: string | null;
  unidades: string[];
  acertouUnidade: boolean | null;
  perguntouOSabido: boolean;
  falsoPositivo: boolean;
  charsBloco: number;
  micros: number;
};

const linhas: Linha[] = [];

for (const caso of CASOS) {
  const perfil = perfilDe(caso.perfilConhecido);
  const conhecidas = chavesConhecidas(caso.perfilConhecido);
  const jaRespondido = new Set(conhecidas);

  // ── SEM PÓS: exatamente o que produção faz hoje.
  const b = escolherLacunaDecisiva({
    perfil,
    temas: caso.temas,
    relato: caso.relato,
    jaRespondido,
  });
  /**
   * ⚠️ O CAMPO É `decisao`, E `escolhida` NÃO TEM `.chave`. A primeira versão
   * deste arquivo lia `b.acao` e `b.escolhida?.chave` — as duas inexistentes —,
   * então `semPos` saía `null` em 18 de 18 e o relatório anunciava que a pós
   * mudava a pergunta em quase todos os casos. Era o meu leitor quebrado, não o
   * Gate B calado: o segundo baseline falso desta mesma bancada.
   */
  const semPos =
    b.decisao === "ASK" && b.escolhida ? `${b.escolhida.dominio}.${b.escolhida.campo}` : null;

  // ── COM PÓS: o mesmo Gate B, mais a base.
  const t0 = process.hrtime.bigint();
  const pos = recuperarDaPos({
    relato: caso.relato,
    temas: caso.temas,
    idadeMeses: caso.idadeMeses,
    camposConhecidos: conhecidas,
    // ⚠️ O PORTÃO. Nesta rodada ele vem do `fonte_esperada` do caso — ou seja,
    // mede-se a RECUPERAÇÃO com o sinal perfeito. Se o sinal real errar, a
    // bancada `sinal.mts` mede isso separadamente: são dois defeitos diferentes
    // e misturá-los esconderia qual dos dois está quebrado.
    necessidade:
      caso.fonte_esperada === "pos"
        ? "pos_neurodesenvolvimento"
        : caso.fonte_esperada === "combinacao"
          ? "combinacao"
          : caso.fonte_esperada === "boas_praticas"
            ? "boas_praticas"
            : "nenhum",
  });
  const micros = Number(process.hrtime.bigint() - t0) / 1000;

  const ids = pos.selecionadas.map((s) => s.unidade.id);

  /**
   * ⚠️ A PÓS REORDENA, NÃO SUBSTITUI — e esta foi a terceira correção que a
   * bancada me impôs.
   *
   * A versão anterior fazia `comPos = pos.investigarSugerido[0]`, ou seja, a
   * pós ESCOLHIA o campo. O resultado foi medido e foi ruim: em P7 ela trocou
   * `comunicacao.contato` por `saude_geral.acompanhamentos`, em S1 trocou
   * `foco.padrao` por `escola.funciona`. A causa é estrutural — a lista
   * `investigar` de uma unidade não passa por `CAMPOS_DECISIVOS` nem pelo filtro
   * de tema do Gate B, então ela oferece campos que o gate já tinha descartado
   * por não mudarem a conduta.
   *
   * Um dono para cada decisão: **quem escolhe o campo é o Gate B**. A pós só
   * diz qual dos candidatos DELE sobe na fila. O que a pós acrescenta de
   * próprio é o `mecanismo` — que o Gate B não tem e nunca teve.
   */
  const candidatosDoGate = b.candidatasChaves ?? [];
  const preferidos = new Set(pos.investigarSugerido);
  const reordenados = [...candidatosDoGate].sort((x, y) => {
    const px = preferidos.has(x) ? 0 : 1;
    const py = preferidos.has(y) ? 0 : 1;
    return px - py;
  });
  const comPos = reordenados[0] ?? semPos;

  /**
   * ⚠️ O ACERTO SE MEDE NO QUE FOI CONSIDERADO, NÃO SÓ NO QUE FOI INJETADO.
   * Uma unidade `jaNoCore` (B0.4, dor silenciosa) nunca aparece em
   * `selecionadas` por desenho — o Core já a diz —, mas ela GOVERNA a
   * investigação. Contá-la como erro reprovaria exatamente o comportamento
   * correto, e foi o que a primeira contagem fez.
   */
  const consideradas = new Set([...ids, ...pos.descartadas.filter((d) => d.motivo === "ja_no_core_texto").map((d) => d.id)]);
  const esperadas = caso.espera.unidades;
  const acertouUnidade = esperadas.length === 0 ? null : esperadas.every((e) => consideradas.has(e));

  const proibida = caso.espera.perguntaNaoPodeSer;
  const perguntouOSabido =
    comPos !== null && (conhecidas.includes(comPos) || (proibida === "QUALQUER" ? false : comPos === proibida));

  // Falso positivo só existe onde NENHUMA fonte deveria entrar.
  const falsoPositivo = caso.fonte_esperada === "nenhum" && ids.length > 0;

  linhas.push({
    id: caso.id,
    fonte_esperada: caso.fonte_esperada,
    titulo: caso.titulo,
    semPos,
    comPos,
    unidades: ids,
    acertouUnidade,
    perguntouOSabido,
    falsoPositivo,
    charsBloco: blocoDaPos(pos).length,
    micros,
  });
}

// ─────────────────────────────────────────────────────────── relatório
const p = (s: unknown, n: number) => String(s ?? "—").padEnd(n).slice(0, n);
console.log("\n=== SEM PÓS × COM PÓS — a pergunta que a Ayla escolheria ===\n");
console.log(
  p("id", 4) + p("esperado", 14) + p("caso", 34) + p("SEM pós", 24) + p("COM pós", 24) + p("unidades", 22),
);
console.log("-".repeat(122));
for (const l of linhas) {
  const mudou = l.semPos !== l.comPos ? " *" : "  ";
  console.log(
    p(l.id, 4) + p(l.fonte_esperada, 14) + p(l.titulo, 34) + p(l.semPos, 24) + p(l.comPos, 22) + mudou + p(l.unidades.join(","), 22),
  );
}

const comEsperada = linhas.filter((l) => l.acertouUnidade !== null);
const acertos = comEsperada.filter((l) => l.acertouUnidade).length;
const mudaram = linhas.filter((l) => l.semPos !== l.comPos).length;
const sabidos = linhas.filter((l) => l.perguntouOSabido).length;
const fp = linhas.filter((l) => l.falsoPositivo);
const nenhum = linhas.filter((l) => l.fonte_esperada === "nenhum");
const chars = linhas.map((l) => l.charsBloco);
const micros = linhas.map((l) => l.micros).sort((a, b) => a - b);

console.log("\n=== PLACAR ===");
console.log(`casos: ${linhas.length}`);
console.log(`unidade esperada recuperada: ${acertos}/${comEsperada.length}`);
console.log(`a pergunta MUDOU com a pós: ${mudaram}/${linhas.length}`);
console.log(`perguntou algo que o Perfil já sabia: ${sabidos}/${linhas.length}`);
console.log(`FALSO POSITIVO (pós entrou onde nenhuma fonte devia): ${fp.length}/${nenhum.length}`);
if (fp.length) for (const l of fp) console.log(`   ⚠️ ${l.id} ${l.titulo} → ${l.unidades.join(",")}`);
console.log(`bloco: média ${Math.round(chars.reduce((a, b) => a + b, 0) / chars.length)} chars · máx ${Math.max(...chars)}`);
console.log(`recuperação: mediana ${micros[Math.floor(micros.length / 2)].toFixed(0)}µs · máx ${Math.max(...micros).toFixed(0)}µs`);

console.log("\n=== ONDE A PERGUNTA MUDOU, E POR QUÊ ===");
for (const l of linhas.filter((x) => x.semPos !== x.comPos)) {
  const caso = CASOS.find((c) => c.id === l.id)!;
  console.log(`\n[${l.id}] ${l.titulo}`);
  console.log(`  SEM pós : ${l.semPos ?? "(não perguntaria)"}`);
  console.log(`  COM pós : ${l.comPos ?? "(não perguntaria)"}`);
  console.log(`  unidade : ${l.unidades.join(", ") || "—"}`);
  console.log(`  porquê  : ${caso.espera.porque}`);
}
