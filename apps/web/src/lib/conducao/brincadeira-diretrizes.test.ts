import { describe, expect, it } from "vitest";
import { DIRETRIZES_BRINCADEIRA, REGRA_BRINCADEIRA_SE_SURGIR } from "./brincadeira-diretrizes";
import { assemblePrompt, quantidadeDeBrincadeirasNoFormato, type OutputTypeData } from "@/lib/ia/prompt";
import { montarSistemaRepertorio } from "@/lib/ayla/repertorio";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ContextoSkillResposta } from "@/lib/ia/context";

const ctx = {
  cuidador: null,
  membroFoco: null,
  membros: [],
  familia: {},
  diariosRecentes: [],
  ultimoCheckin: null,
  perfilConsultavel: null,
  base2: [],
  boasPraticas: [],
  historico: [],
} as unknown as ContextoSkillResposta;

const prompt = (pedido: string, outputType?: OutputTypeData) => assemblePrompt({
  skills: [], ctx, userInput: pedido,
  modo: outputType ? { kind: "output_type", outputType } : { kind: "conversa" },
});

describe("diretrizes de brincadeira entre superfícies", () => {
  it("exige turnos concretos, adaptação e segurança, sem impor três a todo canal", () => {
    expect(DIRETRIZES_BRINCADEIRA).toContain("uma frase literal e natural de quem cuida");
    expect(DIRETRIZES_BRINCADEIRA).toContain("modo em que se comunica");
    expect(DIRETRIZES_BRINCADEIRA).toContain("virada concreta");
    expect(DIRETRIZES_BRINCADEIRA).toContain("mesmo baixo, suave ou por segundos");
    expect(DIRETRIZES_BRINCADEIRA).toContain("mecânicas diferentes");
    expect(DIRETRIZES_BRINCADEIRA).toContain("quantidade pedida pelo formato");
  });
  it("pedido direto no WhatsApp e conversa web recebem o mesmo núcleo", () => {
    const oficial = readFileSync(resolve(__dirname, "../ayla/experimental.ts"), "utf8");
    expect(oficial).toContain('DIRETRIZES_BRINCADEIRA, REGRA_BRINCADEIRA_SE_SURGIR } from "@/lib/conducao/brincadeira-diretrizes"');
    expect(oficial).toContain('posTrial ? "" : REGRA_BRINCADEIRA_SE_SURGIR');
    expect(oficial).toContain("${DIRETRIZES_BRINCADEIRA}\\n${BLOCO_PEDIDO_BRINCADEIRA}");
    const web = prompt("Quero uma brincadeira para fazer com Manu");
    expect(String(web.messages.at(-1)?.content)).toContain(DIRETRIZES_BRINCADEIRA);
    expect(String(web.messages.at(-1)?.content)).toContain("três alternativas");
    expect(String(prompt("Quero uma brincadeira no mercado").messages.at(-1)?.content)).toContain("Mímica com personagem");
    expect(String(prompt("Como ajudar no barulho?").messages.at(-1)?.content)).not.toContain(DIRETRIZES_BRINCADEIRA);
    expect(prompt("Como ajudar no barulho?").system[0].text).toContain(REGRA_BRINCADEIRA_SE_SURGIR);
  });
  it("botão de brincadeiras inclui o núcleo; manejo e crenças não o recebem", () => {
    const tipo = (key: string): OutputTypeData => ({ key, label: key, prompt_template: "Formato salvo no banco" });
    expect(prompt("Quero ajuda", tipo("brincadeiras")).system[0].text).toContain(DIRETRIZES_BRINCADEIRA);
    expect(String(prompt("Quero uma brincadeira no mercado", tipo("brincadeiras")).messages.at(-1)?.content)).toContain("Siga a quantidade de brincadeiras definida pelo formato");
    expect(prompt("Quero ajuda", tipo("o_que_fazer_diferente")).system[0].text).not.toContain(DIRETRIZES_BRINCADEIRA);
    expect(prompt("Quero ajuda", tipo("crencas")).system[0].text).not.toContain(DIRETRIZES_BRINCADEIRA);
    expect(prompt("Quero ajuda", tipo("crencas")).system[0].text).toContain(REGRA_BRINCADEIRA_SE_SURGIR);
  });
  it("não reduz o apoio de 2–3 jogos a uma ideia nem multiplica o aprofundamento", () => {
    expect(quantidadeDeBrincadeirasNoFormato("Sugira 2 a 3 brincadeiras concretas")).toContain("2 a 3 brincadeiras COMPLETAS");
    expect(quantidadeDeBrincadeirasNoFormato("Crie UMA ideia principal muito boa")).toContain("UMA brincadeira completa");
    const tipo = (prompt_template: string): OutputTypeData => ({ key: "brincadeiras", label: "Brincadeiras", prompt_template });
    expect(String(prompt("Quero uma brincadeira no mercado", tipo("Sugira 2 a 3 brincadeiras concretas")).messages.at(-1)?.content)).toContain("2 a 3 brincadeiras COMPLETAS");
    expect(String(prompt("Quero uma brincadeira no mercado", tipo("Crie UMA ideia principal muito boa")).messages.at(-1)?.content)).toContain("UMA brincadeira completa");
  });
  it("sugestão espontânea mantém uma só opção mesmo com prompt antigo no banco", () => {
    const sistema = montarSistemaRepertorio("Prompt salvo antigo");
    expect(sistema).toContain("Prompt salvo antigo");
    expect(sistema).toContain(DIRETRIZES_BRINCADEIRA);
    expect(sistema).toContain("sem criar uma segunda sugestão");
  });
  it("rota residual do WhatsApp também tem a diretriz quando o oficial falha", () => {
    const src = readFileSync(resolve(__dirname, "../ayla/responder.ts"), "utf8");
    expect(src).toContain("pedidoExplicitoDeBrincadeira(params.mensagem)");
    expect(src).toContain("Entregue três alternativas de mecânicas distintas");
    expect(src).toContain("${DIRETRIZES_BRINCADEIRA}");
    expect(src).toContain("REGRA_BRINCADEIRA_SE_SURGIR,");
  });
});
