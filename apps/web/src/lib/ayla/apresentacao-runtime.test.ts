import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paraWhatsApp } from "./apresentacao";
import { dividirEmBolhas, ritmoDasBolhas } from "./bolhas";

/**
 * `paraWhatsApp` NO CAMINHO DE TODA FAMÍLIA.
 *
 * ⚠️ Esta é a diferença entre este arquivo e `apresentacao.test.ts`. Lá se
 * prova que a função faz a coisa certa. Aqui se prova que ela ESTÁ NO CAMINHO,
 * no lugar certo, e que não trouxe carona nenhuma junto — nem chamada de
 * modelo, nem consulta ao banco, nem latência que se note.
 *
 * As duas provas são necessárias: uma função perfeita fora do caminho não
 * conserta nada, e uma função no caminho errado quebra o que funcionava.
 */

const orch = readFileSync(
  join(process.cwd(), "src/lib/ayla/orchestrator.ts"),
  "utf8",
);
const apres = readFileSync(
  join(process.cwd(), "src/lib/ayla/apresentacao.ts"),
  "utf8",
);

describe("ESTÁ NO CAMINHO, e no lugar certo", () => {
  it("1. o orquestrador importa a função", () => {
    expect(orch).toMatch(/import \{[^}]*\bparaWhatsApp\b[^}]*\} from "\.\/apresentacao"/);
  });

  it("2. ela roda ANTES de dividirEmBolhas, na mesma expressão", () => {
    // Aninhada, não em duas linhas: não há como alguém inserir um passo entre
    // as duas sem que este teste veja.
    expect(orch).toContain("dividirEmBolhas(paraWhatsApp(textoCompleto))");
  });

  it("3. não sobrou nenhuma chamada crua a dividirEmBolhas no runtime", () => {
    // SABOTAGEM CONTRA MIM MESMA: se houvesse um segundo ponto de publicação
    // que eu não vi, ele continuaria mandando Markdown cru e este teste
    // apontaria o dedo. `VI NO CÓDIGO` que hoje existe um só.
    const chamadas = orch.match(/dividirEmBolhas\(/g) ?? [];
    expect(chamadas).toHaveLength(1);
    expect(orch).not.toMatch(/dividirEmBolhas\(textoCompleto\)/);
  });
});

describe("NÃO TROUXE CARONA — o custo do turno não muda", () => {
  it("4. a função é síncrona e pura: sem await, sem Promise", () => {
    expect(apres).not.toMatch(/\basync\b/);
    expect(apres).not.toMatch(/\bawait\b/);
    expect(apres).not.toMatch(/Promise/);
  });

  it("5. não chama modelo nenhum", () => {
    for (const t of ["openai", "anthropic", "gerar", "chamarModelo", "fetch"]) {
      expect(apres.toLowerCase()).not.toContain(t.toLowerCase());
    }
  });

  it("6. não toca no banco", () => {
    for (const t of ["supabase", ".from(", "select", "insert"]) {
      expect(apres.toLowerCase()).not.toContain(t.toLowerCase());
    }
  });

  it("7. não importa nada — nem um módulo", () => {
    expect(apres).not.toMatch(/^import /m);
  });

  it("8. MEDIDO: o custo dela é ruído perto do turno (~5,2s de mediana)", () => {
    // Uma resposta longa e suja, pior caso realista.
    const texto = Array.from(
      { length: 40 },
      (_, i) =>
        `## Bloco ${i}\n\nTexto **forte** com \`código\` e https://kolo.com.br/a_b?x=1 e 18h30 e 💛\n\n* item um\n* item dois\n\n---`,
    ).join("\n\n");

    const t0 = performance.now();
    for (let i = 0; i < 200; i++) paraWhatsApp(texto);
    const porChamada = (performance.now() - t0) / 200;

    console.log(
      `\n  MEDIDO: ${texto.length} chars · ${porChamada.toFixed(3)} ms por chamada` +
        ` · ${((porChamada / 5200) * 100).toFixed(4)}% do turno mediano\n`,
    );
    // Teto folgado de propósito: o que se prova é a ordem de grandeza, não um
    // número exato — número exato num teste vira flake em máquina lenta.
    expect(porChamada).toBeLessThan(50);
  });
});

describe("REGRESSÃO — o que funcionava continua funcionando", () => {
  it("9. resposta limpa passa intacta e produz as MESMAS bolhas de antes", () => {
    const t =
      "Entendo, isso cansa mesmo.\n\n*O que eu faria primeiro*\n\nTire o prato antes do banho.\n\nDepois me conta o que mudou.";
    expect(paraWhatsApp(t)).toBe(t);
    expect(dividirEmBolhas(paraWhatsApp(t))).toEqual(dividirEmBolhas(t));
  });

  it("10. o ritmo não muda quando o texto não muda", () => {
    const t = "Um bloco.\n\nOutro bloco.\n\nUm terceiro.";
    expect(ritmoDasBolhas(dividirEmBolhas(paraWhatsApp(t)))).toEqual(
      ritmoDasBolhas(dividirEmBolhas(t)),
    );
  });

  it("11. o título continua grudando no bloco que ele intitula", () => {
    // A regra que existia antes e não pode ter sido quebrada pela conversão.
    expect(dividirEmBolhas(paraWhatsApp("## Agora\n\nFaça isso.\n\nDepois isso."))).toEqual([
      "*Agora*\nFaça isso.",
      "Depois isso.",
    ]);
  });

  it("12. o teto de espera continua valendo depois da conversão", () => {
    const sujo = Array.from({ length: 12 }, (_, i) => `## T${i}\n\nBloco ${i} aqui.`).join("\n\n");
    const ritmo = ritmoDasBolhas(dividirEmBolhas(paraWhatsApp(sujo)));
    expect(ritmo.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(4);
  });

  it("13. texto vazio ou só espaço não explode nem cria bolha fantasma", () => {
    expect(paraWhatsApp("")).toBe("");
    expect(dividirEmBolhas(paraWhatsApp("   \n\n  "))).toEqual([]);
  });
});

describe("SABOTAGEM — os testes mordem?", () => {
  it("S1 · se a função sair do caminho, o teste 2 quebra", () => {
    const semLigacao = orch.replace(
      "dividirEmBolhas(paraWhatsApp(textoCompleto))",
      "dividirEmBolhas(textoCompleto)",
    );
    expect(semLigacao).not.toContain("dividirEmBolhas(paraWhatsApp(textoCompleto))");
    expect(orch).toContain("dividirEmBolhas(paraWhatsApp(textoCompleto))");
  });

  it("S2 · se ela rodasse DEPOIS das bolhas, o título se separaria do bloco", () => {
    // Prova que a ORDEM importa, e não é preferência estética.
    const t = "## Agora\n\nFaça isso.";
    const certo = dividirEmBolhas(paraWhatsApp(t));
    const errado = dividirEmBolhas(t).map(paraWhatsApp);
    expect(certo).toEqual(["*Agora*\nFaça isso."]);
    expect(errado).toEqual(["*Agora*", "Faça isso."]); // duas bolhas, uma com uma palavra
    expect(certo).not.toEqual(errado);
  });

  it("S3 · se ela ganhasse um await, o teste 4 quebra", () => {
    expect(apres.replace("export function paraWhatsApp", "export async function paraWhatsApp"))
      .toMatch(/\basync\b/);
    expect(apres).not.toMatch(/\basync\b/);
  });
});
