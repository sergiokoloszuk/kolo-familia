import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BLOCO_PEDIDO_BRINCADEIRA,
  contratoPedidoBrincadeira,
  auditarBrincadeiras,
  blocoLimitesSensoriaisBrincadeira,
  blocoMecanicasBrincadeira,
  detectarSensibilidadesRegistradas,
  exigeCorrecaoDeBrincadeira,
  instrucaoCorrecaoBrincadeira,
  pedidoExplicitoDeBrincadeira,
  pisoBrincadeiraSegura,
} from "./pedido-brincadeira";

describe("pedido explícito de brincadeira", () => {
  it("reconhece perguntas naturais somente quando o piloto pede essa ampliação", () => {
    for (const texto of ["teria alguma brincadeira para melhorar atenção?", "Ela adora massinha. Tem brincadeiras para atenção?", "Há jogos para fazermos juntas?"]) {
      expect(pedidoExplicitoDeBrincadeira(texto, true), texto).toBe(true);
      expect(pedidoExplicitoDeBrincadeira(texto), texto).toBe(false);
    }
    for (const texto of ["Ela tem brincadeiras favoritas.", "Ontem ela brincou de massinha.", "A escola tem jogos na sala."]) {
      expect(pedidoExplicitoDeBrincadeira(texto, true), texto).toBe(false);
    }
  });
  it("Foco tem três alternativas por padrão sem manter uma ordem concorrente de uma só", () => {
    const bloco = contratoPedidoBrincadeira(true);
    expect(bloco).toContain("ofereça TRÊS opções completas");
    expect(bloco).toContain("pedir explicitamente apenas uma ou outra quantidade");
    expect(bloco).toContain("Interesses são portas de entrada, não limites");
    expect(bloco).toContain("Em cada opção, apresente");
    expect(bloco).not.toContain("exatamente UMA mecânica");
    expect(bloco).not.toContain("sem oferecer alternativas");
    expect(contratoPedidoBrincadeira()).toBe(BLOCO_PEDIDO_BRINCADEIRA);
  });
  it("reconhece a fala interna da Manu e sinônimos de pedido", () => {
    expect(pedidoExplicitoDeBrincadeira("Quero uma ideia de brincadeira para ajudar a Manu com o mercado.")).toBe(true);
    expect(pedidoExplicitoDeBrincadeira("Pode me sugerir um jogo para fazermos juntos?")).toBe(true);
    expect(pedidoExplicitoDeBrincadeira("Me dê uma atividade lúdica para hoje.")).toBe(true);
    expect(pedidoExplicitoDeBrincadeira("Inventa uma brincadeira rápida antes do banho.")).toBe(true);
    expect(pedidoExplicitoDeBrincadeira("Ensina uma brincadeira que eu consiga começar?")).toBe(true);
  });
  it("não captura relato de brincar, manejo ou pedido de história", () => {
    expect(pedidoExplicitoDeBrincadeira("Ela brincou no mercado ontem.")).toBe(false);
    expect(pedidoExplicitoDeBrincadeira("Como lidar com o barulho no mercado?")).toBe(false);
    expect(pedidoExplicitoDeBrincadeira("Quero uma história sobre um passeio.")).toBe(false);
  });
  it("instrui uma experiência lúdica, sem treino sensorial automático", () => {
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("divertido mesmo sem meta");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("exatamente UMA mecânica");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toMatch(/não opções para\s+mostrar/);
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("“fala exata do adulto”");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Próxima rodada: com variação concreta");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Tempo:");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Material:");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Como começar:");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Para terminar:");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("uma linha por item");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Nunca chame uma pessoa adulta de criança");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toContain("Não reproduza sensibilidade registrada");
    expect(BLOCO_PEDIDO_BRINCADEIRA).toMatch(/O objetivo técnico fica por\s+trás/);
    expect(BLOCO_PEDIDO_BRINCADEIRA).not.toContain("TRÊS opções de jogo");
  });
  it("seleciona mecânicas distintas no mercado sem trocar Perfil e BPs por roteiro fixo", () => {
    const bloco = blocoMecanicasBrincadeira("Quero brincar com ela no mercado");
    expect(bloco).toContain("durante a ida ao mercado");
    expect(bloco).toContain("Mímica com personagem");
    expect(bloco).toContain("apelido absurdo e seguro");
    expect(bloco).toContain("Nunca finja que algo não comestível é comida");
    expect(bloco).toContain("História de superpoder impossível");
    expect(bloco).toContain("As BPs e o Perfil têm precedência");
    expect(bloco).not.toContain("exposição a sons altos");
  });
  it("não força cenário de mercado em outros pedidos", () => {
    expect(blocoMecanicasBrincadeira("Quero uma brincadeira em casa")).toContain("Transformação ou construção conjunta");
  });
  it("não infantiliza uma pessoa adulta no repertório ativo", () => {
    const bloco = blocoMecanicasBrincadeira("Quero uma atividade com Isabela, de 18 anos");
    expect(bloco).not.toMatch(/\bcriança\b/i);
    expect(BLOCO_PEDIDO_BRINCADEIRA).not.toMatch(/\b(?:a|da|desta) criança\b/i);
  });
  it("detecta virada genérica sem inspecionar conteúdo pessoal", () => {
    const texto = `**Poder impossível**
Tempo: 3 minutos
Material: nenhum
Como começar: “Qual poder?”
1️⃣ Mostre voar ou ficar invisível com dois gestos.
2️⃣ Ela: aponta.
3️⃣ Então: conte uma consequência engraçada.
Próxima rodada: ela escolhe outro poder.
Para terminar: diga que o poder vai descansar.`;
    expect(auditarBrincadeiras(texto)).toEqual({ quantidade: 1, falhas: [{ opcao: 1, codigo: "virada_generica" }] });
  });
  it("aceita uma opção com turnos e consequência específica", () => {
    const texto = `🦖 **Dinossauro de mãos**
Tempo: 3 minutos
Material: nenhum
Como começar: “Ele sobe ou se esconde?”
1️⃣ Mostre subir com uma mão e esconder com a outra.
2️⃣ Ela: aponta.
3️⃣ Então: esconda-o atrás da mão e faça uma careta.
Próxima rodada: ela comanda uma nova escolha.
Para terminar: diga que o dinossauro entrou na toca.`;
    expect(auditarBrincadeiras(texto)).toEqual({ quantidade: 1, falhas: [] });
  });
  it("aceita negrito nos metadados, respiro e passos comuns sem inventar outros jogos", () => {
    const texto = `**Filme impossível** 🎬

**Tempo:** 3 minutos
**Material:** nenhum

**Como começar:** “E se o Titanic acontecesse num elevador?”

1. Isabela pode propor o título do filme.
2. Você responde: “O elevador agora é um navio com vinte andares!”
3. Então: inventem como o capitão vai apertar o botão do último andar.

**Próxima rodada:** troquem quem propõe o lugar impossível.

**Para terminar:** escolham o título mais absurdo.`;
    expect(auditarBrincadeiras(texto)).toEqual({ quantidade: 1, falhas: [] });
  });
  it("rótulos de instrução vazados exigem correção mesmo com estrutura completa", () => {
    const texto = `**Título curto**
Tempo: 3 minutos
Material: nenhum
Como começar: “Vamos inventar um filme?”
1. preparo visível das opções
2. participação possível da pessoa: ela pode propor um título.
3. Então: você faz o elevador virar um navio.
Próxima rodada: troquem os papéis.
Para terminar: escolham o título.`;
    const auditoria = auditarBrincadeiras(texto);
    expect(auditoria.falhas).toContainEqual({ opcao: 1, codigo: "rotulo_interno" });
    expect(exigeCorrecaoDeBrincadeira(auditoria)).toBe(true);
  });
  it("reprova linha corrida mesmo quando o conteúdo lúdico está completo", () => {
    const texto = "🎧 *Crítica musical*\nEscolha uma música. Você: “Que mistério ela guarda?” Ela pode dar uma pista. Então: invente uma acusação engraçada: “Os aliens roubaram o refrão!” Na rodada seguinte, ela apresenta o programa.";
    expect(auditarBrincadeiras(texto)).toEqual({
      quantidade: 1,
      falhas: [
        { opcao: 1, codigo: "formato_nao_escaneavel" },
        { opcao: 1, codigo: "sem_encerramento" },
      ],
    });
  });
  it("audita a continuação depois de uma linha em branco como parte do mesmo jogo", () => {
    const texto = `**Expedição do dinossauro** 🦖

Escolha um brinquedo e diga: “O dinossauro sumiu! Você me mostra onde procurar?” Manu pode apontar ou fazer um gesto. Então, siga a indicação e faça uma descoberta engraçada. Depois, ela esconde o dinossauro e você procura.`;
    expect(auditarBrincadeiras(texto)).toEqual({
      quantidade: 1,
      falhas: [
        { opcao: 1, codigo: "formato_nao_escaneavel" },
        { opcao: 1, codigo: "sem_encerramento" },
      ],
    });
  });
  it("detecta reação natural quando o formato continua compacto", () => {
    const texto = `**Defenda o indefensável** Escolham um tema leve. Você diz: “Vou defender uma opinião absurda.” Bia pode falar, apontar ou escrever; você reage levando o argumento a sério e faz uma contraproposta engraçada. Na rodada seguinte, troquem os papéis.`;
    expect(auditarBrincadeiras(texto)).toEqual({
      quantidade: 1,
      falhas: [
        { opcao: 1, codigo: "formato_nao_escaneavel" },
        { opcao: 1, codigo: "sem_encerramento" },
      ],
    });
  });
  it("detecta uma virada vaga mesmo com turnos e segunda rodada", () => {
    const texto = `**Dinossauro**
Tempo: 3 minutos
Material: um desenho
Como começar: “O que ele faz?”
1️⃣ Mostre pular ou esconder com dois gestos.
2️⃣ Ela: aponta.
3️⃣ Então: encene a escolha dela de modo engraçado.
Próxima rodada: ela escolhe de novo.
Para terminar: guarde o desenho na toca.`;
    expect(auditarBrincadeiras(texto)).toEqual({ quantidade: 1, falhas: [{ opcao: 1, codigo: "virada_generica" }] });
  });
  it("não gera link nem metadado de história quando o conteúdo não é história", () => {
    const src = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    expect(src).toContain("respostaPareceHistoria(exp.texto)");
    expect(src).toContain("const linkHistoriaPromise = historiaEntregue");
    expect(src).toContain("if (resp.enviada && historiaEntregue && entregaHistoria)");
  });
});

