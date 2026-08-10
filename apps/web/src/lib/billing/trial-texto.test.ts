import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O TESTE GRÁTIS É DE 7 DIAS, E NENHUM TEXTO PODE DIZER OUTRA COISA.
 *
 * Em 09/08/2026 uma família em teste de 7 dias podia receber, pelo WhatsApp,
 * a mensagem "te lembrando que seus 30 dias grátis terminam em 3 dias". O
 * template `trial_d3` nasceu na migração 0010, quando o trial era de 30 dias;
 * as migrações 0047 e 0051 encurtaram o trial para 7 e **ninguém voltou no
 * texto**. Duas variações, uma errada — metade das mães avisadas lia 30.
 *
 * O conserto no banco tirou o número em vez de trocá-lo: "seu período grátis
 * termina em 3 dias" continua verdadeiro se o trial mudar de novo. **Número
 * repetido em texto é número que defasa.**
 *
 * Estes testes guardam o código-fonte. O banco teve a sua própria varredura em
 * 09/08: `ayla_message_templates`, `ai_prompts`, `specialist_prompt_templates`
 * e as 381 boas práticas — só o `trial_d3` afirmava duração, e foi corrigido.
 */

const RAIZ = resolve(__dirname, "../../..");

/** Onde o produto fala com a família. Migrações antigas ficam de fora. */
function arquivosDeProduto(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) arquivosDeProduto(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

describe("a duração do teste grátis", () => {
  it("1. existe UMA fonte canônica, e ela diz 7", () => {
    const fonte = readFileSync(resolve(RAIZ, "src/lib/billing/fatos-comerciais.ts"), "utf8");
    expect(fonte).toMatch(/export const TRIAL_DIAS = 7;/);
  });

  it("1b. MORDE: ninguém declara a própria cópia da constante", () => {
    // Ela vivia em TRÊS arquivos, cada um com a sua. Foi assim que o template
    // do WhatsApp ficou dizendo 30 enquanto o código dizia 7.
    const donos: string[] = [];
    for (const f of arquivosDeProduto(resolve(RAIZ, "src"))) {
      if (f.endsWith("fatos-comerciais.ts")) continue;
      if (/const TRIAL_DIAS\s*=/.test(readFileSync(f, "utf8"))) donos.push(f.slice(RAIZ.length + 1));
    }
    expect(donos, `cópias da constante: ${donos.join(", ")}`).toEqual([]);
  });

  it("1c. MORDE: os DOIS canais recebem o fato — ela não pode inferir prazo", () => {
    // Causa raiz de 09/08: nenhum prompt de conversa dizia a duração do teste,
    // e perguntada ela chutava. 30 dias é o palpite de mercado.
    for (const f of ["src/lib/ia/prompt.ts", "src/lib/ayla/responder.ts"]) {
      expect(readFileSync(resolve(RAIZ, f), "utf8"), `${f} não recebe o fato`).toMatch(
        /FATOS_COMERCIAIS/,
      );
    }
  });

  it("1d. MORDE: e ele NÃO mora no núcleo — fato comercial é regra de produto", () => {
    // O núcleo guarda voz e segurança universais. Regra de produto — trial,
    // preço, PDF — mora no módulo do produto e é injetada por quem precisa.
    // Foi tentando pôr isto no núcleo que o teto de 57 mil estourou.
    const nucleo = readFileSync(resolve(RAIZ, "src/lib/conducao/diretrizes.ts"), "utf8");
    expect(nucleo).not.toMatch(/FATOS_COMERCIAIS/);
  });

  it("2. MORDE: nenhum texto de produto promete 30 dias grátis", () => {
    // Pega "30 dias grátis" e "30 dias de teste" — não pega "últimos 30 dias"
    // de painel administrativo, que é outra coisa.
    const PROMESSA = /\b30\s*dias?\s*(gr[áa]tis|gratuitos|de teste)/i;
    const culpados: string[] = [];
    for (const f of arquivosDeProduto(resolve(RAIZ, "src"))) {
      // A fonte canônica EXPLICA os dois "30 dias" pra ninguém os confundir;
      // explicar não é prometer.
      if (f.endsWith("fatos-comerciais.ts")) continue;
      if (PROMESSA.test(readFileSync(f, "utf8"))) culpados.push(f.slice(RAIZ.length + 1));
    }
    expect(culpados, `prometem 30 dias: ${culpados.join(", ")}`).toEqual([]);
  });

  it("3. MORDE: quem fala em dias grátis fala em 7", () => {
    const QUALQUER = /\b(\d+)\s*dias?\s*(gr[áa]tis|gratuitos|de teste)/gi;
    const errados: string[] = [];
    for (const f of arquivosDeProduto(resolve(RAIZ, "src"))) {
      if (f.endsWith("fatos-comerciais.ts")) continue;
      const t = readFileSync(f, "utf8");
      for (const m of t.matchAll(QUALQUER)) {
        if (m[1] !== "7") errados.push(`${f.slice(RAIZ.length + 1)}: "${m[0]}"`);
      }
    }
    expect(errados, `duração errada: ${errados.join(" · ")}`).toEqual([]);
  });
});
