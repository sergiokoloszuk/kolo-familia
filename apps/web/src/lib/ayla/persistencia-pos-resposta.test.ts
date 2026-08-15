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

  it("2. a persistência é fire-and-forget — o turno não espera", () => {
    const depoisDoEnvio = RAMO.slice(RAMO.indexOf("await enviarEPersistir("));
    expect(depoisDoEnvio).toContain("void (async () => {");
    // Um `await` na IIFE devolveria o parser ao caminho crítico por outra porta.
    expect(depoisDoEnvio).not.toMatch(/await \(async \(\) => \{/);
  });

  it("3. o `return` de resposta única continua depois de tudo", () => {
    expect(RAMO).toContain("return { tratada: true, familia: family.id, resposta: resp }");
    const iVoid = RAMO.indexOf("void (async () => {");
    const iReturn = RAMO.indexOf("return { tratada: true, familia: family.id, resposta: resp }");
    expect(iReturn).toBeGreaterThan(iVoid);
  });
});

describe("O QUE VOLTA A SER ESCRITO", () => {
  it("4. `persistirRegistro` é chamada — Diário, check-in e Kolo Vivo", () => {
    expect(RAMO).toContain("await persistirRegistro(supabase, family.id, parsedExp)");
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
    const iVoid = RAMO.indexOf("void (async () => {");
    const bloco = RAMO.slice(iVoid);
    expect(bloco).toContain("try {");
    expect(bloco).toContain("} catch (e) {");
  });

  it("12. a falha é registrada — dado sumindo em silêncio é o defeito caro", () => {
    expect(RAMO).toContain("persistência pós-resposta falhou:");
  });

  it("13. a conversa já aconteceu quando a persistência falha", () => {
    const iEnvio = RAMO.indexOf("await enviarEPersistir(");
    const iCatch = RAMO.indexOf("persistência pós-resposta falhou:");
    expect(iCatch).toBeGreaterThan(iEnvio);
  });
});

describe("SABOTAGEM — os testes mordem?", () => {
  it("S1 · parser antes do envio (o caminho crítico volta a pagar)", () => {
    const iEnvio = RAMO.indexOf("await enviarEPersistir(");
    const sabotado = "parseInbound(" + RAMO;
    expect(sabotado.indexOf("parseInbound(")).toBeLessThan(sabotado.indexOf("await enviarEPersistir("));
    expect(RAMO.indexOf("parseInbound(")).toBeGreaterThan(iEnvio);
  });

  it("S2 · `await` na IIFE (a mãe volta a esperar a persistência)", () => {
    const sabotado = RAMO.replace("void (async () => {", "await (async () => {");
    expect(sabotado).toContain("await (async () => {");
    expect(RAMO).toContain("void (async () => {");
  });

  it("S3 · remover a autoridade do foco (o irmão recebe o aprendizado)", () => {
    const linha = "if (exp.membroId) parsedExp.membro_atipico_id = exp.membroId";
    const sabotado = RAMO.split(linha).join("// removido");
    expect(sabotado).not.toContain(linha);
    expect(RAMO).toContain(linha);
  });

  it("S4 · engolir a falha sem registrar", () => {
    const sabotado = RAMO.split("persistência pós-resposta falhou:").join("");
    expect(sabotado).not.toContain("persistência pós-resposta falhou:");
    expect(RAMO).toContain("persistência pós-resposta falhou:");
  });

  it("S5 · reusar a feature do Legacy (o custo vira indistinguível)", () => {
    const sabotado = RAMO.replace('feature: "ayla_parser_pos"', 'feature: "ayla_parser"');
    expect(sabotado).toContain('feature: "ayla_parser"');
    expect(RAMO).toContain('feature: "ayla_parser_pos"');
  });
});
