import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * FATIA 3 · O APRENDIZADO LONGITUDINAL VOLTA AO CAMINHO NOVO.
 *
 * ⚠️ O QUE FALTAVA. O ramo experimental só escrevia `eventos_membro`. Ficavam
 * de fora `diarios`, `ayla_daily_checkins` e `sugestao_perfil_vivos` — a
 * auto-incorporação do Kolo Vivo, que é como o Perfil da criança cresce sozinho.
 * Uma Ayla que conversa bem hoje e esquece amanhã não é a Ayla que as famílias
 * têm: era o P1 do inventário de 15/08.
 *
 * ⚠️ POR QUE O COMENTÁRIO ANTIGO ESTAVA MEIO CERTO. Ele dizia que
 * `persistirRegistro` não podia entrar porque arrastaria `parseInbound`. Certo
 * sobre o mecanismo, errado sobre a conclusão: o parser não pode entrar ANTES
 * da resposta. Depois dela, a mãe não espera nada — MEDIDO, p50 de 2.659 ms que
 * agora acontecem com a bolha já entregue.
 *
 * ── UMA PREMISSA DESTE ARQUIVO FOI DESMENTIDA EM 11/09/2026 (PEND-198) ─────
 *
 * Os testes 2 e S2 prendiam `void (async () => {` e chamavam `await` de
 * SABOTAGEM, com a justificativa "a mãe volta a esperar a persistência".
 * **A justificativa não se sustenta**, e a prova está no próprio cabeçalho
 * acima: a bolha já foi entregue por `enviarEPersistir` ANTES do bloco. Quem
 * espera com o `await` é a função — não a família. E o debounce
 * (`aguardarTurnoDaMae`) claima MENSAGENS, não trava a família: a fala seguinte
 * abre a própria invocação e a própria janela, sem depender desta terminar.
 *
 * O que o `void` custava, MEDIDO em produção (01/09 a 11/09): 311 respostas do
 * caminho experimental, **209 execuções** do bloco — cobertura de **67,2%**.
 * Um em cada três relatos da família não virava conhecimento nenhum, porque a
 * promise solta ficava fora da cadeia que o `after()` do webhook aguarda e a
 * lambda congelava no meio. A taxa oscilava de 33% a 80% por dia: assinatura de
 * perda por runtime, não de regra.
 *
 * ⚠️ A INVARIANTE QUE IMPORTA NÃO MUDOU e continua presa aqui: **o parser nunca
 * roda antes do envio**. Ela é medida por ORDEM (índice de `parseInbound` maior
 * que o de `enviarEPersistir`), que é o que de fato protege o caminho crítico —
 * e não por casar o texto `void`, que era proxy de uma conclusão errada.
 */

const ORQ = readFileSync(join(process.cwd(), "src/lib/ayla/orchestrator.ts"), "utf8");

/** O ramo experimental inteiro, da entrada até o parser do Legacy. */
const RAMO = ORQ.slice(
  ORQ.indexOf("if (ehFamiliaExperimental(family.id))"),
  ORQ.indexOf("  // 4. Parser IA"),
);

