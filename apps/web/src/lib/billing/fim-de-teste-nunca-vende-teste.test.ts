import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { linkAssinatura, destinoAssinatura, linkPlanos } from "./destino-comercial";
import { destinoPermitido, normalizarDestino } from "@/lib/auth/destino-link";
import { ctaDoEstado, type EstadoComercial } from "@/app/(public)/precos/cta-por-estado";

/**
 * A GARANTIA DE 27/08/2026 — QUEM ESTÁ NO TESTE NUNCA RECEBE CONVITE PARA
 * COMEÇAR UM TESTE.
 *
 * ⚠️ O DEFEITO, VISTO EM PRODUÇÃO. O convite de fim de teste levava para
 * `/precos`. É a rota comercial certa **para quem chega de fora** — mas ela é
 * pública, o convite vai por WhatsApp e abre no navegador do celular quase
 * sempre SEM SESSÃO. E ali a página inteira vende o teste:
 *
 *   · manchete: "7 dias grátis pra sentir se vale"
 *   · sub:      "Sem cartão pra começar. Depois você decide."
 *   · botão:    "Começar 7 dias grátis" → /signup
 *
 * No ÚLTIMO DIA do teste, a família recebia um convite para COMEÇAR o teste que
 * estava terminando. O último passo do funil oferecendo o primeiro.
 *
 * Estes testes existem porque a correção tem três partes que podem regredir
 * INDEPENDENTEMENTE — e uma sozinha não basta:
 *   1. o link do D7/D3 tem de terminar em `/assinatura`, nunca em `/precos`;
 *   2. `/assinatura` é rota autenticada, então o link precisa levar sessão;
 *   3. a página `/precos`, quando alcançada por quem já tem conta, não pode
 *      manter a manchete de aquisição.
 */

const SRC_TEMPLATES = readFileSync(
  join(process.cwd(), "src/lib/ayla/messageTemplates.ts"),
  "utf8",
);

/**
 * O corpo de `linkComercialAutenticado` — a função que decide o destino.
 *
 * ⚠️ ELA MUDOU DE ARQUIVO EM 27/08. Nasceu como `linkDeFimDeTeste`, privada em
 * `messageTemplates.ts`, servindo só ao D7. Quando a conversa reativa mandou
 * `/precos` para quem escreveu "quero pagar", ficou claro que a decisão tinha
 * DUAS cópias — o proativo corrigido e o reativo não. Agora há um dono só, em
 * `lib/billing/link-comercial.ts`, e os dois lados o chamam. A garantia é a
 * mesma; o endereço é outro.
 */
