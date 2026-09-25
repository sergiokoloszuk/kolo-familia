import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizarDestino } from "@/lib/auth/destino-link";
import {
  BLOCO_ESCOLHA_OBJETIVO_HISTORIA,
  BLOCO_ENTREGA_HISTORIA_WHATSAPP,
  OBJETIVOS_HISTORIA,
  OBJETIVO_ESCOLHA_AYLA,
  blocoEntregaHistoriaWhatsApp,
  detectarEntregaHistoria,
  guiaHistoriaNoLudico,
  idDoBotaoObjetivoHistoria,
  lerIdDoBotaoObjetivoHistoria,
  objetivoDaHistoriaExplicito,
  objetivoHistoriaDoFallback,
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
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("título curto em negrito");
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("Isso não impede a entrega");
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("Nunca afirme");
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain(
      "NÃO invente carinho, proteção, amor, saudade, boas lembranças",
    );
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain("ESTA REGRA PREVALECE");
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain(
      "não misture nem atribua o mesmo sentimento a todas",
    );
    expect(BLOCO_ENTREGA_HISTORIA_WHATSAPP).toContain(
      "não como orientação clínica disfarçada",
    );
  });

  it("distingue tema de objetivo e não pergunta quando a família já disse o que quer construir", () => {
    expect(objetivoDaHistoriaExplicito("Uma história sobre barulho no mercado")).toBe(false);
    expect(objetivoDaHistoriaExplicito("Sobre o pai e o bisavô que morreram")).toBe(false);
    expect(
      objetivoDaHistoriaExplicito(
        "Quero uma história para ajudar ele a entender que pode pedir uma pausa",
      ),
    ).toBe(true);
    expect(objetivoDaHistoriaExplicito("Quero que ela aprenda a dizer não")).toBe(true);
    expect(objetivoDaHistoriaExplicito("A moral da história é que pedir ajuda é coragem")).toBe(true);
  });

  it("oferece exatamente três objetivos claros e preserva o atalho da Ayla", () => {
    expect(OBJETIVOS_HISTORIA.map((o) => o.label)).toEqual([
      "Entender o que sente",
      "Saber o que fazer",
      "Coragem para escolher",
    ]);
    expect(BLOCO_ESCOLHA_OBJETIVO_HISTORIA).toContain("NÃO escreva a história");
    expect(BLOCO_ESCOLHA_OBJETIVO_HISTORIA).toContain("exatamente três caminhos");
    expect(BLOCO_ESCOLHA_OBJETIVO_HISTORIA).toContain("1️⃣ *Entender o que sente*");
    expect(BLOCO_ESCOLHA_OBJETIVO_HISTORIA).toContain("2️⃣ *Saber o que fazer*");
    expect(BLOCO_ESCOLHA_OBJETIVO_HISTORIA).toContain("3️⃣ *Coragem para escolher*");
    expect(BLOCO_ESCOLHA_OBJETIVO_HISTORIA).toContain("escolhe você");
    expect(BLOCO_ESCOLHA_OBJETIVO_HISTORIA).toContain("não faça outra pergunta");
  });

  it("correlaciona o clique por id opaco e recusa outro menu ou uuid inválido", () => {
    const oferta = "5c3ab75a-a274-4aba-9b9f-2b487826154e";
    const id = idDoBotaoObjetivoHistoria(oferta, "historia_agir");
    expect(lerIdDoBotaoObjetivoHistoria(id)).toEqual({
      ofertaId: oferta,
      objetivo: "historia_agir",
    });
    expect(lerIdDoBotaoObjetivoHistoria(`ak1:${oferta}:historia_agir`)).toBeNull();
    expect(lerIdDoBotaoObjetivoHistoria("ah1:invalido:historia_agir")).toBeNull();
    expect(lerIdDoBotaoObjetivoHistoria(`ah1:${oferta}:historia_escolha_ayla`)).toBeNull();
  });

  it("entende fallback por número, rótulo e “escolhe você”", () => {
    const opcoes = OBJETIVOS_HISTORIA.map((o) => o.chave);
    expect(objetivoHistoriaDoFallback("1", opcoes)).toBe("historia_compreender");
    expect(objetivoHistoriaDoFallback("Saber o que fazer", opcoes)).toBe("historia_agir");
    expect(objetivoHistoriaDoFallback("3", opcoes)).toBe("historia_agencia");
    expect(objetivoHistoriaDoFallback("escolhe você", opcoes)).toBe(OBJETIVO_ESCOLHA_AYLA);
    expect(objetivoHistoriaDoFallback("uma mensagem comum", opcoes)).toBeNull();
  });

  it("transforma a escolha em eixo e proíbe nova investigação depois do clique", () => {
    const bloco = blocoEntregaHistoriaWhatsApp("historia_agir");
    expect(bloco).toContain("ENTREGUE A HISTÓRIA AGORA");
    expect(bloco).toContain("um próximo passo concreto");
    expect(bloco).toContain("Não faça nenhuma pergunta");
    expect(blocoEntregaHistoriaWhatsApp(OBJETIVO_ESCOLHA_AYLA)).toContain(
      "Selecione o objetivo que mais ajuda esta criança agora",
    );
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
  const MIGRATION = readFileSync(
    resolve(__dirname, "../../../../../supabase/migrations/0093_historia_objetivo_whatsapp.sql"),
    "utf8",
  );

  it("mantém Perfil/BPs no gerador e injeta somente a obrigação de entrega", () => {
    expect(OFICIAL).toMatch(/repertorio,\s*[\s\S]*blocoEntregaHistoriaWhatsApp/);
    expect(OFICIAL).toMatch(/entregarHistoriaNoWhatsapp/);
    expect(ORCH).toMatch(/skills: oferta\.skills \?\? \[\][\s\S]*skillsAvaliadas:/);
    expect(ORCH).toContain("membroPreferidoId: oferta.membro_atipico_id");
    expect(OFICIAL).toMatch(/lista\.find\(\(m\) => m\.id === membroPreferidoId\)/);
    expect(ORCH).toMatch(/bp_recuperadas: exp\.metrica\.bpRecuperadas/);
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

  it("só abre a escolha com flag, tema sem objetivo e estado persistível", () => {
    expect(ORCH).toMatch(
      /entregaHistoria &&\s*aprofundamentoGlobalLigado\(\) &&\s*inboundMessageRowId &&\s*!objetivoDaHistoriaExplicito/,
    );
    expect(ORCH).toContain("prepararObjetivosHistoria: deveEscolherObjetivoHistoria");
    expect(ORCH).toMatch(
      /entregarHistoriaNoWhatsapp: Boolean\(\s*entregaHistoria && !deveEscolherObjetivoHistoria/,
    );
  });

  it("processa a escolha antes de outro menu e consome clique duplicado", () => {
    const historia = ORCH.indexOf("await processarEscolhaObjetivoHistoria(supabase");
    const aprofundamento = ORCH.indexOf("await processarEscolhaAprofundamento(supabase");
    expect(historia).toBeGreaterThan(0);
    expect(historia).toBeLessThan(aprofundamento);
    expect(ORCH).toContain('kind: "historia_objetivo_escolha_ignorada"');
    expect(MIGRATION).toContain("with interacao_consumida as");
    expect(MIGRATION).toContain("o.provider_message_id = p_reference_message_id");
    expect(MIGRATION).toContain("o.status in ('preparada', 'oferecida')");
    expect(MIGRATION).toContain("p_objetivo = 'historia_escolha_ayla'");
    expect(ORCH).toContain("escolheAyla");
  });

  it("tem fallback textual e não deixa botão órfão quando a reserva falha", () => {
    expect(ORCH).toContain("Se os botões não aparecerem");
    expect(ORCH).toContain('tipo: "historia_objetivo_fallback"');
    expect(ORCH).toContain('logServerError("historia_objetivo_preparacao_falhou"');
    expect(ORCH).toContain("objetivoHistoria:");
    expect(ORCH).toContain("OBJETIVO_ESCOLHA_AYLA");
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
