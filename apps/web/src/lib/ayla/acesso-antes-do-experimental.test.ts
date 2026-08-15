import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pedeAcessoAoApp } from "@/lib/auth/acesso-link";

/**
 * FATIA 1 · O P0 DO INVENTÁRIO DE 15/08/2026.
 *
 * ⚠️ O DEFEITO. O ramo experimental respondia e dava `return`, e o bloco que
 * manda o link de acesso ficava DEPOIS dele. Uma família da allowlist que
 * dissesse "não consigo entrar no app" não recebia link nenhum: recebia uma
 * resposta conversacional sobre estar trancada fora. O comentário do próprio
 * bloco registra o custo real disso — uma mãe passou dois dias sem acesso
 * enquanto brigava com a escola (22–26/07).
 *
 * ⚠️ POR QUE ESTE TESTE É ESTRUTURAL, E ONDE ISSO PÁRA DE BASTAR. A ordem de
 * dois blocos dentro de uma função de 4.000 linhas não é observável por
 * execução sem subir o orquestrador inteiro com Z-API, Stripe e modelo falsos.
 * O que se prova aqui é a ORDEM e a AUSÊNCIA DE DUPLICATA — que é exatamente o
 * que regrediria. O comportamento de `pedeAcessoAoApp` é exercitado de verdade,
 * abaixo, porque esse dá.
 */

const ORQ = readFileSync(
  join(process.cwd(), "src/lib/ayla/orchestrator.ts"),
  "utf8",
);

/** Posição da primeira ocorrência; -1 vira Infinity para comparar sem enganar. */
const pos = (s: string) => {
  const i = ORQ.indexOf(s);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
};

const GATE_ASSINATURA = "// 2b. ASSINATURA (GATE)";
const ACESSO = "if (pedeAcessoAoApp(inbound.texto)) {";
const EXPERIMENTAL = "if (ehFamiliaExperimental(family.id)) {";
/** O bloco que vem logo depois do acesso — a fronteira do recorte. */
const PROXIMO_BLOCO = "// 3a. Resposta à oferta de fim de semana";

describe("A ORDEM — o acesso vem antes do experimental", () => {
  it("1. o bloco de acesso existe UMA vez só", () => {
    // Se a movimentação tivesse copiado em vez de mover, a família receberia
    // dois links. Duplicata é o erro mais provável desta fatia.
    const n = ORQ.split(ACESSO).length - 1;
    expect(n).toBe(1);
  });

  it("2. acesso vem ANTES do ramo experimental", () => {
    expect(pos(ACESSO)).toBeLessThan(pos(EXPERIMENTAL));
  });

  it("3. mas continua DEPOIS do gate de assinatura", () => {
    // Subir demais seria pior que o defeito: entregaria link de acesso a quem
    // não tem direito a acesso.
    expect(pos(GATE_ASSINATURA)).toBeLessThan(pos(ACESSO));
  });

  it("4. o bloco continua encerrando o turno — uma resposta só", () => {
    // ⚠️ O RECORTE MUDOU EM 15/08/2026. Ele ia de ACESSO até EXPERIMENTAL, e
    // isso funcionava porque o experimental vinha logo em seguida. Com o C2 o
    // ramo desceu para depois dos roteadores, então esse intervalo passou a
    // conter meia função. O recorte certo é do bloco até o PRÓXIMO bloco.
    const bloco = ORQ.slice(pos(ACESSO), pos(PROXIMO_BLOCO));
    expect(bloco).toContain("return { tratada: true, familia: family.id, resposta: resp }");
    // E manda UMA mensagem: um `enviarEPersistir`, não dois.
    expect(bloco.split("enviarEPersistir(").length - 1).toBe(1);
  });

  it("5. o experimental continua com o `return` que garante resposta única", () => {
    // O recorte era por tamanho fixo (2.600 chars) e quebrou quando a Fatia 3
    // acrescentou a persistência pós-resposta ao ramo. Fatiar até a próxima
    // âncora real é o que não envelhece.
    const ramo = ORQ.slice(pos(EXPERIMENTAL), pos("  // 4. Parser IA"));
    expect(ramo).toContain("return { tratada: true, familia: family.id, resposta: resp }");
  });

  it("6. nada de LLM novo no caminho: o bloco não chama modelo", () => {
    // Mesmo ajuste de recorte do teste 4 — aqui ele importa ainda mais, porque
    // `classificarIntencao` agora vive entre o acesso e o experimental, e o
    // recorte antigo acusaria um falso positivo.
    const bloco = ORQ.slice(pos(ACESSO), pos(PROXIMO_BLOCO));
    for (const t of ["gerarConversacional", "parseInbound", "classificarIntencao", "openai"]) {
      expect(bloco).not.toContain(t);
    }
  });

  it("7. SABOTAGEM — se voltar para depois do experimental, o teste 2 quebra", () => {
    const regredido = ORQ.replace(ACESSO, "// movido").concat(`\n${ACESSO}\n`);
    const iA = regredido.indexOf(ACESSO);
    const iE = regredido.indexOf(EXPERIMENTAL);
    expect(iA).toBeGreaterThan(iE); // é o estado defeituoso…
    expect(pos(ACESSO)).toBeLessThan(pos(EXPERIMENTAL)); // …e não é o nosso
  });
});

/**
 * O GATILHO, exercitado de verdade. Aqui não há leitura de arquivo: é a função
 * rodando. A régua dela é declarada larga de propósito — falso positivo custa
 * um link a mais, falso negativo custa uma mãe trancada fora.
 */
describe("O GATILHO — pedido explícito, falso positivo, falso negativo", () => {
  const PEDE = [
    "não consigo entrar",
    "Não consigo acessar o app",
    "esqueci a senha",
    "o link não abre",
    "não deu pra logar",
    "tá travado, não entra no site",
    "não consegui entrar na plataforma",
    "impossível acessar",
  ];

  it.each(PEDE)("reconhece: %s", (t) => {
    expect(pedeAcessoAoApp(t)).toBe(true);
  });

  const NAO_PEDE = [
    "não consigo fazer ele comer",
    "ela não quer entrar na sala da escola",
    "não consigo lidar com as crises",
    "o Mario não entra na piscina",
    "quero ajuda com a lição",
    "ele não consegue esperar a vez",
  ];

  it.each(NAO_PEDE)("não dispara em: %s", (t) => {
    // O falso positivo aqui seria mandar um link no meio de um desabafo sobre
    // a criança — barulho, e desvia a conversa do que importa.
    expect(pedeAcessoAoApp(t)).toBe(false);
  });

  it("texto vazio, nulo e indefinido não disparam", () => {
    expect(pedeAcessoAoApp("")).toBe(false);
    expect(pedeAcessoAoApp(null)).toBe(false);
    expect(pedeAcessoAoApp(undefined)).toBe(false);
  });

  it("MEDIDO: o gatilho é ruído perto do turno", () => {
    const amostra = [...PEDE, ...NAO_PEDE];
    const t0 = performance.now();
    for (let i = 0; i < 5000; i++) pedeAcessoAoApp(amostra[i % amostra.length]);
    const porChamada = (performance.now() - t0) / 5000;
    console.log(`\n  MEDIDO: ${(porChamada * 1000).toFixed(2)} µs por chamada\n`);
    expect(porChamada).toBeLessThan(1); // milissegundo, com folga enorme
  });
});
