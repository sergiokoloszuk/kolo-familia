import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { naturezaDoTurno, type NaturezaDoTurno } from "@/lib/conducao/fronteiras-forma";

/**
 * A NATUREZA DO TURNO, OBSERVÁVEL DE FORA — PEND-203 Gate 2A.
 *
 * ⚠️ O QUE ESTA MUDANÇA É: devolver um valor que JÁ era calculado e morria
 * dentro de `notaDeProporcao`. Zero chamada nova, zero classificação nova,
 * zero mudança de resposta. O que este arquivo protege é exatamente isso — que
 * a mudança continue sendo só exposição.
 *
 * ⚠️ E O QUE ELA NÃO É: um produtor de desabafo. A bancada dos 12 casos abaixo
 * está aqui para impedir que alguém, no futuro, use `natureza` como guarda de
 * desabafo — ela não separa "Hoje estou exausta" de "Estou preocupada porque
 * ele não come". As duas devolvem `orientacao`.
 */

describe("A · a bancada dos 12 casos — valores REAIS", () => {
  /**
   * ⚠️ ESTA TABELA É A EVIDÊNCIA, não a expectativa de quem escreveu. Ela foi
   * preenchida rodando a função, e é o que responde à pergunta decisiva do
   * Gate 2A: a natureza existente resolve desabafo?
   */
  const CASOS: Array<{ id: string; texto: string; semOrientacao: NaturezaDoTurno; comOrientacao: NaturezaDoTurno }> = [
    { id: "A", texto: "Hoje estou exausta. Foi um dia horrível.", semOrientacao: "orientacao", comOrientacao: "orientacao" },
    { id: "B", texto: "Não aguento mais, estou muito cansada.", semOrientacao: "orientacao", comOrientacao: "orientacao" },
    { id: "C", texto: "Hoje estou acabada, mas ele dormiu bem.", semOrientacao: "orientacao", comOrientacao: "orientacao" },
    { id: "D", texto: "Ele gritou três vezes hoje e eu estou exausta.", semOrientacao: "orientacao", comOrientacao: "orientacao" },
    { id: "E", texto: "Oi, tudo bem?", semOrientacao: "simples", comOrientacao: "continuacao" },
    { id: "F", texto: "Quero te contar como foi nosso dia.", semOrientacao: "orientacao", comOrientacao: "orientacao" },
    { id: "G", texto: "Ele não fala e eu estou desesperada.", semOrientacao: "orientacao", comOrientacao: "orientacao" },
    { id: "H", texto: "Estou preocupada porque ele não come.", semOrientacao: "orientacao", comOrientacao: "orientacao" },
    { id: "I", texto: "Obrigada, vou tentar.", semOrientacao: "simples", comOrientacao: "continuacao" },
    { id: "J", texto: "Sim.", semOrientacao: "simples", comOrientacao: "continuacao" },
    { id: "K", texto: "Pode.", semOrientacao: "simples", comOrientacao: "continuacao" },
    { id: "L", texto: "Quero te contar mais sobre meu filho.", semOrientacao: "orientacao", comOrientacao: "orientacao" },
  ];

  it("cada caso produz exatamente o valor medido", () => {
    for (const c of CASOS) {
      expect(naturezaDoTurno(c.texto, false), `${c.id} sem orientação`).toBe(c.semOrientacao);
      expect(naturezaDoTurno(c.texto, true), `${c.id} com orientação`).toBe(c.comOrientacao);
    }
  });

  it("3. CONTINUAÇÃO CURTA é reconhecida — e só quando já houve orientação", () => {
    const curtos = CASOS.filter((c) => c.semOrientacao === "simples");
    expect(curtos.map((c) => c.id)).toEqual(["E", "I", "J", "K"]);
    for (const c of curtos) {
      expect(naturezaDoTurno(c.texto, true)).toBe("continuacao");
      // ⚠️ Sem orientação anterior, a MESMA frase é abertura, não continuação.
      expect(naturezaDoTurno(c.texto, false)).toBe("simples");
    }
  });

  it("4. DESABAFO **NÃO** é reconhecido — e é por isso que ela não serve de guarda", () => {
    // A e B são desabafo puro; H é preocupação concreta; L é pedido para
    // acelerar. Quatro intenções clinicamente diferentes, um valor só.
    const mesmos = ["A", "B", "H", "L"].map(
      (id) => naturezaDoTurno(CASOS.find((c) => c.id === id)!.texto, false),
    );
    expect(new Set(mesmos).size).toBe(1);
    expect(mesmos[0]).toBe("orientacao");
  });

  it("ela separa TAMANHO, não estado emocional — o eixo é declarado", () => {
    const valores = new Set(CASOS.flatMap((c) => [c.semOrientacao, c.comOrientacao]));
    expect([...valores].sort()).toEqual(["continuacao", "orientacao", "simples"]);
    // nenhum valor da taxonomia fala de emoção
    for (const v of valores) expect(v).not.toMatch(/desabafo|crise|emoc/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B · a exposição, e o que ela não muda", () => {
  const EXP = readFileSync(new URL("./experimental.ts", import.meta.url), "utf8");
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

  it("1. a natureza exposta é a MESMA que foi calculada — uma const, dois usos", () => {
    // Içada para const e usada tanto na nota de proporção quanto no retorno.
    expect(EXP).toMatch(
      /const natureza = naturezaDoTurno\(params\.mensagem, ctxTurno\.jaHouveOrientacao\);/,
    );
    expect(EXP).toMatch(/const proporcao = notaDeProporcao\(natureza\);/);
    // e o retorno devolve a const, não uma segunda chamada
    const metrica = EXP.slice(EXP.indexOf("      metrica: {"));
    expect(metrica).toMatch(/^\s+natureza,$/m);
    expect(metrica).not.toMatch(/natureza: naturezaDoTurno\(/);
  });

  it("2. o ORQUESTRADOR não recalcula — ele nem importa a função", () => {
    // ⚠️ ESTE É O INVARIANTE MAIS IMPORTANTE DO GATE. Recalcular no
    // orquestrador exigiria `jaHouveOrientacao`, que não existe lá: o valor
    // sairia errado e a guarda de continuação curta ficaria furada em silêncio.
    expect(ORQ).not.toMatch(/naturezaDoTurno/);
    expect(ORQ).not.toMatch(/from "@\/lib\/conducao\/fronteiras-forma"/);
  });

  it("11. ZERO chamada de modelo a mais — `chamadasLLM` segue 1", () => {
    const metrica = EXP.slice(EXP.indexOf("      metrica: {"), EXP.indexOf("      metrica: {") + 900);
    expect(metrica).toMatch(/chamadasLLM: 1,/);
  });

  it("10. a fala não é tocada: `natureza` entra em `metrica`, nunca em `texto`", () => {
    // O campo vive no bloco de medição, que o orquestrador escreve em `meta`.
    const i = EXP.indexOf("  metrica: {");
    const tipo = EXP.slice(i, EXP.indexOf("  };", i));
    expect(tipo).toMatch(/natureza: NaturezaDoTurno;/);
    // e não existe nenhuma composição de texto a partir dela
    expect(EXP).not.toMatch(/texto.*\$\{natureza\}|natureza.*\+ texto/);
  });

  it("12. nenhuma feature passa a rotear por natureza", () => {
    // Se alguma decisão de rota começar a ler `natureza`, este teste cai — e
    // essa decisão tem de ser deliberada, não efeito colateral da exposição.
    for (const src of [ORQ, EXP]) {
      expect(src).not.toMatch(/natureza === "desabafo"/);
      expect(src).not.toMatch(/if \(natureza === "continuacao"\)/);
      expect(src).not.toMatch(/metrica\.natureza/);
    }
  });

  it("9. crise/segurança continuam soberanas e independentes disto", () => {
    // `segurancaAberta` continua sendo o dono do estado de segurança, e ele é
    // consultado antes de qualquer coisa que este gate toque.
    expect(ORQ).toMatch(/const seguranca = await segurancaAberta\(/);
    const iSeg = ORQ.indexOf("const seguranca = await segurancaAberta(");
    const iEnvio = ORQ.indexOf("texto: exp.texto,");
    expect(iSeg).toBeGreaterThan(0);
    expect(iSeg).toBeLessThan(iEnvio);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C · sabotagens", () => {
  const EXP = readFileSync(new URL("./experimental.ts", import.meta.url), "utf8");
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

  it("RECALCULAR NO ORQUESTRADOR: proibido por ausência de import e de chamada", () => {
    expect(ORQ).not.toContain("naturezaDoTurno");
  });

  it("SEGUNDA CHAMADA NO RETORNO: o retorno usa a const, não a função", () => {
    const metrica = EXP.slice(EXP.indexOf("      metrica: {"));
    const chamadasNoRetorno = (metrica.match(/naturezaDoTurno\(/g) ?? []).length;
    expect(chamadasNoRetorno).toBe(0);
  });

  it("CLASSIFICAR TODO `outro` COMO DESABAFO: `desabafo` não é valor de `intencao`", () => {
    /**
     * ⚠️ INVERTIDO NO GATE 2B. Ele afirmava que o sinal de desabafo NÃO
     * EXISTIA. O Gate 2B o criou — mas como CAMPO PARALELO
     * (`natureza_emocional`), nunca como valor de `intencao`. O invariante que
     * este teste defende não mudou: `desabafo` não pode competir com
     * `plano`/`rotina`, senão a feature para de disparar (Claire/Maria).
     */
    const INT = readFileSync(new URL("./intent.ts", import.meta.url), "utf8");
    const DEC = readFileSync(new URL("../conducao/decisao-do-turno.ts", import.meta.url), "utf8");
    // ⚠️ USO, NÃO MENÇÃO: `intent.ts` cita desabafo num comentário que descreve
    // o que cai em `outro` — proibir a palavra proibiria a documentação.
    expect(INT).not.toMatch(/\|\s*"desabafo"/);
    // e no decisor ele é valor do enum NOVO, nunca do de intenção
    const enumIntencao = DEC.slice(DEC.indexOf("intencao: {"), DEC.indexOf("pedido_explicito: {"));
    expect(enumIntencao).not.toContain("desabafo");
    const uniaoDoPrompt = DEC.slice(DEC.indexOf('"intencao": "rotina_criar"'), DEC.indexOf('"pedido_explicito"'));
    expect(uniaoDoPrompt).not.toContain("desabafo");
  });

  it("`pediuParaContar` GANHOU produtor — em sombra, e sem nenhum consumidor", () => {
    /**
     * ⚠️ INVERTIDO NO GATE 2B, e de propósito. Antes este teste afirmava que
     * o produtor NÃO existia. Ele passou a existir — como campo paralelo, em
     * sombra. O que passou a importar é que ele continue IMPOTENTE: produzido
     * pelo decisor, lido por ninguém.
     */
    const DEC = readFileSync(new URL("../conducao/decisao-do-turno.ts", import.meta.url), "utf8");
    expect(DEC).toContain('pediu_para_contar: { type: "boolean" }');
    expect(DEC).toContain("pediuParaContar: o.pediu_para_contar === true,");
    const CONV = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    expect(CONV).toContain("pediuParaContar: boolean;");
    // e NADA no caminho de produção o consome
    expect(ORQ).not.toContain("pediuParaContar");
  });

  it("o decisor do convite continua NÃO fiado — nada foi ligado neste gate", () => {
    expect(ORQ).not.toMatch(/decidirConviteDePerfil|reservarConviteDePerfil|fraseDoConvite/);
  });

  it("nenhuma mudança tocou a escrita da Fase 2", () => {
    // O bloco pós-resposta continua com a mesma ordem: foto → escrita → sombra.
    const foto = ORQ.indexOf("const koloVivoAntesDoTurno");
    const escrita = ORQ.indexOf("await persistirRegistro(supabase, family.id, parsedExp, {");
    expect(foto).toBeGreaterThan(0);
    expect(foto).toBeLessThan(escrita);
  });
});
