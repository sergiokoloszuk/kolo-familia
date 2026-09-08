import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { registroDeEnvio } from "./orchestrator";

const ORCH = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

/**
 * PERGUNTA PENDENTE NÃO PODE FECHAR O ESTADO — a mesma invariante do tema,
 * numa pergunta que eu não tinha coberto.
 *
 * Karina, 08/08/2026: pediu a rotina do Dia dos Pais com cartões visuais; a
 * Ayla perguntou de qual filha ("Mario ou Manu?"); ela respondeu "Manu" — e o
 * pedido morreu ali. "Manu" não parece pedido de rotina pro classificador,
 * então caiu no reativo, que respondeu bem e NÃO criou artefato nenhum.
 * Nenhuma rotina foi criada. Dois turnos depois a Ayla oferecia PDF de rotinas
 * antigas.
 */
describe("a resposta da clarificação retoma o pedido", () => {
  it("o pedido viaja junto com a pergunta", () => {
    const fn = ORCH.slice(
      ORCH.indexOf("const perguntarQualCrianca"),
      ORCH.indexOf("De quem é este pedido de rotina?"),
    );
    expect(fn).toMatch(/tipo: "clarificacao_identificacao"/);
    expect(fn).toMatch(/metadataMensagem: \{ pedido: inbound\.texto \}/);
  });

  it("o metadata vai pra MENSAGEM, não pro log de envio", () => {
    // `meta` já existia e vai pro ayla_send_log (auditoria). Estado que a
    // próxima mensagem precisa ler tem que estar em `ayla_messages.metadata`.
    //
    // ⚠️ ATUALIZADO EM 07/09/2026 — a INVARIANTE é a mesma, a forma mudou. Este
    // teste prendia a expressão literal
    //     ...(params.metadataMensagem ? { metadata: params.metadataMensagem } : {})
    // que era um spread SEPARADO, escrito ANTES de `registroDeEnvio`. Como os
    // dois escreviam a mesma chave `metadata`, o registro de envio apagava a
    // metadata do turno inteira: medido em produção, `pedido` aparecia em 0 de
    // 4.498 mensagens de saída. A clarificação nunca conseguiu retomar nada.
    //
    // Agora a composição tem UM dono (`registroDeEnvio`), e é isso que se
    // prende aqui — junto com a garantia que faltava: as duas coisas coexistem.
    expect(ORCH).toMatch(/metadataMensagem\?: Record<string, unknown>;/);
    expect(ORCH).toMatch(/\.\.\.registroDeEnvio\(idsBolhas, params\.metadataMensagem\)/);
    expect(ORCH).not.toMatch(/\{ metadata: params\.metadataMensagem \}/);
  });

  it("a metadata do turno e o registro de envio COEXISTEM", () => {
    // O que o teste acima não cobria, e por isso o defeito passou: as duas
    // fontes escreviam a mesma chave e ninguém conferiu o resultado.
    const composto = registroDeEnvio(["msg-1"], { pedido: "quero a rotina da Manu" });
    expect(composto.metadata.pedido).toBe("quero a rotina da Manu");
    expect(composto.metadata.entrega).toBeTruthy();
  });

  it("a retomada devolve o TEXTO ORIGINAL ao roteamento", () => {
    expect(ORCH).toMatch(/async function retomarPedidoAposClarificacao/);
    expect(ORCH).toMatch(/inbound = \{ \.\.\.inbound, texto: retomada\.pedido \}/);
  });

  it("roda ANTES da classificação de intenção — sem caso especial no roteamento", () => {
    expect(ORCH.indexOf("retomarPedidoAposClarificacao(supabase, family.id, inbound.texto)")).toBeLessThan(
      ORCH.indexOf("await decidirTurno({"),
    );
  });

  it("a criança resolvida vira o membro da conversa", () => {
    expect(ORCH).toMatch(
      /const membroConversa = retomada\?\.membroId \?\? \(await criancaDaConversa\(supabase, family\.id\)\)/,
    );
  });

  it("só retoma quando a última fala da Ayla FOI a clarificação", () => {
    const fn = ORCH.slice(
      ORCH.indexOf("async function retomarPedidoAposClarificacao"),
      ORCH.indexOf("export async function processInbound"),
    );
    expect(fn).toMatch(/ultima\.tipo !== "clarificacao_identificacao"/);
  });

  it("é conservador: resposta curta, que nomeia um membro, e recente", () => {
    const fn = ORCH.slice(
      ORCH.indexOf("async function retomarPedidoAposClarificacao"),
      ORCH.indexOf("export async function processInbound"),
    );
    expect(fn).toMatch(/t\.length > 60/); // resposta longa é outro assunto
    expect(fn).toMatch(/idadeH > 3/); // pergunta velha não captura
    expect(fn).toMatch(/from\("membros_atipicos"\)/); // tem que casar com um nome
    expect(fn).toMatch(/return null/);
  });

  it("falha na retomada não derruba a conversa", () => {
    const fn = ORCH.slice(
      ORCH.indexOf("async function retomarPedidoAposClarificacao"),
      ORCH.indexOf("export async function processInbound"),
    );
    expect(fn).toMatch(/catch \(e\)/);
    expect(fn).toMatch(/console\.error/);
  });
});
