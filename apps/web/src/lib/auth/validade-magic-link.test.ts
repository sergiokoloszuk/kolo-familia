import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { criarLinkAcesso, resolverLinkAcesso } from "./acesso-link";

/**
 * MAGIC LINK = 30 DIAS — decisão de produto de 27/08/2026.
 *
 * ⚠️ POR QUE ESTE TESTE EXISTE. A validade anterior (24h) estava defendida por
 * um comentário longo e convincente sobre segurança. Um número assim não volta
 * atrás por acidente — volta atrás porque alguém lê a defesa antiga, acha
 * correta e "conserta". Estes testes MORDEM essa reversão.
 *
 * ⚠️ E POR QUE O TESTE OLHA O TEXTO DO ARQUIVO. `VALIDADE_HORAS` é privada, de
 * propósito — ninguém deve poder passar validade própria por chamador, senão a
 * fonte única deixa de ser única. Então a constante é verificada por leitura do
 * fonte, e o COMPORTAMENTO é exercitado com um banco falso em memória.
 */

const SRC = readFileSync(join(process.cwd(), "src/lib/auth/acesso-link.ts"), "utf8");
const DIA = 24 * 60 * 60 * 1000;

/**
 * Banco falso em memória. Exercita a função de verdade — inclusive a leitura
 * de `expira_em` — sem tocar em produção.
 */
function bancoFalso(agora: () => number) {
  const linhas: Record<string, unknown>[] = [];
  const cliente = {
    from() {
      return {
        insert(linha: Record<string, unknown>) {
          linhas.push({ ...linha, id: `id-${linhas.length}`, usos: 0 });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq(_c: string, token: string) {
              return {
                maybeSingle() {
                  const l = linhas.find((x) => x.token === token);
                  return Promise.resolve({ data: l ?? null, error: null });
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(_c: string, id: string) {
              const l = linhas.find((x) => x.id === id);
              if (l) Object.assign(l, patch);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { cliente, linhas, agora };
}

describe("a validade é de 30 dias, e tem um dono só", () => {
  it("1. MORDE: a constante é 30 dias, não 24 horas", () => {
    expect(SRC).toMatch(/const VALIDADE_HORAS = 30 \* 24;/);
    expect(SRC).not.toMatch(/const VALIDADE_HORAS = 24;/);
  });

  it("2. MORDE: nenhum chamador pode passar validade própria", () => {
    // Se `criarLinkAcesso` ganhar um parâmetro de validade, a fonte única
    // morre e cada fluxo passa a ter a sua — que é exatamente o que esta
    // decisão de produto quis evitar.
    const i = SRC.indexOf("export async function criarLinkAcesso");
    const assinatura = SRC.slice(i, SRC.indexOf(")", SRC.indexOf("params:", i)));
    expect(assinatura).not.toMatch(/validade|expira|horas|dias/i);
  });

  it("3. MORDE: a constante não é exportada — ninguém a sobrescreve", () => {
    expect(SRC).not.toMatch(/export const VALIDADE_HORAS/);
  });
});

describe("o comportamento do token, exercitado de verdade", () => {
  const AGORA = Date.parse("2026-08-27T12:00:00Z");

  async function novoLink(agora: number) {
    const b = bancoFalso(() => agora);
    const real = Date.now;
    Date.now = () => agora;
    try {
      const url = await criarLinkAcesso(b.cliente as never, {
        familyId: "fam-1",
        next: "/assinatura?de=recuperacao",
      });
      return { url, banco: b };
    } finally {
      Date.now = real;
    }
  }

  it("4. nasce válido e resolve para a família e o destino certos", async () => {
    const { url, banco } = await novoLink(AGORA);
    expect(url).toBeTruthy();
    const token = decodeURIComponent((String(url).match(/[?&]k=([^&]+)/) ?? [])[1]);
    const real = Date.now;
    Date.now = () => AGORA + 60_000;
    try {
      const r = await resolverLinkAcesso(banco.cliente as never, token);
      expect(r?.familyId).toBe("fam-1");
      expect(r?.next).toBe("/assinatura?de=recuperacao");
    } finally {
      Date.now = real;
    }
  });

  it("5. MEDE: expira ~30 dias depois da criação", async () => {
    const { banco } = await novoLink(AGORA);
    const expira = Date.parse(String(banco.linhas[0].expira_em));
    const dias = (expira - AGORA) / DIA;
    expect(dias).toBeCloseTo(30, 5);
  });

  it("6. MORDE: continua válido no dia 29 — o teto antigo de 24h falharia aqui", async () => {
    const { url, banco } = await novoLink(AGORA);
    const token = decodeURIComponent((String(url).match(/[?&]k=([^&]+)/) ?? [])[1]);
    const real = Date.now;
    Date.now = () => AGORA + 29 * DIA;
    try {
      expect(await resolverLinkAcesso(banco.cliente as never, token)).not.toBeNull();
    } finally {
      Date.now = real;
    }
  });

  it("7. é REUTILIZÁVEL dentro do prazo, e conta os usos", async () => {
    // Regra que esta missão NÃO pode alterar: a mãe rola a conversa e toca de
    // novo no mesmo link.
    const { url, banco } = await novoLink(AGORA);
    const token = decodeURIComponent((String(url).match(/[?&]k=([^&]+)/) ?? [])[1]);
    const real = Date.now;
    Date.now = () => AGORA + 10 * DIA;
    try {
      expect(await resolverLinkAcesso(banco.cliente as never, token)).not.toBeNull();
      expect(await resolverLinkAcesso(banco.cliente as never, token)).not.toBeNull();
      expect(await resolverLinkAcesso(banco.cliente as never, token)).not.toBeNull();
      expect(banco.linhas[0].usos).toBe(3);
      expect(banco.linhas[0].usado_em).toBeTruthy();
    } finally {
      Date.now = real;
    }
  });

  it("8. MORDE: deixa de ser aceito depois de 30 dias", async () => {
    const { url, banco } = await novoLink(AGORA);
    const token = decodeURIComponent((String(url).match(/[?&]k=([^&]+)/) ?? [])[1]);
    const real = Date.now;
    Date.now = () => AGORA + 30 * DIA + 60_000;
    try {
      expect(await resolverLinkAcesso(banco.cliente as never, token)).toBeNull();
    } finally {
      Date.now = real;
    }
  });

  it("9. token curto ou vazio nunca resolve — nada disso mudou", async () => {
    const { banco } = await novoLink(AGORA);
    expect(await resolverLinkAcesso(banco.cliente as never, "")).toBeNull();
    expect(await resolverLinkAcesso(banco.cliente as never, "curto")).toBeNull();
    expect(await resolverLinkAcesso(banco.cliente as never, null)).toBeNull();
  });
});
