import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { comRetentativaCurta } from "@/lib/conducao/retentativa";

/**
 * A REDE DE SEGURANÇA DO OFICIAL — PEND-151 e o item 9 da PEND-144.
 *
 * ⚠️ O QUE ESTES TESTES PROVAM. `comRetentativaCurta` é exercitada de verdade:
 * limite, ausência de laço e propagação de erro são PROVADOS POR EXECUÇÃO. O
 * resto é asserção estrutural sobre a montagem — prova que a rede está ligada
 * nos pontos certos, **não** que o modelo se recupera de fato. Isso só se
 * observa em produção, e está dito em cada teste que se aplica.
 */

const EXPERIMENTAL = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
const ORCHESTRATOR = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const RESPONDER = readFileSync(resolve(__dirname, "responder.ts"), "utf8");
const PROMPT_WEB = readFileSync(resolve(__dirname, "../ia/prompt.ts"), "utf8");
const TYPES = readFileSync(resolve(__dirname, "types.ts"), "utf8");

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ─────────────────────────────────────────────────────────────────────────────
describe("A · a retentativa é curta, e o limite é PROVADO", () => {
  it("1. caminho saudável: UMA chamada, nem uma a mais", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(comRetentativaCurta(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("2. estourou uma vez → repete UMA vez e entrega", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("503")).mockResolvedValue("ok");
    await expect(comRetentativaCurta(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("3. estourou duas vezes → NÃO entra em laço: para em 2 e propaga", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("503"));
    await expect(comRetentativaCurta(fn)).rejects.toThrow("503");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("4. não há contador, laço nem recursão no corpo — o limite é estrutural", () => {
    const src = semComentarios(
      readFileSync(resolve(__dirname, "../conducao/retentativa.ts"), "utf8"),
    );
    for (const p of ["for ", "while ", "comRetentativaCurta(", "tentativas", "maxRetries"]) {
      expect(src.replace("export async function comRetentativaCurta", "")).not.toContain(p);
    }
  });

  it("5. e ela saiu do Legacy para um módulo neutro", () => {
    expect(semComentarios(RESPONDER)).toMatch(
      /import \{ comRetentativaCurta \} from "@\/lib\/conducao\/retentativa"/,
    );
    expect(semComentarios(RESPONDER)).not.toMatch(/function comRetentativaCurta/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B · resposta vazia ganha UMA segunda chance", () => {
  it("6. o Oficial repete quando o texto vem vazio", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/if \(!texto\) \{[\s\S]{0,200}r = await gerar\(\);/);
  });

  it("7. e a segunda chance NÃO é aninhada — o pior caso é 3, não 4", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("let r = await comRetentativaCurta"), src.indexOf("const msModelo"));
    // a repetição do vazio chama `gerar()` cru, sem passar pela retentativa
    expect(bloco).toMatch(/r = await gerar\(\);/);
    expect(bloco).not.toMatch(/comRetentativaCurta\([\s\S]*comRetentativaCurta\(/);
    expect((bloco.match(/comRetentativaCurta/g) ?? []).length).toBe(1);
  });

  it("8. vazio duas vezes → ainda cede, mas com o motivo distinguível", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/onFalha\?\.\(\s*"LLM_RESPOSTA_VAZIA"/);
    expect(src).toMatch(/sem texto duas vezes/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C · a fronteira deixa de ser uma queda", () => {
  it("9. o Oficial regenera com a instrução da própria fronteira", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/gerar\(vazamento\.fronteira\.instrucao\(vazamento\.achados\)\)/);
  });

  it("10. se a segunda ainda vazar, sai o PISO — e não `null`", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("if (vazamento) {"), src.indexOf("await logarUsoApi"));
    expect(bloco).toMatch(/\.fronteira\.piso\(\{/);
    expect(bloco).not.toMatch(/return null;/);
  });

  it("11. UMA regeneração, nunca duas — `aindaVaza` não realimenta", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("if (vazamento) {"), src.indexOf("await logarUsoApi"));
    expect((bloco.match(/gerar\(/g) ?? []).length).toBe(1);
  });

  it("12. e os dois eventos da fronteira continuam, marcados como do Oficial", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/kind: "ayla_fronteira_regenerou"/);
    expect(src).toMatch(/kind: "ayla_fronteira_piso"/);
    expect(src).toMatch(/caminho: "oficial"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D · contexto nulo ganha uma segunda leitura", () => {
  it("13. o Oficial relê antes de ceder", () => {
    const src = semComentarios(ORCHESTRATOR);
    const bloco = src.slice(src.indexOf("if (ehFamiliaExperimental"), src.indexOf("const exp = ctxExp"));
    // ⚠️ contar `await loadFamiliaParaEnvio`, não o nome solto: a terceira
    // ocorrência é a STRING dentro do `registrarQueda`, e contá-la mediria prosa.
    expect((bloco.match(/await loadFamiliaParaEnvio\(/g) ?? []).length).toBe(2);
    expect(bloco).toMatch(/CONTEXTO_NULO", "loadFamiliaParaEnvio devolveu null duas vezes/);
  });

  it("14. a segunda leitura não pode derrubar o turno", () => {
    const src = semComentarios(ORCHESTRATOR);
    expect(src).toMatch(/loadFamiliaParaEnvio\(supabase, family\.id\)\.catch\(\(\) => null\)/);
  });
});


/**
 * A REDE DE ÚLTIMA INSTÂNCIA, localizada pelo que ela FAZ — 26/08/2026.
 *
 * ⚠️ ESTE HELPER SUBSTITUI UMA ÂNCORA FRÁGIL, e o motivo fica escrito. Os
 * testes 15-18 procuravam o PRIMEIRO `if (!ctx) {` do orquestrador. Isso
 * funcionava por acidente de ordem: bastava outra função ganhar a mesma guarda
 * acima desta para os três testes passarem a medir o bloco errado — foi
 * exatamente o que aconteceu quando `sendTrial` ganhou tratamento de contexto
 * ausente (fechamento do Trial, 26/08).
 *
 * A rede não é "o primeiro `if (!ctx)`": é o bloco que manda
 * `TEXTO_NAO_CONSEGUI_AGORA`. Ancorar nisso é ancorar no comportamento que a
 * PEND-151 existe para proteger — e nenhuma função nova pode deslocá-lo.
 */
function blocoDaRede(src: string): string {
  const i = src.indexOf("TEXTO_NAO_CONSEGUI_AGORA,");
  if (i < 0) return "";
  const abre = src.lastIndexOf("if (!ctx) {", i);
  return src.slice(abre >= 0 ? abre : Math.max(0, i - 900), i + 300);
}
// ─────────────────────────────────────────────────────────────────────────────
describe("E · o SILÊNCIO deixou de ser um estado final", () => {
  it("15. a saída muda vira recado honesto, com evento persistido", () => {
    const src = semComentarios(ORCHESTRATOR);
    expect(src).not.toMatch(/if \(!ctx\) return \{ tratada: true, familia: family\.id \};/);
    const bloco = blocoDaRede(src);
    expect(bloco).toMatch(/kind: "ayla_sem_contexto"/);
    expect(bloco).toMatch(/persistir: true/);
    expect(bloco).toMatch(/texto: TEXTO_NAO_CONSEGUI_AGORA/);
  });

  it("16. o telefone vem do INBOUND — é o contexto que faltou", () => {
    const src = semComentarios(ORCHESTRATOR);
    const bloco = blocoDaRede(src);
    expect(bloco).toMatch(/phone: inbound\.phoneE164/);
    expect(bloco).not.toMatch(/ctx\?\.whatsapp_e164/);
  });

  it("17. o recado é honesto: não finge, não inventa, não expõe erro técnico", () => {
    const m = ORCHESTRATOR.match(/const TEXTO_NAO_CONSEGUI_AGORA =\s*\n?\s*"([^"]+)"/);
    expect(m).not.toBeNull();
    const texto = m![1];
    expect(texto.length).toBeLessThan(160);
    expect(texto).toMatch(/de novo|novamente/i);
    for (const proibido of ["erro", "API", "modelo", "sistema", "servidor", "legacy", "timeout", "falha"]) {
      expect(texto.toLowerCase()).not.toContain(proibido.toLowerCase());
    }
  });

  it("18. e tem tipo PRÓPRIO — não se confunde com mídia não suportada", () => {
    expect(TYPES).toMatch(/\| "indisponivel"/);
    expect(TYPES).toMatch(/\| "midia_nao_suportada"/);
    const src = semComentarios(ORCHESTRATOR);
    const bloco = blocoDaRede(src);
    expect(bloco).toMatch(/tipo: "indisponivel"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("F · o que NÃO pode ter mudado", () => {
  it("19. a telemetria das cinco portas continua inteira", () => {
    const src = semComentarios(ORCHESTRATOR + EXPERIMENTAL);
    for (const m of [
      "FORA_DO_OFICIAL",
      "CONTEXTO_NULO",
      "LLM_RESPOSTA_VAZIA",
      "FRONTEIRA_BARROU",
      "EXCECAO",
    ]) {
      expect(src).toContain(m);
    }
    expect(src).toMatch(/kind: "ayla_oficial_cedeu"/);
  });

  it("20. áudio continua distinguível no evento", () => {
    const src = semComentarios(ORCHESTRATOR);
    expect(src).toMatch(/midia: inbound\.midiaTipo === "audio" \? "audio" : "texto"/);
  });

  it("21. o texto da conversa NÃO entra em payload de erro nenhum", () => {
    const src = semComentarios(ORCHESTRATOR);
    for (const marca of ['kind: "ayla_oficial_cedeu"', 'kind: "ayla_sem_contexto"']) {
      const i = src.indexOf(marca);
      expect(i).toBeGreaterThan(-1);
      const bloco = src.slice(i, i + 700);
      expect(bloco).not.toMatch(/inbound\.texto/);
      expect(bloco).not.toMatch(/mensagem:\s*inbound/);
    }
  });

  it("22. falha da telemetria não impede a resposta", () => {
    // `logEvent` engole a própria falha, por construção — e a resposta é enviada
    // por `enviarEPersistir`, que não depende dela.
    const log = readFileSync(resolve(__dirname, "../log.ts"), "utf8");
    expect(log.slice(log.indexOf("if (!evt.persistir"))).toMatch(/try \{[\s\S]*catch/);
  });

  it("23. o Legacy NÃO ganhou lógica nova — só perdeu a função que mudou de casa", () => {
    const src = semComentarios(RESPONDER);
    expect(src).not.toMatch(/IDIOMA_DA_CONVERSA|TEXTO_NAO_CONSEGUI_AGORA|ayla_sem_contexto/);
    expect(src).toMatch(/gerarRespostaAyla/); // segue disponível como rede final
  });

  it("24. a Web não mudou", () => {
    for (const proibido of ["comRetentativaCurta", "TEXTO_NAO_CONSEGUI_AGORA", "ayla_sem_contexto"]) {
      expect(PROMPT_WEB).not.toContain(proibido);
    }
  });

  it("25. PEND-149 (visão) e PEND-150 (progressão) seguem intocadas", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).not.toMatch(/imagemUrl|baixarImagemBase64/);
    expect(src).not.toMatch(/angulosUsados|blocoProgressao/);
  });

  it("26. a regra de idioma publicada continua intacta e por último", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/IDIOMA_DA_CONVERSA/);
    const bloco = src.slice(src.indexOf("const formato = ["), src.indexOf(".filter(Boolean)", src.indexOf("const formato = [")));
    const itens = bloco.split(",").map((x) => x.trim()).filter((x) => /[A-Za-z]/.test(x));
    expect(itens.at(-1)).toContain("IDIOMA_DA_CONVERSA");
  });

  it("27. o caminho saudável não ganhou consulta nem chamada estrutural", () => {
    const src = semComentarios(EXPERIMENTAL);
    // a segunda leitura de contexto e a regeneração são CONDICIONAIS
    expect(semComentarios(ORCHESTRATOR)).toMatch(/if \(!ctxExp\) \{[\s\S]{0,300}loadFamiliaParaEnvio/);
    expect(src).toMatch(/if \(vazamento\) \{/);
    expect(src).toMatch(/if \(!texto\) \{/);
  });
});
