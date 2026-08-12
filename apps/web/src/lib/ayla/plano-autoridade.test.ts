import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { atoSobreArtefato } from "@/lib/conducao/ato-artefato";
import { pedeUmPlano } from "@/lib/ia/pedido-plano";

/**
 * AUTORIDADE SOBRE O ARTEFATO PLANO — o caso Mário (produção, 11/08/2026).
 *
 * A mãe perguntou "Você já tinha informação suficiente para montar um plano?
 * Dentro de perfil, você salvou o que sobre ele?". Ela estava AUDITANDO o plano
 * que acabara de receber. `montar` casou em `pedeUmPlano`, e `querPlano` liga
 * três coisas de uma vez, todas no orquestrador:
 *
 *   1. `forcar: querPlano` na ponte — fura dedup e intenção, entrega na hora;
 *   2. `ehEntrega()` devolve false — a resposta muda de forma;
 *   3. o prompt recebe "a pessoa está PEDINDO um plano".
 *
 * MEDIDO: `pedeUmPlano` sozinho abre para 3 atos errados — `conversar_sobre`,
 * `reenviar` ("manda o plano de novo" gerava um plano NOVO) e `recusar` ("não
 * quero outro plano" gerava um plano). E preserva 10 de 10 pedidos legítimos
 * depois do ato — nenhum pedido real foi suprimido pela correção.
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

/** O portão real de criação de Plano, reproduzido. */
const criaPlano = (t: string) => pedeUmPlano(t) && atoSobreArtefato(t) === "criar";

describe("o pedido legítimo de Plano continua criando", () => {
  it("1. MORDE: os dez pedidos reais, inclusive os que pedem a COISA", () => {
    for (const t of [
      "faz um plano para melhorar a comunicação do Mário",
      "quero um plano pra ajudar ela na escola",
      "me monta um plano pra birra do supermercado",
      "pode fazer um plano pra gente trabalhar a fala dele?",
      "queria um passo a passo pra desfralde",
      "monta um roteiro pra hora do dever",
      "vc consegue montar um plano pra isso?",
      // Estes três eram `ambiguo` antes de PEDIDO_DE_COISA existir: o artefato
      // é o OBJETO do pedido, e não há verbo de produzir na frase.
      "preciso de um plano pra ele dormir sozinho",
      "gostaria de um plano de ação",
      "me ajuda com um plano pra socializacao",
    ]) {
      expect(criaPlano(t), `"${t}" foi BLOQUEADO`).toBe(true);
    }
  });
});

describe("perguntar sobre o plano não gera outro plano", () => {
  it("2. MORDE: o caso Mário, nas duas formulações reais", () => {
    for (const t of [
      "Você já tinha informação suficiente para montar um plano? Dentro de perfil, você salvou o que sobre ele?",
      "o que você salvou sobre ele no perfil para fazer esse plano?",
    ]) {
      expect(atoSobreArtefato(t), `"${t}"`).toBe("conversar_sobre");
      expect(pedeUmPlano(t), `"${t}" nem chega no piso — o caso perdeu a graça`).toBe(true);
      expect(criaPlano(t), `"${t}" GEROU um plano`).toBe(false);
    }
  });

  it("3. MORDE: recusar não pode virar criação", () => {
    // Ela disse que NÃO queria — e recebia um plano. É o oposto do que pediu.
    for (const t of ["não quero outro plano", "n quero plano agora, só quero entender"]) {
      expect(atoSobreArtefato(t)).toBe("recusar");
      expect(criaPlano(t), `"${t}" GEROU um plano`).toBe(false);
    }
  });

  it("4. MORDE: reenviar não gera um plano novo", () => {
    expect(atoSobreArtefato("manda o plano de novo")).toBe("reenviar");
    expect(criaPlano("manda o plano de novo")).toBe(false);
  });

  it("5. editar não abre este portão — não existe caminho de edição de Plano", () => {
    // A ponte só sabe GERAR. Deixar `editar` abrir produziria um plano a mais
    // em vez de ajustar o que existe. Registrado como lacuna, não como bug novo.
    expect(atoSobreArtefato("ajusta aquele plano")).toBe("editar");
    expect(criaPlano("ajusta aquele plano")).toBe(false);
  });
});

describe("o portão real do orquestrador", () => {
  it("6. MORDE: `querPlano` compõe piso + ato de criar", () => {
    expect(ORCH).toMatch(
      /const querPlano =\s*\n\s*\(pedeUmPlano\(args\.params\.mensagem\) &&\s*\n\s*atoSobreArtefato\(args\.params\.mensagem\) === "criar"\)/,
    );
  });

  it("7. MORDE: a oferta aceita continua valendo sem o ato", () => {
    // "sim" / "pode fazer" depois de a Ayla OFERECER. Exigir o ato ali
    // obrigaria a mãe a repetir o pedido por extenso.
    expect(ORCH).toMatch(
      /ehAfirmacaoCurta\(args\.params\.mensagem\) &&\s*\n\s*\(await ofertouPlanoRecente\(supabase, args\.family_account_id\)\)/,
    );
  });

  it("8. MORDE: os outros consumidores de pedeUmPlano ficaram intocados", () => {
    // `objetivo.ts` usa o booleano com OUTRA semântica (a fala é substantiva?),
    // e está protegido pela PEND-035. A Web usa como sinal de UI. Trocar os
    // três de uma vez seria dar a mesma semântica a perguntas diferentes.
    const OBJ = readFileSync(resolve(__dirname, "../conducao/objetivo.ts"), "utf8");
    expect(OBJ).toMatch(/if \(pedeUmPlano\(texto \?\? ""\)\) \{/);
    expect(OBJ).not.toMatch(/atoSobreArtefato/);
  });
});
