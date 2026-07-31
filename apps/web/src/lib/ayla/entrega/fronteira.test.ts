import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * TESTE ARQUITETURAL — a regra do ADR 0001 vira falha de teste, não combinado.
 *
 * "Somente a camada de Publicação pode falar com o WhatsApp." Antes desta
 * etapa havia 13 pontos de envio em 10 arquivos, e qualquer um publicava sem
 * validação nenhuma. Sem um teste como este, o décimo quarto aparece na
 * próxima feature e ninguém percebe até vazar de novo.
 */

const SRC = resolve(__dirname, "../../..");

/** Quem PODE importar o sender, e por quê. */
const PERMITIDOS = new Map<string, string>([
  ["lib/ayla/entrega/publicacao.ts", "é a fronteira: a única porta para a família"],
  ["lib/ayla/entrega/publicacao.test.ts", "mocka o sender para testar a fronteira"],
  ["lib/admin/notificacoes.ts", "canal administrativo — Karina, não família"],
  ["app/api/ayla/cron/route.ts", "healthcheck operacional para o admin"],
  ["app/admin/familias/actions.ts", "ação manual do admin (bloquear número)"],
  ["app/(app)/dashboards/abordagem/[familyId]/actions.ts", "abordagem manual do CRM"],
  ["app/(app)/painel/ativar-actions.ts", "ativação do WhatsApp pela própria usuária na web"],
  // O destinatário NÃO é uma família: é quem escreveu sem ter cadastro. A
  // fronteira pressupõe uma — `ayla_publicacoes.family_account_id` é NOT NULL
  // com FK, e `publicar()` grava a trava de entrega única lá. Sem família não
  // há o que travar. A propriedade equivalente existe no módulo: uma resposta
  // por número a cada 7 dias, e nunca IA.
  ["lib/ayla/desconhecido.ts", "convite de cadastro para número sem família — publicar() exige família"],
  ["lib/ayla/whatsappSender.ts", "é o próprio módulo"],
]);

function arquivosTs(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next") continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosTs(caminho, acc);
    else if (/\.tsx?$/.test(nome)) acc.push(caminho);
  }
  return acc;
}

/** As funções que efetivamente falam com a Z-API. */
const FUNCOES_DE_ENVIO = ["enviarTexto", "enviarDocumento"];

/**
 * Importa alguma FUNÇÃO DE ENVIO do módulo?
 *
 * Não basta olhar de onde se importa: `whatsappSender` também exporta o parser
 * do webhook (`parseZapiWebhook`) e o tipo `InboundWhatsApp`, que não publicam
 * nada. O que interessa é o que foi importado.
 */
function importaSender(conteudo: string): boolean {
  const re = /(^|\n)\s*import\s+(type\s+)?([^;]*?)from\s+["'][^"']*whatsappSender["']/g;
  for (const m of conteudo.matchAll(re)) {
    if (m[2]) continue; // `import type` some na compilação
    const nomes = (m[3] ?? "")
      .replace(/[{}]/g, "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (nomes.some((n) => FUNCOES_DE_ENVIO.includes(n))) return true;
  }
  return false;
}

describe("fronteira única de publicação", () => {
  it("ninguém importa o sender fora da lista de permitidos", () => {
    const infratores: string[] = [];
    for (const caminho of arquivosTs(SRC)) {
      const rel = relative(SRC, caminho).replace(/\\/g, "/");
      if (!importaSender(readFileSync(caminho, "utf8"))) continue;
      if (!PERMITIDOS.has(rel)) infratores.push(rel);
    }
    expect(
      infratores,
      `Estes arquivos publicam direto no WhatsApp, contornando publicar() ` +
        `(ADR 0001). Use publicar() para a família ou notificarAdmin() para ` +
        `comunicação interna:\n  ${infratores.join("\n  ")}`,
    ).toEqual([]);
  });

  it("o orquestrador NÃO fala mais com o WhatsApp", () => {
    const orq = readFileSync(join(SRC, "lib/ayla/orchestrator.ts"), "utf8");
    expect(importaSender(orq)).toBe(false);
  });

  it("as ferramentas (ponte, rotina guiada) NÃO publicam", () => {
    for (const f of ["lib/ayla/ponte.ts", "lib/ayla/rotina-guiada.ts"]) {
      const conteudo = readFileSync(join(SRC, f), "utf8");
      expect(importaSender(conteudo), `${f} não pode publicar direto`).toBe(false);
    }
  });

  it("o gerador de resposta não recebe mais callback de parágrafo", () => {
    const resp = readFileSync(join(SRC, "lib/ayla/responder.ts"), "utf8");
    // A assinatura antiga publicava enquanto o modelo gerava — era a origem
    // dos vazamentos, porque não existia um instante em que a resposta
    // completa estivesse em memória.
    expect(/onParagrafo\?:\s*\(/.test(resp)).toBe(false);
    expect(/await\s+onParagrafo\(/.test(resp)).toBe(false);
  });

  it("todo permitido tem justificativa escrita", () => {
    for (const [arquivo, motivo] of PERMITIDOS) {
      expect(motivo.length, `${arquivo} sem justificativa`).toBeGreaterThan(10);
    }
  });
});