describe("A ORDEM — responder primeiro, aprender depois", () => {
  it("1. o envio acontece ANTES do parser", () => {
    const iEnvio = RAMO.indexOf("await enviarEPersistir(");
    const iParser = RAMO.indexOf("parseInbound(");
    expect(iEnvio).toBeGreaterThan(-1);
    expect(iParser).toBeGreaterThan(iEnvio);
  });

  it("2. a persistência é AGUARDADA — e mesmo assim depois do envio", () => {
    // ⚠️ INVERTIDO EM 11/09/2026 (PEND-198). Antes este teste exigia `void` e
    // proibia `await`, para a função retornar rápido. Em serverless isso não
    // acelerava nada relevante e custava 32,8% do aprendizado: a promise solta
    // ficava fora da cadeia do `after()` e morria com a lambda.
    const depoisDoEnvio = RAMO.slice(RAMO.indexOf("await enviarEPersistir("));
    expect(depoisDoEnvio).toContain("await (async () => {");
    // E o `void` não pode voltar: é ele que soltava a promise.
    expect(depoisDoEnvio).not.toMatch(/void \(async \(\) => \{/);
  });

  it("3. o `return` de resposta única continua depois de tudo", () => {
    expect(RAMO).toContain("return { tratada: true, familia: family.id, resposta: resp }");
    const iVoid = RAMO.indexOf("await (async () => {");
    const iReturn = RAMO.indexOf("return { tratada: true, familia: family.id, resposta: resp }");
    expect(iReturn).toBeGreaterThan(iVoid);
  });
});

describe("O QUE VOLTA A SER ESCRITO", () => {
  it("4. `persistirRegistro` é chamada — Diário, check-in e Kolo Vivo", () => {
    // ⚠️ A ÂNCORA GANHOU UM SEGUNDO ARGUMENTO EM 11/09/2026 (PEND-194 Fase 2).
    // A chamada passou a declarar QUEM é o dono da escrita do Perfil Vivo
    // naquele turno. O invariante deste teste não mudou: a persistência do
    // pós-resposta continua sendo chamada, e com `await`.
    expect(RAMO).toContain("await persistirRegistro(supabase, family.id, parsedExp, {");
    // E o check-in e o diário continuam SEMPRE vindo daqui: a Fase 2 troca o
    // dono do Perfil, não o dono do registro do dia.
    expect(RAMO).toContain('escreverKoloVivo: escritor === "atual"');
  });

  it("5. `extrairESalvarEventos` continua — não foi substituída", () => {
    // As duas escritas são complementares: eventos é trajetória, registro é
    // perfil. Trocar uma pela outra perderia metade.
    expect(RAMO).toContain("extrairESalvarEventos(");
  });

  it("6. o parser pós-resposta tem feature própria — custo separável", () => {
    // Sem isso, `ayla_parser` misturaria o custo bloqueante do Legacy com o
    // não-bloqueante do novo, e a comparação de latência ficaria mentirosa.
    expect(RAMO).toContain('feature: "ayla_parser_pos"');
  });
});

describe("ISOLAMENTO — a escrita não pode filar conteúdo em outra criança", () => {
  it("7. família e membro vêm do contexto JÁ resolvido do turno", () => {
    expect(RAMO).toContain("persistirRegistro(supabase, family.id,");
    expect(RAMO).toContain("ctxExp.membros.map(");
  });

  it("8. o foco do turno MANDA sobre o palpite do parser", () => {
    // Se a resposta foi carimbada para uma criança, o registro é dela. Sem
    // isto, o parser poderia atribuir o aprendizado a um irmão DEPOIS de a
    // resposta já ter saído — e ninguém veria.
    expect(RAMO).toContain("if (exp.membroId) parsedExp.membro_atipico_id = exp.membroId");
  });

  it("9. família sem membros não persiste nada", () => {
    expect(RAMO).toContain("if (membrosDoTurno.length === 0) return");
  });

  it("10. criança única é resolvida como no Legacy, não por palpite", () => {
    expect(RAMO).toContain("membrosDoTurno.length === 1 && !parsedExp.membro_atipico_id");
  });
});

describe("FALHA — a perda é visível, e nunca derruba a conversa", () => {
  it("11. tudo dentro de try/catch", () => {
    const iVoid = RAMO.indexOf("await (async () => {");
    const bloco = RAMO.slice(iVoid);
    expect(bloco).toContain("try {");
    expect(bloco).toContain("} catch (e) {");
  });

  it("12. a falha é registrada — e agora PERSISTIDA, não só no stdout", () => {
    // ⚠️ ERA `console.warn`, que morre com a retenção da Vercel: a perda de
    // aprendizado ficava invisível depois de alguns dias. Agora é evento
    // persistido, com o `turno` para cruzar com `turno_externo`.
    expect(RAMO).toContain('kind: "aprendizado_pos_resposta_falhou"');
    expect(RAMO).toContain("persistir: true");
    expect(RAMO).toContain("turno: rastro.turno");
  });

  it("13. a conversa já aconteceu quando a persistência falha", () => {
    const iEnvio = RAMO.indexOf("await enviarEPersistir(");
    const iCatch = RAMO.indexOf('kind: "aprendizado_pos_resposta_falhou"');
    expect(iCatch).toBeGreaterThan(iEnvio);
  });

  it("14. a falha NÃO é relançada — o turno não vira erro para a família", () => {
    const iCatch = RAMO.indexOf("} catch (e) {");
    const bloco = RAMO.slice(iCatch, RAMO.indexOf("return { tratada: true, familia: family.id, resposta: resp }"));
    expect(bloco).not.toContain("throw");
  });
});

describe("SABOTAGEM — os testes mordem?", () => {
  it("S1 · parser antes do envio (o caminho crítico volta a pagar)", () => {
    const iEnvio = RAMO.indexOf("await enviarEPersistir(");
    const sabotado = "parseInbound(" + RAMO;
    expect(sabotado.indexOf("parseInbound(")).toBeLessThan(sabotado.indexOf("await enviarEPersistir("));
    expect(RAMO.indexOf("parseInbound(")).toBeGreaterThan(iEnvio);
  });

  it("S2 · `void` na IIFE (a promise volta a ficar solta e a lambda a mata)", () => {
    // ⚠️ A SABOTAGEM TROCOU DE LADO EM 11/09/2026. Ela testava o retorno do
    // `await`; agora testa o retorno do `void`, que é o que de fato causava
    // dano — 32,8% dos turnos sem aprendizado, medido em produção.
    const sabotado = RAMO.replace("await (async () => {", "void (async () => {");
    expect(sabotado).toContain("void (async () => {");
    expect(RAMO).toContain("await (async () => {");
    expect(RAMO).not.toContain("void (async () => {");
  });

  it("S3 · remover a autoridade do foco (o irmão recebe o aprendizado)", () => {
    const linha = "if (exp.membroId) parsedExp.membro_atipico_id = exp.membroId";
    const sabotado = RAMO.split(linha).join("// removido");
    expect(sabotado).not.toContain(linha);
    expect(RAMO).toContain(linha);
  });

  it("S4 · engolir a falha sem registrar", () => {
    const marca = 'kind: "aprendizado_pos_resposta_falhou"';
    const sabotado = RAMO.split(marca).join("");
    expect(sabotado).not.toContain(marca);
    expect(RAMO).toContain(marca);
  });

  it("S5 · reusar a feature do Legacy (o custo vira indistinguível)", () => {
    const sabotado = RAMO.replace('feature: "ayla_parser_pos"', 'feature: "ayla_parser"');
    expect(sabotado).toContain('feature: "ayla_parser"');
    expect(RAMO).toContain('feature: "ayla_parser_pos"');
  });
});
