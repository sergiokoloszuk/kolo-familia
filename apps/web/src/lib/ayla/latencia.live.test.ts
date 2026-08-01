import { describe, it, expect } from "vitest";
import { gerarRespostaAyla } from "./responder";
import { ESPERAS_MS } from "./espera";

/**
 * A ESPERA NO WHATSAPP, medida.
 *
 * Desde 01/08/2026 a primeira bolha só sai depois da geração INTEIRA — é esse
 * instante que permite inspecionar a resposta antes de publicá-la. O custo é
 * real e precisa ser medido, não estimado: quanto tempo a mãe fica em silêncio,
 * e qual o maior vão entre dois sinais — que é o que a família sente como
 * silêncio. Os tempos dos balões vêm de .
 *
 * PULADO POR PADRÃO: chama a API de verdade.
 *   AYLA_LIVE=1 npx vitest run src/lib/ayla/latencia.live.test.ts
 */
const ligado = process.env.AYLA_LIVE === "1" && Boolean(process.env.ANTHROPIC_API_KEY);

async function medir(mensagem: string) {
  const t0 = Date.now();
  const texto = await gerarRespostaAyla({
    nomeMae: "Paloma",
    nomeMembro: "Thayla",
    idadeMembro: 5,
    perfilMembro: "EmInvestigacao",
    generoMembro: "feminino",
    koloVivoResumo: [
      "comunicação: fala pouco, repete falas de desenho",
      "sensorial: cobre os ouvidos com barulho",
      "rotina: chora muito quando muda a ordem das coisas",
    ].join("\n"),
    historico: [],
    mensagem,
    sinais: { conquista: null, desafio: null, emocao_mae: null, temSugestaoKoloVivo: false },
  });
  const ms = Date.now() - t0;
  const bolhas = texto
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
  return { ms, bolhas, chars: texto.length };
}

/** O ritmo entre bolhas é o mesmo de sempre — só mudou quando ele começa. */
function segundosDeBolhas(bolhas: string[]): number {
  return bolhas.reduce(
    (t, b, i) => t + (i === 0 ? 2 : Math.min(Math.max(Math.round(b.length / 25), 2), 6)),
    0,
  );
}

const CASOS: ReadonlyArray<readonly [string, string]> = [
  ["curta", "bom dia!"],
  ["comum", "ela não quer tomar banho de jeito nenhum, vira uma luta todo dia"],
  ["regenera?", "pelo que eu te contei, o que você acha que ela tem? é autismo ou outra coisa?"],
];

describe.skipIf(!ligado)("latência da espera no WhatsApp (chama a API)", () => {
  for (const [rotulo, mensagem] of CASOS) {
    it(rotulo, { timeout: 180_000 }, async () => {
      const r = await medir(mensagem);
      const baloes = ESPERAS_MS.filter((t) => t < r.ms);
      const marcos = [0, ...baloes, r.ms];
      const vaoMax = Math.max(...marcos.slice(1).map((m, i) => m - marcos[i]));
      console.log(
        `  [${rotulo.padEnd(9)}] geração ${String(r.ms).padStart(6)}ms` +
          ` · balões ${baloes.length} (${baloes.join("/") || "nenhum"})` +
          ` · vão máx ${vaoMax}ms` +
          ` · 1ª bolha ~${r.ms + 2000}ms` +
          ` · ${r.bolhas.length} bolhas (+${segundosDeBolhas(r.bolhas)}s de ritmo)` +
          ` · ${r.chars} chars`,
      );
      expect(r.chars).toBeGreaterThan(0);
    });
  }
});