describe("portão estrutural e sensorial", () => {
  const completa = `🎲 **Objeto viajante**
Tempo: 3 minutos
Material: um objeto comum
Como começar: “Ele vai parar ou passear?”
1️⃣ Mostre parar com a palma aberta e passear movendo dois dedos.
2️⃣ Ela: pode apontar, gesticular ou só observar.
3️⃣ Então: o objeto segue a escolha e vira um personagem engraçado.
Próxima rodada: ela escolhe uma nova virada.
Para terminar: diga que o objeto voltou para casa.`;

  it("extrai somente categorias de sensibilidade", () => {
    expect(detectarSensibilidadesRegistradas([
      { key: "sons", valor: "Incomoda-se com barulho alto" },
      { key: "texturas", valor: "Evita algumas texturas" },
      { key: "toques", valor: "Não gosta de abraço" },
    ])).toEqual(["som", "textura", "toque"]);
  });

  it("não transforma preferência positiva em sensibilidade", () => {
    expect(detectarSensibilidadesRegistradas([
      { key: "sons", valor: "Gosta de música baixa" },
      { key: "texturas", valor: "Prefere roupas macias" },
      { key: "perfil", valor: "Misto" },
    ])).toEqual([]);
  });

  it("aprova uma brincadeira completa que não reproduz o estímulo", () => {
    expect(auditarBrincadeiras(completa, ["som"])).toEqual({ quantidade: 1, falhas: [] });
    expect(auditarBrincadeiras(completa.replace("🎲 ", ""), ["som"])).toEqual({
      quantidade: 1,
      falhas: [],
    });
  });

  it("barra som usado como mecânica quando som é sensibilidade registrada", () => {
    const insegura = completa.replace(
      "o objeto segue a escolha",
      "o adulto imite um som alto e o objeto segue a escolha",
    );
    expect(auditarBrincadeiras(insegura, ["som"]).falhas).toContainEqual({
      opcao: 1,
      codigo: "reproduz_som_sensivel",
    });
  });
  it("adivinhar o título de uma música não significa reproduzir som", () => {
    const silenciosa = completa.replace("o objeto segue a escolha", "adivinhe o título de uma música por uma pista escrita; o objeto segue a escolha");
    expect(auditarBrincadeiras(silenciosa, ["som"]).falhas).not.toContainEqual({ opcao: 1, codigo: "reproduz_som_sensivel" });
    for (const acao of ["toque uma música", "imite um som", "adivinhe um som como rodada"]) {
      expect(auditarBrincadeiras(completa.replace("o objeto segue a escolha", acao), ["som"]).falhas).toContainEqual({ opcao: 1, codigo: "reproduz_som_sensivel" });
    }
  });

  it("barra onomatopeia como virada quando som é sensibilidade registrada", () => {
    const sonora = completa.replace(
      "o objeto segue a escolha",
      'o adulto diz "quack!" e o objeto segue a escolha',
    );
    expect(auditarBrincadeiras(sonora, ["som"]).falhas).toContainEqual({
      opcao: 1,
      codigo: "reproduz_som_sensivel",
    });
  });

  it("injeta somente categorias e proíbe onomatopeia no limite sonoro", () => {
    const bloco = blocoLimitesSensoriaisBrincadeira(["som", "textura"]);
    expect(bloco).toContain("som, textura");
    expect(bloco).toContain("nem escreva onomatopeias");
    expect(blocoLimitesSensoriaisBrincadeira([])).toBe("");
  });

  it("a instrução de correção leva códigos, não o texto do perfil", () => {
    const auditoria = auditarBrincadeiras("**Jogo**\nFaça um barulho como rodada.", ["som"]);
    const instrucao = instrucaoCorrecaoBrincadeira(auditoria, ["som"]);
    expect(instrucao).toContain("reproduz_som_sensivel");
    expect(instrucao).toContain("som");
    expect(instrucao).toContain("use um interesse registrado para mudar a MECÂNICA");
    expect(instrucao).toContain("Cada item já é uma ação concreta");
    expect(instrucao).toContain("nunca chame uma pessoa adulta de criança");
    expect(instrucao).not.toContain("barulho como rodada");
  });

  it("mantém a resposta completa e corrige reprodução sensorial registrada", () => {
    expect(exigeCorrecaoDeBrincadeira(auditarBrincadeiras(completa))).toBe(false);
    expect(exigeCorrecaoDeBrincadeira(auditarBrincadeiras(
      completa.replace("o objeto segue a escolha", "faça um barulho como rodada e o objeto segue a escolha"),
      ["som"],
    ))).toBe(true);
  });

  it("o piso mantém participação acessível sem fala, toque ou olhar", () => {
    const piso = pisoBrincadeiraSegura();
    expect(piso).toContain("Participação:");
    expect(piso).not.toContain("A criança:");
    expect(piso).toContain("apontar, olhar para uma opção, gesticular, falar ou só observar");
    expect(piso).toContain("sem exigir resposta");
    expect(piso).not.toMatch(/contato visual|toque obrigat/i);
    expect(auditarBrincadeiras(piso)).toEqual({ quantidade: 1, falhas: [] });
  });
  it("o piso de adolescente ou adulto é adequado à idade e não reproduz estímulo sensível", () => {
    for (const idade of [13, 18, 45]) {
      const piso = pisoBrincadeiraSegura(idade);
      expect(piso).toContain("Legenda improvável");
      expect(piso).not.toMatch(/bichinho|crian[çc]a/);
      expect(auditarBrincadeiras(piso, ["som", "toque", "textura", "cheiro", "luz"])).toEqual({ quantidade: 1, falhas: [] });
    }
  });
});