function corpoDoLinkDeFimDeTeste(): string {
  const src = readFileSync(join(process.cwd(), "src/lib/billing/link-comercial.ts"), "utf8");
  const i = src.indexOf("export async function linkComercialAutenticado");
  expect(i, "`linkComercialAutenticado` sumiu — a garantia mora nela").toBeGreaterThan(-1);
  const resto = src.slice(i);
  const fim = resto.indexOf("\n}");
  // ⚠️ SEM COMENTÁRIOS. O corpo da função EXPLICA por que não há degrau para
  // `/precos` — e a explicação contém a própria string. Sem esta limpeza, o
  // teste falha por causa do comentário que o defende, e alguém "conserta"
  // afrouxando a asserção em vez de olhar o código.
  return resto.slice(0, fim).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("1. o destino do fim de teste é /assinatura, nunca /precos", () => {
  it("MORDE: nenhum degrau de fallback aponta para /precos ou /signup", () => {
    // Um fallback "seguro" para a página pública seria o defeito voltando pela
    // porta dos fundos — e justamente quando algo já falhou.
    const corpo = corpoDoLinkDeFimDeTeste();
    expect(corpo).not.toMatch(/\/precos/);
    expect(corpo).not.toMatch(/\/signup/);
    expect(corpo).not.toMatch(/linkPlanos/);
  });

  it("MORDE: os dois degraus com link terminam em /assinatura", () => {
    const corpo = corpoDoLinkDeFimDeTeste();
    expect(corpo).toMatch(/criarLinkAcesso/); // degrau 1: chega logada
    expect(corpo).toMatch(/destinoAssinatura/); // …e o `next` é a assinatura
    expect(corpo).toMatch(/linkAssinatura/); // degrau 2: sem token, mesmo destino
  });

  it("o template do trial pede o link à função, não monta URL na mão", () => {
    // ⚠️ A JANELA ANCORA NO FIM DA FUNÇÃO — 28/08/2026. Eram 900 bytes fixos, e
    // a documentação do parâmetro `jaExpirou` (o prazo defasado do caso Nicole)
    // empurrou a linha do `link_planos` para fora. O que este teste guarda é que
    // o link vem da função canônica e que nenhuma URL é escrita à mão; nada
    // disso tem a ver com o tamanho do corpo.
    const i = SRC_TEMPLATES.indexOf("export async function templateTrial");
    expect(i, "`templateTrial` sumiu").toBeGreaterThan(-1);
    const fim = SRC_TEMPLATES.indexOf("\n// ====", i);
    const corpo = SRC_TEMPLATES.slice(i, fim > i ? fim : i + 2500);
    expect(corpo).toMatch(/link_planos:\s*await linkComercialAutenticado/);
    expect(corpo).not.toMatch(/https?:\/\//);
  });
});

describe("2. o link leva sessão, porque /assinatura exige login", () => {
  it("`/assinatura` está na allowlist de destinos do link de acesso", () => {
    expect(destinoPermitido("/assinatura")).toBe(true);
  });

  it("MORDE: a query `?de=` sobrevive à normalização do destino", () => {
    // A allowlist compara SEM a query. Se um dia passar a comparar COM, o
    // `?de=d7` seria descartado e o funil comercial perderia a origem em
    // silêncio — sem nenhum erro, só um número que para de crescer.
    for (const de of ["d7", "d3", "pos_trial"] as const) {
      const destino = destinoAssinatura(de);
      expect(destino).toBe(`/assinatura?de=${de}`);
      expect(destinoPermitido(destino)).toBe(true);
      expect(normalizarDestino(destino)).toBe(destino);
    }
  });

  it("MORDE: `/precos` continua permitido — a correção não estreitou a allowlist", () => {
    // `/precos` segue sendo destino legítimo para quem chega de fora. O que
    // mudou é quem recebe qual link, não quais rotas existem.
    expect(destinoPermitido("/precos")).toBe(true);
  });
});

describe("3. as duas rotas comerciais continuam com donos distintos", () => {
  it("`linkPlanos` é aquisição e `linkAssinatura` é pagamento", () => {
    const planos = linkPlanos("d7");
    const assinatura = linkAssinatura("d7");
    // Sem NEXT_PUBLIC_APP_URL os dois são null, e isso é comportamento válido:
    // o template degrada sem link em vez de mandar URL quebrada.
    if (planos === null || assinatura === null) {
      expect(planos).toBeNull();
      expect(assinatura).toBeNull();
      return;
    }
    expect(planos).toMatch(/\/precos\?de=d7$/);
    expect(assinatura).toMatch(/\/assinatura\?de=d7$/);
  });
});

describe("4. /precos não vende o teste a quem já tem conta", () => {
  const COM_CONTA: EstadoComercial[] = ["em_trial", "trial_vencido", "assinante"];

  it("MORDE: nem manchete, nem sub, nem botão falam em começar teste", () => {
    // Esta é a metade que faltou na primeira correção: o botão e a nota
    // viraram conscientes de estado, e o `<h1>` ficou fixo em "7 dias grátis".
    for (const estado of COM_CONTA) {
      const cta = ctaDoEstado(estado);
      const tudo = [cta.rotulo, cta.hero.titulo, cta.hero.destaque, cta.hero.sub].join(" ");
      expect(tudo, `estado ${estado}`).not.toMatch(/7 dias/i);
      expect(tudo, `estado ${estado}`).not.toMatch(/gr[áa]tis/i);
      expect(tudo, `estado ${estado}`).not.toMatch(/come[çc]ar/i);
      expect(tudo, `estado ${estado}`).not.toMatch(/sem cart[ãa]o/i);
    }
  });

  it("MORDE: quem tem conta vai para /assinatura, nunca para /signup", () => {
    for (const estado of COM_CONTA) {
      expect(ctaDoEstado(estado).destino, `estado ${estado}`).toBe("/assinatura");
    }
  });

  it("MORDE: quem já assina não recebe convite para comprar de novo", () => {
    const cta = ctaDoEstado("assinante");
    expect(cta.rotulo).not.toMatch(/assinar|assine|contratar/i);
  });

  it("o visitante continua vendo a página pública, byte a byte", () => {
    // ⚠️ O caso legítimo que não pode ser bloqueado (§12, caso I). Quase todo o
    // tráfego de `/precos` é de quem ainda não é cliente, e para essa pessoa a
    // oferta do teste está CERTA. Suprimir demais aqui custaria aquisição.
    const cta = ctaDoEstado("visitante");
    expect(cta.rotulo).toBe("Começar 7 dias grátis");
    expect(cta.destino).toBe("/signup");
    expect(cta.nota).toBeNull();
    expect(cta.hero.titulo).toBe("7 dias grátis");
    expect(cta.hero.destaque).toBe("pra sentir se vale");
    expect(cta.hero.sub).toBe("Sem cartão pra começar. Depois você decide.");
  });

  it("MORDE: estado desconhecido cai em visitante, não em tela vazia", () => {
    const cta = ctaDoEstado("qualquer_coisa" as EstadoComercial);
    expect(cta.estado).toBe("visitante");
    expect(cta.hero.titulo).toBe("7 dias grátis");
  });
});
