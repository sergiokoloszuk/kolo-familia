import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A DECISÃO NÃO PODE NASCER SÓ NO LEGACY — 28/08/2026.
 *
 * ⚠️ O DEFEITO QUE ISTO PEGA, e ele já aconteceu três vezes:
 *   · 22/08 — a correção comercial foi feita só em `responder.ts`. MEDI que o
 *     Legacy atende **2,59%** dos turnos: a correção alcançava um turno em
 *     quarenta, e ninguém percebeu por quatro dias;
 *   · 26/08 — o D7 foi corrigido no template proativo e a conversa reativa
 *     seguiu mandando `/precos` por mais um dia;
 *   · 27/08 — Karina escreveu "quero pagar" e recebeu a página que vende o
 *     teste, porque a mesma regra vivia em dois arquivos.
 *
 * ⚠️ POR QUE ELE COMPARA IMPORTS, E NÃO "FUNÇÕES DE CONDUTA". Não existe
 * definição verificável de "função de conduta" — um teste que tentasse
 * adivinhar isso seria frágil e daria falso positivo em toda refatoração. O
 * que É verificável: **de quais módulos de DECISÃO cada caminho depende**. Se
 * o Legacy passa a depender de um módulo de decisão que o Oficial não conhece,
 * alguém escreveu conduta no lugar que quase ninguém lê.
 *
 * ⚠️ E ELE NÃO EXIGE PARIDADE, de propósito. Hoje existem cinco módulos só no
 * Legacy, e nem todos são defeito — o Oficial busca o Core no banco
 * (`ayla_documentos`), então não importar `conducao/diretrizes` pode ser
 * correto. Exigir paridade total obrigaria a "consertar" coisas que talvez não
 * estejam quebradas. O teste prende o que importa: **a lista não cresce**.
 */

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, "src/lib/ayla", p), "utf8");

/** Onde moram as decisões: condução, comercial, conhecimento, perfil, trial. */
const DECISAO = /from "(@\/lib\/(?:conducao|billing|conhecimento|kolo-vivo|trial)\/[^"]+)"/g;
const importsDe = (arq: string) => new Set([...ler(arq).matchAll(DECISAO)].map((m) => m[1]));

/**
 * A DÍVIDA CONHECIDA, congelada em 28/08/2026.
 *
 * ⚠️ ESTA LISTA SÓ PODE ENCOLHER. Cada item é um módulo de decisão que o
 * Legacy conhece e o Oficial não — ou seja, algo que **não alcança as
 * famílias**. Ao ligar um deles no Oficial, remova-o daqui.
 *
 * ⚠️ NÃO ACRESCENTE ITEM AQUI PARA FAZER O TESTE PASSAR. Se o teste falhou
 * porque a lista cresceu, a resposta é ligar o módulo no Oficial — não
 * registrar mais uma dívida.
 */
const SO_NO_LEGACY_CONHECIDO = new Set([
  // O Oficial resolve o Core pelo banco (`ayla_documentos`, core v9), via
  // `resolverDocumento`. Pode ser correto; não foi provado nem descartado.
  "@/lib/conducao/diretrizes",
  // 🔴 A base de perguntas discriminativas — 255 seções, 12 temas. Existe,
  // funciona, e NÃO alcança nenhuma família. É o achado da frente de
  // inteligência de 28/08.
  "@/lib/conducao/base2",
  // 🔴 O leitor estruturado do Kolo Vivo (16 domínios organizados). O Oficial
  // lê o mesmo dado cru por `lerPerfilVivo` + `categorias_extras`, então não
  // é perda de cobertura — é perda de estrutura.
  "@/lib/kolo-vivo/consultar",
  "@/lib/conducao/composicao",
  "@/lib/conducao/angulos",
]);

describe("Oficial × Legacy", () => {
  it("MORDE: nenhum módulo de decisão NOVO aparece só no Legacy", () => {
    const oficial = importsDe("experimental.ts");
    const legacy = importsDe("responder.ts");
    const soLegacy = [...legacy].filter((m) => !oficial.has(m));
    const novos = soLegacy.filter((m) => !SO_NO_LEGACY_CONHECIDO.has(m));
    expect(
      novos,
      `\n\n🔴 Estes módulos de decisão só existem no LEGACY (2,59% dos turnos):\n` +
        novos.map((m) => `   · ${m}`).join("\n") +
        `\n\nSe é conduta da Ayla, o lugar é 'experimental.ts' — o Oficial.\n` +
        `Não acrescente à lista de dívida conhecida para o teste passar.\n`,
    ).toEqual([]);
  });

  it("MORDE: a dívida conhecida não cresce — e cada item ainda é real", () => {
    // Se um item foi LIGADO no Oficial, ele deve sair da lista. Este teste
    // avisa, para a lista não virar folclore.
    const oficial = importsDe("experimental.ts");
    const jaResolvidos = [...SO_NO_LEGACY_CONHECIDO].filter((m) => oficial.has(m));
    expect(
      jaResolvidos,
      `\n\n✅ Estes já foram ligados no Oficial — remova de SO_NO_LEGACY_CONHECIDO:\n` +
        jaResolvidos.map((m) => `   · ${m}`).join("\n") + "\n",
    ).toEqual([]);
  });

  it("os dois arquivos dizem, no topo, o que são", () => {
    // O nome "experimental" mente; o cabeçalho é o que corrige isso para quem
    // abre o arquivo pela primeira vez.
    expect(ler("experimental.ts").slice(0, 900)).toContain("AYLA OFICIAL DE PRODUÇÃO");
    expect(ler("responder.ts").slice(0, 900)).toContain("AYLA LEGACY");
  });

  it("MORDE: o cabeçalho do Oficial aponta o nome real da flag", () => {
    // Se a flag for renomeada sem atualizar isto, o próximo a ler acredita
    // numa variável que não existe — e desligar a errada apaga a Ayla.
    expect(ler("experimental.ts").slice(0, 2000)).toContain("AYLA_EXPERIMENTAL_TODAS");
  });
});
