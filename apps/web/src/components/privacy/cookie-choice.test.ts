import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raiz = resolve(process.cwd(), "src");
const componente = readFileSync(resolve(raiz, "components/privacy/cookie-choice.tsx"), "utf8");
const auth = readFileSync(resolve(raiz, "app/(auth)/layout.tsx"), "utf8");

describe("cookies opcionais", () => {
  it("não carrega o GTM diretamente no layout", () => {
    expect(auth).not.toMatch(/googletagmanager|gtm\.js|<Script/);
    expect(auth).toMatch(/<CookieChoice carregarAnalise/);
  });

  it("só carrega análise depois da escolha positiva", () => {
    expect(componente).toMatch(/carregarAnalise && escolha === "aceitos"/);
    expect(componente).toMatch(/gtm-base-consentido/);
    expect(componente).toMatch(/<UtmCapture/);
  });

  it("mostra aceitar e recusar com o mesmo peso visual", () => {
    expect(componente).toMatch(/Recusar opcionais/);
    expect(componente).toMatch(/Aceitar opcionais/);
    expect((componente.match(/rounded-full border border-brand-purple/g) ?? [])).toHaveLength(2);
  });
});
