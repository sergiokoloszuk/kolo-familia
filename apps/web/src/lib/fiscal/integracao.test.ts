import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = resolve(__dirname, "../..");
const ler = (caminho: string) => readFileSync(resolve(RAIZ, caminho), "utf8");

describe("integração fiscal de ponta a ponta", () => {
  it("a tela pede todos os dados antes de chamar o Checkout", () => {
    const form = ler("app/(app)/assinatura/dados-fiscais-form.tsx");
    for (const campo of [
      "nomeFiscal", "cpf", "cep", "logradouro", "numero", "bairro", "cidade", "estado",
    ]) {
      expect(form, `campo obrigatório ausente: ${campo}`).toContain(`nome=\"${campo}\"`);
    }
    expect(form).toContain("iniciarCheckoutComDadosFiscais");
  });

  it("ação e API legada convergem na mesma porta fiscal", () => {
    expect(ler("app/(app)/assinatura/actions.ts")).toContain("criarCheckoutFiscal({");
    expect(ler("app/api/stripe/checkout/route.ts")).toContain("criarCheckoutFiscal({");
  });

  it("a tela do link mostra nome, CPF e endereço completo", () => {
    const pagina = ler("app/fiscal/notas/[token]/page.tsx");
    for (const rotulo of ["Nome completo", "CPF", "Endereço", "Bairro / complemento", "Cidade / UF", "CEP"]) {
      expect(pagina).toContain(`titulo=\"${rotulo}\"`);
    }
  });

  it("o pagamento pago cria alerta e o cron diário entrega o link à Rosangela", () => {
    expect(ler("app/api/stripe/webhook/route.ts")).toContain('.from("fiscal_alertas").upsert(');
    const cron = ler("app/api/ayla/cron/route.ts");
    expect(cron).toContain('tipo === "fiscal"');
    expect(cron).toContain("ROSANGELA_FISCAL_WHATSAPP_E164");
    expect(cron).toContain("enviarLinksFiscais(destinoRosangela, links)");
    expect(ler("../vercel.json")).toContain("/api/ayla/cron?tipo=fiscal");
  });

  it("o health mostra somente se a destinatária foi configurada, nunca o número", () => {
    const health = ler("app/api/health/route.ts");
    expect(health).toContain("fiscal_rosangela_configurada");
    expect(health).toContain("Boolean(process.env.ROSANGELA_FISCAL_WHATSAPP_E164)");
  });
});
