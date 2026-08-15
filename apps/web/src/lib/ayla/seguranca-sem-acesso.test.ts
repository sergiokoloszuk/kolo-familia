import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mensagemPedeSeguranca, textoSegurancaSemAcesso } from "./estado-seguranca";

/**
 * SEGURANÇA VEM ANTES DA COBRANÇA — PEND-071, 15/08/2026.
 *
 * ⚠️ O CASO. Uma mãe com o teste vencido escreve à Ayla no meio de uma crise.
 * O gate de assinatura roda antes de qualquer avaliação de risco e devolve
 * `{tratada:true}` em todos os ramos — então ela recebia "seu período grátis
 * acabou, é só assinar aqui", ou, dentro do cooldown de 12h, NADA.
 *
 * ⚠️ A REGRESSÃO QUE ESTE ARQUIVO TAMBÉM PROTEGE. O gate está onde está por um
 * motivo real: o caso Camile/Gramado, em que um entregável (roteiro + PDF) saiu
 * de graça para trial vencido porque o gate vinha depois do handler. A correção
 * NÃO pode reabrir isso. Por isso a saída de segurança é um texto FIXO — sem
 * modelo, sem plano, sem rotina, sem estratégia.
 */

const SRC = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

/**
 * O código sem comentários. Necessário porque os comentários deste trecho
 * CITAM os nomes que os testes procuram ("`reservarConviteAssinatura` governa o
 * convite, não isto") — e a pergunta é sobre o que o código CHAMA, não sobre o
 * que a documentação menciona. Sem isto, escrever um bom comentário quebra o
 * teste, e o incentivo fica invertido.
 */
function semComentarios(t: string): string {
  return t
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
    .join("\n");
}

/** O ramo de segurança, só código. */
function ramoDeSeguranca(): string {
  return semComentarios(
    SRC.slice(SRC.indexOf("const emRisco ="), SRC.indexOf("const podeConvidar")),
  );
}

describe("triagem de entrada — precisão importa mais que recall aqui", () => {
  it("MORDE: pega risco inequívoco", () => {
    for (const m of [
      "acho que ela tentou se matar ontem",
      "não quero mais viver",
      "minha filha falou em suicídio",
      "ele se cortou de novo",
      "tomou uma overdose",
      "eu não aguento mais viver assim",
    ]) {
      expect(mensagemPedeSeguranca(m), `não pegou: "${m}"`).toBe(true);
    }
  });

  it("MORDE: NÃO dispara em conversa comum — falso positivo aqui assusta família", () => {
    // ⚠️ Ao contrário de `riscoEhAtual` ("na dúvida, true"), aqui um engano
    // manda CVV e SAMU para quem perguntou de cobrança. O que escapar cai no
    // comportamento de hoje, que é o convite — perder um caso é ruim, mas hoje
    // perdemos todos.
    for (const m of [
      "quanto custa a assinatura?",
      "quero cancelar",
      "ele não dorme e eu não aguento mais",
      "estou morrendo de cansaço",
      "foi uma crise de birra terrível hoje",
      "a escola matou a aula dele",
      "quero matar a saudade dos avós",
      "",
    ]) {
      expect(mensagemPedeSeguranca(m), `falso positivo em: "${m}"`).toBe(false);
    }
  });
});

describe("o texto que sai", () => {
  const t = textoSegurancaSemAcesso("Juliana");

  it("MORDE: leva os três encaminhamentos", () => {
    expect(t).toContain("192");
    expect(t).toContain("188");
    expect(t).toMatch(/CAPS/);
  });

  it("MORDE: NÃO cobra no meio da crise", () => {
    expect(t.toLowerCase()).not.toMatch(/assin|pagar|plano grátis|período|preço|r\$/);
  });

  it("MORDE: não entrega orientação parental — é encaminhamento", () => {
    expect(t.toLowerCase()).not.toMatch(/estratégia|rotina visual|plano kolo|atividade/);
  });

  it("funciona sem o nome", () => {
    expect(textoSegurancaSemAcesso(null)).toContain("188");
    expect(textoSegurancaSemAcesso(null).startsWith("eu li")).toBe(true);
  });
});

describe("a ordem no orquestrador", () => {
  it("MORDE: a checagem de risco está DENTRO do gate e ANTES do convite", () => {
    const iGate = SRC.indexOf("if (!(await aylaServicoLiberado(supabase, family.id)))");
    const iRisco = SRC.indexOf("const emRisco =");
    const iConvite = SRC.indexOf("const podeConvidar = await reservarConviteAssinatura");
    expect(iGate, "gate sumiu").toBeGreaterThan(0);
    expect(iRisco, "a checagem de risco sumiu do gate").toBeGreaterThan(iGate);
    expect(iRisco, "o convite comercial voltou a vir antes da segurança").toBeLessThan(iConvite);
  });

  it("MORDE: a saída de segurança NÃO passa pelo cooldown do convite", () => {
    // O silêncio dentro das 12h era o pior sintoma: a segunda mensagem de
    // risco não recebia nada.
    const trecho = ramoDeSeguranca();
    expect(trecho).not.toContain("reservarConviteAssinatura");
  });

  it("MORDE: a resposta de segurança sai com tipo `seguranca` — é o que abre o estado", () => {
    const trecho = ramoDeSeguranca();
    expect(trecho).toMatch(/tipo:\s*"seguranca"/);
  });

  it("MORDE: nenhum entregável passa a sair — o ramo é texto fixo (Camile/Gramado)", () => {
    const trecho = ramoDeSeguranca();
    for (const proibido of [
      "gerarRespostaAyla",
      "gerarPlano",
      "gerarRotina",
      "responderExperimental",
      "montarPdf",
    ]) {
      expect(trecho, `o ramo de segurança começou a gerar ${proibido}`).not.toContain(proibido);
    }
  });

  it("MORDE: o ramo termina em `return` — a conversa segue bloqueada", () => {
    const trecho = ramoDeSeguranca();
    expect(trecho).toContain("return { tratada: true");
  });

  it("o gate continua acima dos handlers de entregável", () => {
    // A garantia original não pode ter se perdido no caminho.
    const iGate = SRC.indexOf("if (!(await aylaServicoLiberado(supabase, family.id)))");
    const iSeguranca = SRC.indexOf("const seguranca = await segurancaAberta(");
    expect(iGate).toBeLessThan(iSeguranca);
  });
});
