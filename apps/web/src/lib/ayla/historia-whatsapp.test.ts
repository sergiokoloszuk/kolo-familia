import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizarDestino } from "@/lib/auth/destino-link";
import {
  BLOCO_ENTREGA_HISTORIA_WHATSAPP,
  detectarEntregaHistoria,
  guiaHistoriaNoLudico,
} from "./historia-whatsapp";

describe("continuidade da história no WhatsApp", () => {
  it("entrega a história no caso real em vez de reabrir a investigação", () => {
    const decisao = detectarEntregaHistoria({
      mensagem:
        "Em ver pessoas que já morreram e conversa com elas, o pai e o bisavô dele",
      aceite: null,
      historicoMaisRecentePrimeiro: [
        { direcao: "inbound", texto: "Em ver pessoas que já morreram" },
        {
          direcao: "outbound",
          texto:
            "Qual situação você quer transformar em história para o Darlison? Pode ser sair da tela, lidar com barulho, ver uma briga em casa ou sentir saudade de alguém.",
        },
      ],
    });

    expect(decisao).toEqual({ origem: "resposta_ao_tema" });
  });

  it("atravessa vários balões da família até a fala anterior da Ayla", () => {
    expect(
      detectarEntregaHistoria({
        mensagem: "Ele pode ser um super-herói veloz",
        historicoMaisRecentePrimeiro: [
          { direcao: "inbound", texto: "Ele pode ser um super-herói" },
          { direcao: "inbound", texto: "tipo o Sonic" },
          {
            direcao: "outbound",
            texto: "Me conta o tema para eu montar a história dele.",
          },
        ],
      }),
    ).toEqual({ origem: "resposta_ao_tema" });
  });

  it("reconhece pedido direto e aceite já resolvido pelo decisor", () => {
    expect(
      detectarEntregaHistoria({ mensagem: "Pode criar uma história para a Manu?" }),
    ).toEqual({ origem: "pedido_explicito" });
    expect(
      detectarEntregaHistoria({ mensagem: "Quero histórias para ajudar o Bento" }),
    ).toEqual({ origem: "pedido_explicito" });
    expect(
      detectarEntregaHistoria({
        mensagem: "Sim",
        aceite: "montar uma história curta para o Gustavo",
      }),
    ).toEqual({ origem: "aceite_classificado" });
  });

  it("não transforma menção casual em pedido", () => {
    expect(
      detectarEntregaHistoria({ mensagem: "Ele me contou uma história ontem" }),
    ).toBeNull();
    expect(
      detectarEntregaHistoria({ mensagem: "Quero te contar uma história de ontem" }),
    ).toBeNull();
    expect(
      detectarEntregaHistoria({
        mensagem: "Não sei",
        historicoMaisRecentePrimeiro: [
          { direcao: "inbound", texto: "Não sei" },
          {
            direcao: "outbound",
            texto: "Qual situação você quer transformar em história?",
          },
        ],
      }),
    ).toBeNull();
    expect(
      detectarEntregaHistoria({
        mensagem: "Azul",
        historicoMaisRecentePrimeiro: [
          { direcao: "inbound", texto: "Azul" },
          { direcao: "outbound", texto: "Qual é a cor preferida dele?" },
        ],
      }),
    ).toBeNull();
  });

  it("manda entregar agora e protege o tema de luto sem apagar a história", () => {
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("ENTREGUE A HISTÓRIA AGORA");
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("Não volte a investigar");
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("Não faça nenhuma pergunta");
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("Isso não impede a entrega");
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("Nunca afirme");
  });
});

describe("guia fiel do Lúdico", () => {
  it("abre a criação e usa os rótulos reais da plataforma", () => {
    const guia = guiaHistoriaNoLudico({
      link: "https://kolo.test/auth/wa?next=%2Fhistorias%2Fcriar",
      nomeCrianca: "Darlison",
    });

    expect(guia).toContain("Criar uma história");
    expect(guia).toContain("Falta o avatar");
    expect(guia).toContain("Criar avatar de outra pessoa");
    expect(guia).toContain("Criar avatar de Darlison");
    expect(guia).toContain("O que você quer contar?");
    expect(guia).toContain("3 a 6 páginas");
    expect(guia).toContain("Criar história");
    expect(guia).toContain("https://kolo.test/auth/wa");
  });
});

describe("integração no caminho oficial", () => {
  const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
  const OFICIAL = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
  const AJUDA = readFileSync(
    resolve(__dirname, "../../app/(app)/ajuda/actions.ts"),
    "utf8",
  );
  const CRIAR_HISTORIA = readFileSync(
    resolve(__dirname, "../../app/(app)/historias/criar/page.tsx"),
    "utf8",
  );

  it("mantém Perfil/BPs no gerador e injeta somente a obrigação de entrega", () => {
    expect(OFICIAL).toMatch(/repertorio,\s*[\s\S]*BLOCO_ENTREGA_HISTORIA_WHATSAPP/);
    expect(OFICIAL).toMatch(/entregarHistoriaNoWhatsapp/);
  });

  it("envia história e guia separadamente sem perfil, plano ou botões concorrentes", () => {
    expect(ORCH).toContain("`/historias/criar?membro=${encodeURIComponent(membroHistoriaId)}`");
    expect(ORCH).toContain('motivo: "historia_em_entrega"');
    expect(ORCH).toContain("guiaHistoriaNoLudico({ link: linkHistoria, nomeCrianca })");
    expect(ORCH).toContain("if (resp.enviada && !entregaHistoria)");
  });

  it("não atropela segurança atual", () => {
    expect(ORCH).toMatch(
      /!seguranca\.aberta && !mensagemPedeSeguranca\(inbound\.texto\)/,
    );
  });

  it("ensina o caminho real também na Ajuda do produto", () => {
    expect(AJUDA).toContain('{ rota: "/historias/criar", label: "Criar uma história" }');
    expect(AJUDA).toContain('"O que você quer contar?"');
    expect(AJUDA).toContain('toque em "Criar história"');
  });

  it("o link preserva a criança do turno e a página valida que ela é da família", () => {
    expect(CRIAR_HISTORIA).toContain("searchParams: Promise<{ membro?: string }>");
    expect(CRIAR_HISTORIA).toContain("comAvatar.some((m) => m.id === membroPedido)");
    expect(CRIAR_HISTORIA).toContain(
      "pedidoValido || (await resolverCriancaAtivaId(comAvatar))",
    );
    const destino = "/historias/criar?membro=baa1ac66-4d35-46d6-8ea5-586609d43a7b";
    expect(normalizarDestino(destino)).toBe(destino);
  });
});
