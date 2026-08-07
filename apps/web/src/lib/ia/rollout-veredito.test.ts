import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Módulo de bancada: `.mjs` pra rodar no node, com tipos em `.d.mts` pra o
// typecheck valer aqui — ver o cabeçalho daquele arquivo.
import {
  ehConversacional,
  agruparPorFamilia,
  veredito,
  semAllowlist,
} from "../../../../../scripts/bancada/migracao/rollout-veredito.mjs";

/**
 * O VERIFICADOR DE ROLLOUT não pode gritar vazamento por causa de áudio.
 *
 * Em 07/08/2026 eu contei `provider === "openai"` sem olhar a `feature` e
 * anunciei vazamento do GPT. Eram linhas `ayla_audio` no `whisper-1`:
 * transcrição, que sempre foi OpenAI. O alarme falso quase custou um rollback
 * de produção que não era necessário.
 *
 * Vazamento é sobre a CONVERSA. Estes testes fixam essa fronteira.
 */

const AUT = "aaaaaaaa-0000-0000-0000-000000000001";
const AUT2 = "aaaaaaaa-0000-0000-0000-000000000002";
const FORA = "bbbbbbbb-0000-0000-0000-000000000001";
const autorizadas = new Set([AUT, AUT2]);

const chamada = (family_account_id: string, provider: string, feature: string, model = "m") => ({
  family_account_id,
  provider,
  feature,
  model,
  custo_usd: 0.01,
});

describe("o que conta como camada conversacional", () => {
  it("WhatsApp e web contam", () => {
    expect(ehConversacional("ayla_responder")).toBe(true);
    expect(ehConversacional("conversa_web")).toBe(true);
  });

  it("áudio, visão e o resto NÃO contam", () => {
    for (const f of ["ayla_audio", "ayla_visao", "plano_pdf", "onboarding", undefined])
      expect(ehConversacional(f)).toBe(false);
  });
});

describe("os seis casos do verificador", () => {
  it("1. autorizada no GPT conversando = correto, sem vazamento", () => {
    const g = agruparPorFamilia([chamada(AUT, "openai", "ayla_responder")]);
    const v = veredito(g, autorizadas);
    expect(v.vazamentos).toHaveLength(0);
    expect(v.naoChegou).toHaveLength(0);
  });

  it("2. NÃO-autorizada no GPT conversando = VAZAMENTO", () => {
    const g = agruparPorFamilia([chamada(FORA, "openai", "conversa_web")]);
    expect(veredito(g, autorizadas).vazamentos.map(([id]) => id)).toEqual([FORA]);
  });

  it("3. NÃO-autorizada usando whisper NÃO é vazamento", () => {
    // O caso que gerou o alarme falso: áudio sempre foi OpenAI, pra todo mundo.
    const g = agruparPorFamilia([
      chamada(FORA, "openai", "ayla_audio", "whisper-1"),
      chamada(FORA, "anthropic", "ayla_responder"),
    ]);
    const v = veredito(g, autorizadas);
    expect(v.vazamentos).toHaveLength(0);
    expect(g.get(FORA)?.openai ?? 0).toBe(0); // o whisper nem entra na contagem
  });

  it("4. autorizada recebendo Claude = NÃO CHEGOU (config que não valeu)", () => {
    const g = agruparPorFamilia([chamada(AUT, "anthropic", "ayla_responder")]);
    const v = veredito(g, autorizadas);
    expect(v.naoChegou.map(([id]) => id)).toEqual([AUT]);
    expect(v.vazamentos).toHaveLength(0);
  });

  it("5. autorizada que não conversou = silêncio, não erro", () => {
    const v = veredito(agruparPorFamilia([]), autorizadas);
    expect(v.vazamentos).toHaveLength(0);
    expect(v.naoChegou).toHaveLength(0);
    expect(v.semDado.sort()).toEqual([AUT, AUT2]);
  });

  it("6. só áudio na janela inteira = veredito limpo e nada provado", () => {
    const g = agruparPorFamilia([
      chamada(AUT, "openai", "ayla_audio", "whisper-1"),
      chamada(FORA, "openai", "ayla_audio", "whisper-1"),
    ]);
    const v = veredito(g, autorizadas);
    expect(v.vazamentos).toHaveLength(0);
    expect(v.semDado).toHaveLength(2); // ninguém conversou de fato
  });
});

describe("sem allowlist não existe veredito", () => {
  it("lista vazia é reconhecida como 'não sei', não como 'ninguém autorizado'", () => {
    expect(semAllowlist(new Set())).toBe(true);
    expect(semAllowlist(autorizadas)).toBe(false);
  });

  it("o veredito RECUSA responder em vez de acusar a família toda", () => {
    // O segundo alarme falso: rodado da máquina local, onde
    // OPENAI_TEST_FAMILY_IDS não existe, toda família no GPT virava intrusa e
    // o relatório mandava dar rollback. A família era autorizada.
    const g = agruparPorFamilia([chamada(AUT, "openai", "ayla_responder")]);
    expect(() => veredito(g, new Set())).toThrow(/allowlist vazia/);
  });
});

describe("o script declara NÃO VERIFICÁVEL antes de tentar o veredito", () => {
  // Este teste existe porque o guard JÁ se perdeu uma vez: o import de
  // `semAllowlist` entrou no commit e o bloco que o usa não. O script ficou
  // importando uma função que nunca chamava — e, em vez da mensagem, estourava
  // exceção. Fonte-texto é feio, mas pega exatamente esse tipo de perda.
  const SCRIPT = readFileSync(
    resolve(__dirname, "../../../../../scripts/bancada/migracao/verificar-rollout.mjs"),
    "utf8",
  );

  it("chama o guard, e não só importa", () => {
    expect(SCRIPT).toMatch(/if \(semAllowlist\(autorizadas\)\)/);
  });

  it("o guard vem ANTES de qualquer veredito", () => {
    expect(SCRIPT.indexOf("if (semAllowlist(autorizadas))")).toBeLessThan(
      SCRIPT.indexOf("veredito(porFamilia"),
    );
  });

  it("sai com código próprio — configuração faltando não é veredito negativo", () => {
    expect(SCRIPT).toMatch(/NÃO VERIFICÁVEL/);
    expect(SCRIPT).toMatch(/process\.exitCode = 2/);
  });

  it("a mensagem diz, com todas as letras, que ausência de lista não é vazamento", () => {
    expect(SCRIPT).toMatch(/ausência de lista NÃO é vazamento/);
  });
});

describe("a contagem por família", () => {
  it("separa canal e provider, e ignora o que não é conversa", () => {
    const g = agruparPorFamilia([
      chamada(AUT, "openai", "ayla_responder"),
      chamada(AUT, "openai", "conversa_web"),
      chamada(AUT, "openai", "ayla_audio", "whisper-1"),
    ]);
    const f = g.get(AUT);
    if (!f) throw new Error("a família autorizada tinha que estar no mapa");
    expect(f.openai).toBe(2);
    expect([...f.canais].sort()).toEqual(["web", "whatsapp"]);
    expect([...f.modelos]).not.toContain("whisper-1");
  });

  it("família que só usou áudio não aparece no mapa", () => {
    expect(agruparPorFamilia([chamada(FORA, "openai", "ayla_audio")]).size).toBe(0);
  });
});
