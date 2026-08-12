import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formasDeEntrega,
  INTERESSE_COMO_VEICULO,
  A_CRIANCA_ANTES_DO_ROTULO as ROTULO,
} from "./formas";
import { TEMAS, CHAVES_TEMA, fraseDoTema, rotuloDoTema, listarTemas } from "./temas";
import { nucleoConducao } from "./diretrizes";
import { dividirEmBolhas, ehSoTitulo } from "@/lib/ayla/bolhas";
import { templateBoasVindasComDesafio } from "@/lib/ayla/messageTemplates";
import { VOZ_CONVERSA, VOZ_E_LIMITES, blocoIntencao } from "@/lib/ia/prompt";

/**
 * A EXPERIÊNCIA CONVERSACIONAL — o DNA do Kolo antigo trazido pra uma Ayla só.
 *
 * Os casos abaixo são os que a auditoria comparativa nomeou. Cada um existe
 * porque um mecanismo do sistema antigo produzia algo melhor, e a Ayla atual
 * tinha perdido: tema ativo, abertura que conhece a criança, entrega em blocos,
 * atividade ancorada em interesse, crença, futuro possível.
 */

const RESPONDER = readFileSync(resolve(__dirname, "../ayla/responder.ts"), "utf8");
const PROMPT_WEB = readFileSync(resolve(__dirname, "../ia/prompt.ts"), "utf8");
const ORCHESTRATOR = readFileSync(resolve(__dirname, "../ayla/orchestrator.ts"), "utf8");

// ============================================================
// BOLHAS — o divisor não pode picotar um bloco
// ============================================================

describe("montagem das bolhas", () => {
  it("título sozinho NÃO vira bolha — viaja com o conteúdo", () => {
    const texto = [
      "*O que eu faria primeiro*",
      "",
      "Tire a comida nova do prato dele.",
      "",
      "*Uma ideia pro fim de semana*",
      "",
      "Deixe ele lavar o que vai pro prato dos outros.",
    ].join("\n");

    const bolhas = dividirEmBolhas(texto);
    expect(bolhas).toHaveLength(2);
    expect(bolhas[0]).toBe("*O que eu faria primeiro*\nTire a comida nova do prato dele.");
    expect(bolhas[1]).toContain("*Uma ideia pro fim de semana*\n");
  });

  it("uma resposta de 4 blocos cabe em 4 bolhas, não em 8", () => {
    const texto = ["*A*", "", "um", "", "*B*", "", "dois", "", "*C*", "", "três", "", "*D*", "", "quatro"].join("\n");
    expect(dividirEmBolhas(texto)).toHaveLength(4);
  });

  it("prosa corrida continua se dividindo como sempre — nada regrediu", () => {
    const texto = "Primeira ideia.\n\nSegunda ideia.\n\nTerceira.";
    expect(dividirEmBolhas(texto)).toEqual(["Primeira ideia.", "Segunda ideia.", "Terceira."]);
  });

  it("título com emoji também gruda", () => {
    const bolhas = dividirEmBolhas("🎬 *Uma ideia usando algo que ela ama*\n\nEscrever a cena.");
    expect(bolhas).toHaveLength(1);
  });

  it("uma FRASE inteira em negrito não é título — pode ficar sozinha", () => {
    // Ênfase legítima. Se tratássemos como título, grudaríamos coisas que a
    // Ayla separou de propósito.
    expect(ehSoTitulo("*Isso não é culpa sua, e eu quero que você ouça isso com calma*")).toBe(false);
  });

  it("título no fim do texto não engole o conteúdo nem some", () => {
    const bolhas = dividirEmBolhas("Alguma coisa.\n\n*Título órfão*");
    expect(bolhas).toEqual(["Alguma coisa.", "*Título órfão*"]);
  });

  it("o orquestrador usa o divisor — não o split cru", () => {
    expect(ORCHESTRATOR).toMatch(/dividirEmBolhas\(textoCompleto\)/);
    expect(ORCHESTRATOR).not.toMatch(/textoCompleto\.split\(/);
  });
});

// ============================================================
// VOCABULÁRIO — uma fonte, quatro consumidores
// ============================================================

describe("vocabulário canônico de temas", () => {
  it("tem as 15 chaves, e as chaves são as do onboarding", () => {
    expect(CHAVES_TEMA).toHaveLength(15);
    for (const k of ["sensorial", "nutricional", "escola", "aprendizado", "saude_geral"]) {
      expect(CHAVES_TEMA).toContain(k);
    }
  });

  it("escola e aprendizado agora são LIDOS do perfil — a lacuna que existia", () => {
    // O mapa antigo do orquestrador tinha 9 chaves: a família marcava "escola"
    // no cadastro, o onboarding gravava, e a Ayla não enxergava.
    expect(rotuloDoTema("escola")).toBe("Escola");
    expect(rotuloDoTema("aprendizado")).toBe("Aprendizado");
    expect(ORCHESTRATOR).not.toMatch(/const extrasLabels/);
    expect(ORCHESTRATOR).toMatch(/for \(const t of TEMAS\)/);
  });

  it("toda chave tem rótulo e frase — nada sai vazio numa mensagem", () => {
    for (const t of TEMAS) {
      expect(t.rotulo.length).toBeGreaterThan(2);
      expect(t.frase.length).toBeGreaterThan(2);
    }
  });

  it("chave desconhecida não quebra a frase", () => {
    expect(fraseDoTema("chave_que_nao_existe")).toBe("esse ponto que você marcou");
  });

  it("lista até 3 temas em português natural", () => {
    expect(listarTemas(["nutricional", "foco", "rotina"])).toBe(
      "a alimentação, o foco e a rotina e as transições",
    );
    expect(listarTemas(["sono"])).toBe("o sono");
    expect(listarTemas(["sono", "foco", "escola", "motor"])).not.toContain("a parte motora");
  });
});

// ============================================================
// D — FAMÍLIA NOVA: a introdução
// ============================================================

describe("família nova — a introdução ensina o território", () => {
  const intro = templateBoasVindasComDesafio({
    nomeMae: "Carla",
    nomeMembro: "Théo",
    genero: "masculino",
    desafios: ["rotina", "sono", "emocional"],
  });

  it("cita os TRÊS desafios que a família marcou", () => {
    expect(intro).toContain("a rotina e as transições");
    expect(intro).toContain("o sono");
    expect(intro).toContain("as emoções e as crises");
  });

  it("deixa claro que veio do que ELA contou — não é inferência da Ayla", () => {
    expect(intro).toMatch(/Pelo que você contou quando entrou/);
  });

  it("delimita o território e pergunta por onde começar", () => {
    expect(intro).toMatch(/estratégias práticas/);
    expect(intro).toMatch(/brincadeiras e atividades/);
    expect(intro).toMatch(/Por qual você quer começar\?/);
  });

  it("promete uma primeira ideia prática, não um questionário", () => {
    expect(intro).toMatch(/primeira ideia prática/);
    expect(intro).toContain("*áudio*");
  });

  it("NÃO lista o catálogo de recursos nem promete artefato", () => {
    expect(intro).not.toMatch(/relatório|PDF|história|plano estratégico/i);
  });

  it("usa o nome da criança e concorda o gênero", () => {
    // A abertura de 02/08 nomeia a criança na APRESENTAÇÃO ("com o Théo"), e
    // não mais na frase dos desafios — que ficou mais limpa por isso.
    expect(intro).toContain("com o Théo");
    expect(intro).toContain("pro Théo");
    expect(intro).toContain("Eu sou a Ayla");
  });

  it("com um desafio só, a frase fica no singular", () => {
    const um = templateBoasVindasComDesafio({
      nomeMae: "Ana",
      nomeMembro: "Lia",
      genero: "feminino",
      desafios: ["nutricional"],
    });
    expect(um).toContain("é a alimentação");
    expect(um).toContain("com a Lia");
  });

  it("o orquestrador manda a lista inteira, não o [0]", () => {
    expect(ORCHESTRATOR).not.toMatch(/desafios_onboarding\?\.\[0\]/);
    expect(ORCHESTRATOR).toMatch(/carregarDesafiosOnboarding/);
  });
});

// ============================================================
// TEMA ATIVO — nasce no onboarding, continua pela conversa
// ============================================================

describe("tema ativo", () => {
  const INTENT = readFileSync(resolve(__dirname, "../ayla/intent.ts"), "utf8");

  it("o classificador devolve intenção E tema na MESMA chamada", () => {
    expect(INTENT).toMatch(/intencao\|tema/);
    expect(INTENT).toMatch(/TurnoClassificado = \{\n  intencao: IntencaoAyla;\n  tema: string \| null;/);
  });

  it("considera o que a família marcou no cadastro", () => {
    expect(INTENT).toMatch(/temasOnboarding/);
    expect(INTENT).toMatch(/TEMAS que a família marcou no cadastro/);
  });

  it("considera as duas últimas falas e manda continuar no mesmo tema", () => {
    expect(INTENT).toMatch(/ultimaMae/);
    expect(INTENT).toMatch(/ultimaAyla/);
    expect(INTENT).toMatch(/CONTINUIDADE MANDA/);
  });

  it("mensagem curta e ambígua NÃO reseta o tema", () => {
    expect(INTENT).toMatch(/"e de manhã\?"\), REPITA o tema anterior/);
  });

  it("tema inválido cai no anterior — perder o fio é pior que atrasar", () => {
    expect(INTENT).toMatch(/CHAVES_TEMA\.includes\(candidata\) \? candidata : anterior/);
  });

  it("falha do classificador não perde o tema", () => {
    expect(INTENT).toMatch(/return \{ intencao: "outro", tema: anterior, aceite: null, skills: \[\] \};/);
  });

  it("nada foi persistido — sem tabela, sem coluna", () => {
    expect(ORCHESTRATOR).not.toMatch(/tema_ativo/);
    expect(INTENT).not.toMatch(/from\("/);
  });

  it("o orquestrador carrega as falas anteriores pra dar continuidade", () => {
    expect(ORCHESTRATOR).toMatch(/async function ultimasFalas/);
    expect(ORCHESTRATOR).toMatch(/await ultimasFalas\(supabase, family\.id, inbound\.texto\)/);
  });
});

// ============================================================
// FORMAS DE ENTREGA — 2 a 4 blocos, na MESMA frente
// ============================================================

describe("formas de entrega", () => {
  const wa = formasDeEntrega({ canal: "whatsapp", tema: null });
  const web = formasDeEntrega({ canal: "web", tema: "nutricional" });

  it("NÃO obriga número de blocos — a forma nasce do que há a dizer", () => {
    // ⚠️ ESTE TESTE SE INVERTEU EM 10/08/2026, e a versão antiga não era erro.
    // Ele exigia "de 2 a 4 blocos" — que era o desenho de 02/08, quando o
    // problema era resposta rasa sem forma nenhuma. Medido sobre 70 títulos
    // das bancadas do piloto, aquele número virou o gabarito: 74% dos títulos
    // eram itens do repertório copiados, e três deles concentravam 77% dos
    // usos. Agora o teste guarda o oposto — que NÃO existe número obrigatório.
    expect(wa).not.toMatch(/de 2 a 4 blocos/);
    expect(wa).toMatch(/A FORMA NASCE DO QUE VOCÊ TEM A DIZER/);
    expect(wa).toMatch(/nenhum é obrigatório/);
    expect(wa).toMatch(/Na dúvida, prosa/);
  });

  it("NÃO reabre a resposta multi-frente que fechamos em 01/08", () => {
    // Este é o risco número um da camada inteira.
    expect(wa).toMatch(/NÃO abra duas dificuldades no turno/);
    expect(wa).toMatch(/escolha UM e entregue bem/);
  });

  it("um tipo de ajuda só = texto corrido, sem título nenhum", () => {
    // A válvula de escape virou a regra: título só quando separa naturezas
    // diferentes. "Na dúvida, prosa" é a instrução, não a exceção.
    expect(wa).toMatch(/Na dúvida, prosa/);
    expect(wa).toMatch(/são um parágrafo/);
  });

  it("a sintaxe do título é a do canal — e cada canal tem UMA", () => {
    // WhatsApp não renderiza markdown: lá o título é o negrito de um asterisco.
    expect(wa).toContain("*Assim*");
    expect(wa).not.toContain("**Assim**");
    expect(wa).not.toContain("##");
    // A web renderiza `##` como <h3>. Enquanto este bloco pedia `**Assim**` e a
    // seção de Formatação pedia `## título`, o modelo obedecia este e a
    // hierarquia sumia (0 `##` em 10 rodadas, 09/08/2026).
    expect(web).toContain("## Assim");
    expect(web).not.toContain("**Assim**");
  });

  it("proíbe título burocrático", () => {
    expect(wa).toMatch(/Se parecer rótulo de seção/);
  });

  it("segura o emoji", () => {
    expect(wa).toMatch(/No máximo um emoji/);
  });

  it("o tema ativo prioriza o perfil sem travar o assunto", () => {
    expect(web).toMatch(/O assunto desta conversa é ALIMENTAÇÃO/);
    expect(wa).not.toMatch(/O assunto desta conversa/);
  });

  it("cabe no teto — senão virou um segundo prompt", () => {
    // O nome antigo dizia "~1.000" e a asserção cobrava 1600; o bloco real
    // vinha ocupando ~1612 com a interpolação do tema. A reescrita de
    // 10/08/2026 (fim do gabarito) o deixou em ~1318 — 18% menor, com mais
    // liberdade de forma e menos texto. Instrução que encolhe e libera é o
    // sinal de que a regra estava no lugar errado, não faltando.
    expect(wa.length).toBeLessThan(1600);
  });
});

// ============================================================
// CRENÇA e FUTURO — opcionais, com forma obrigatória
// ============================================================

describe("crença e futuro possível", () => {
  const wa = formasDeEntrega({ canal: "whatsapp", tema: null });

  it("crença existe como forma, e só quando aparece na fala", () => {
    // ⚠️ O RÓTULO saiu do repertório em 10/08/2026 (ele era um dos seis que
    // NUNCA foram usados em 70 títulos medidos). A REGRA não saiu: ela vive em
    // `A_CRIANCA_ANTES_DO_ROTULO`, que entra nos dois canais junto com esta
    // camada. O teste passou a guardar a regra, que é o que protege a família.
    expect(ROTULO).toMatch(/CRENÇA só quando houver base/);
    expect(ROTULO).toMatch(/Sem base, não nomeie crença/);
  });

  it("NUNCA a forma de nomear crença como diagnóstico", () => {
    expect(wa).not.toMatch(/crença limitante/i);
  });

  it("futuro é realidade + possibilidade + passo — não promessa", () => {
    // Mesma história do rótulo de crença: a regra do futuro vive na constante.
    expect(ROTULO).toMatch(/descreva a AÇÃO, não o resultado/);
    expect(ROTULO).toMatch(/promessa disfarçada de informação/);
  });

  it("o núcleo continua proibindo prever resultado — a base do freio", () => {
    const n = nucleoConducao();
    expect(n).toMatch(/não promete resultado/);
  });
});

// ============================================================
// INTERESSE — veículo, não assunto
// ============================================================

describe("interesse da criança", () => {
  it("liberado como VEÍCULO de brincadeira, atividade, metáfora, adaptação", () => {
    expect(INTERESSE_COMO_VEICULO).toMatch(/brincadeira, uma atividade, uma metáfora, uma adaptação/);
    expect(INTERESSE_COMO_VEICULO).toMatch(/USE o interesse dele/);
  });

  it("continua proibido puxar assunto ou exibir memória", () => {
    expect(INTERESSE_COMO_VEICULO).toMatch(/continua proibido puxar o interesse pra abrir assunto/);
    expect(INTERESSE_COMO_VEICULO).toMatch(/pra mostrar que você lembra/);
  });

  it("dado antigo vem com checagem leve DENTRO da frase", () => {
    expect(INTERESSE_COMO_VEICULO).toMatch(/se ele ainda estiver nessa fase de Lego/);
    expect(INTERESSE_COMO_VEICULO).toMatch(/ela te corrige sem constrangimento/);
  });

  it("o freio original continua no contexto — não foi removido", () => {
    expect(RESPONDER).toMatch(/NÃO puxe por conta própria um assunto guardado no perfil/);
  });
});

// ============================================================
// QUANDO NÃO USAR — os casos que exigem texto corrido
// ============================================================

describe("quando os blocos NÃO entram", () => {
  it("a regra do WhatsApp existe e é conservadora", () => {
    expect(RESPONDER).toMatch(/export function ehEntrega/);
    expect(RESPONDER).toMatch(/na dúvida, texto corrido/);
  });

  it("desabafo e pergunta simples: sem desafio detectado, sem blocos", () => {
    expect(RESPONDER).toMatch(/return Boolean\(params\.sinais\?\.desafio\);/);
  });

  it("pedido explícito de plano não ganha blocos — a resposta ali é curta", () => {
    expect(RESPONDER).toMatch(/if \(params\.querPlano\) return false;/);
  });

  it("a segunda passada da rede de fronteiras nunca ganha formato por cima", () => {
    expect(RESPONDER).toMatch(/if \(params\.regenerarPorDiagnostico\) return false;/);
  });

  it("na web, só 'desafio' — crise, desabafo e dúvida ficam em prosa", () => {
    expect(PROMPT_WEB).toMatch(/const entrega = intencao === "desafio";/);
  });

  it("a estrutura visual continua condicionada à entrega — e agora nos DOIS ramos", () => {
    // A regra não mudou: crise, desabafo e dúvida seguem em prosa. O que mudou
    // em 09/08/2026 é que o ramo da ENTREGA deixou de proibir estrutura e passou
    // a ensiná-la — antes ele dizia "negrito no máximo em 1 palavra e nunca como
    // título", e por isso a resposta chegava à tela como parágrafo corrido
    // mesmo quando havia três frentes pra organizar.
    expect(PROMPT_WEB).not.toMatch(/NÃO use títulos de seção pra cada parte/);
    // O ramo com entrega ENSINA a estrutura que a tela sabe renderizar.
    expect(PROMPT_WEB).toMatch(/A tela renderiza markdown de verdade/);
    expect(PROMPT_WEB).toMatch(/A estrutura nasce do raciocínio, não de um gabarito/);
    // E o ramo SEM entrega continua proibindo — este é o guarda que importa.
    expect(PROMPT_WEB).toMatch(/Aqui a resposta é TEXTO CORRIDO/);
    expect(PROMPT_WEB).toMatch(/Sem títulos de seção, sem listas, sem divisórias/);
  });

  it("MORDE: os dois ramos não podem virar um só", () => {
    // Se alguém remover a condicional e liberar estrutura pra todo mundo, quem
    // está desabafando passa a receber um documento organizado.
    const iEntrega = PROMPT_WEB.indexOf("A tela renderiza markdown de verdade");
    const iProsa = PROMPT_WEB.indexOf("Aqui a resposta é TEXTO CORRIDO");
    expect(iEntrega).toBeGreaterThan(-1);
    expect(iProsa).toBeGreaterThan(-1);
    expect(PROMPT_WEB).toMatch(/entrega\s*\?/);
  });
});

// ============================================================
// SALDO — a camada nova tem que ser paga
// ============================================================

describe("simplificação: o prompt não pode crescer", () => {
  it("a duplicação do VOZ_E_LIMITES saiu do caminho conversa", () => {
    expect(VOZ_CONVERSA.length).toBeLessThan(VOZ_E_LIMITES.length);
    // O que saiu está no PISO — não sumiu do produto.
    for (const some of ["RECOMPENSA", "MATERIAIS DE BRINCADEIRA", "CONCORDÂNCIA DE GÊNERO"]) {
      expect(VOZ_CONVERSA).not.toContain(some);
    }
    expect(VOZ_E_LIMITES).toContain("RECOMPENSA");
  });

  it("os caminhos SEM núcleo continuam com a voz inteira", () => {
    // Os 7 botões e o gerador de plano dependem dela — podá-los seria remover
    // proteção de verdade, não duplicação.
    expect(PROMPT_WEB).toMatch(/VOZ_LIMITES_E_FRONTEIRA = `\$\{VOZ_E_LIMITES\}/);
    expect(PROMPT_WEB).toMatch(/\$\{VOZ_LIMITES_E_FRONTEIRA\}/);
  });

  it("blocoIntencao('desafio') não repete mais VOZ 2 e VOZ 3", () => {
    const b = blocoIntencao("desafio");
    expect(b).not.toMatch(/No máximo UMA pergunta/);
    expect(b).not.toMatch(/não investigue duas ao mesmo tempo/);
    // O que só existe na web fica: o marcador que faz aparecer o botão.
    expect(b).toMatch(/MARCADOR|marcador/);
  });

  it("as formas de entrega ficaram FORA do núcleo", () => {
    const n = nucleoConducao();
    expect(n).not.toContain("O que eu faria primeiro");
    expect(n).not.toContain("de 2 a 4 blocos");
  });

  it("o núcleo tem um teto — e o teto é consciente", () => {
    // 46.793 em 02/08. Em 03/08 subiu para ~50,5k com três regras que vieram
    // de falhas reais em produção: a distinção diagnóstico conhecido × novo ×
    // causa, a proibição de declarar o mecanismo cerebral da criança, e a de
    // decidir pela família o que não precisa ser decidido.
    //
    // É crescimento, e é reconhecido como custo. A poda cirúrgica do núcleo
    // está adiada de propósito até a experiência ser validada com famílias —
    // mexer nele antes de saber o que melhorou seria trocar de problema.
    // O teto existe pra que o próximo aumento seja uma DECISÃO, não um
    // acúmulo silencioso.
    //
    // 06/08/2026 — A DECISÃO, registrada como o teto pede. Subiu pra 52.500
    // para caber quatro mudanças de condução pedidas na frente de correção
    // estrutural: a distinção entre o menu que ORGANIZA e o menu que foge, o
    // "dê o primeiro passo quando já dá", "pergunta é ferramenta, não ritual"
    // e o fim da obrigação de acolher antes de toda resposta.
    //
    // O crescimento LÍQUIDO foi de ~300 caracteres, porque as quatro foram
    // pagas removendo duplicação real: a coreografia de ritmo estava escrita
    // duas vezes (REGRA_SEQUENCIA e VOZ 3) e o bloco de ampliar a percepção
    // repetia os próprios exemplos. Regra nenhuma foi perdida.
    //
    // 06/08/2026 (2ª decisão do dia) — sobe pra 54.000 por DUAS entradas da
    // migração conversacional, e nada além delas:
    //
    //   CONTRATO_DE_VERDADE (~1.300) — a Ayla disse "já atualizo aqui",
    //   "anotado" e "Chegou!" sem que nada disso tivesse acontecido (conversa
    //   da Vitória). É a única regra da base que fica PIOR com um modelo
    //   melhor: um modelo mais fluente narra o estado falso de forma mais
    //   convincente. Entra junto com a troca de provider, de propósito.
    //
    //   VOZ 7, avanço a cada turno (~250) — o GPT repetiu 22% das explicações
    //   na bancada (34,9% na web). A mitigação inteira é UMA linha: sem teto de
    //   palavras, sem pergunta obrigatória, sem blacklist de frases — porque
    //   regra que compete por atenção com outra é como a falha do diagnóstico
    //   aconteceu.
    //
    // Desta vez o crescimento NÃO foi pago com poda: a poda cirúrgica segue
    // adiada até a experiência nova ser validada com famílias.
    //
    // 07/08/2026 — sobe pra 57.000 por DUAS entradas, ambas nascidas da
    // comparação com o app anterior (conversa da Karina sobre o Mario):
    //
    //   EXPLICACAO (~2.200) — a Ayla nova ficou segura e SECA: perguntaram
    //   como acalmar uma criança agitada em loja e ela devolveu só direção,
    //   nenhuma compreensão. O app antigo explicava — e por isso parecia mais
    //   inteligente — mas afirmava mecanismo sobre aquela criança ("o corpo se
    //   move mais rápido do que o cérebro consegue planejar"). A regra separa
    //   as duas coisas: conhecimento geral pode; certeza individual não.
    //   Não cabe em uma linha porque o valor dela está nas FORMAS concretas
    //   ("para algumas crianças" ↔ "o cérebro dele precisa") e nos quatro
    //   movimentos — sem os exemplos, vira exortação, que é exatamente o que
    //   não segurou na VOZ 7.
    //
    //   TRÊS NÍVEIS no PISO (~700) — "risco de acidente" era gatilho largo
    //   demais: "pode derrubar coisas em lojas" virava resposta de crise, com
    //   afastar objetos, "não vou deixar você se machucar" e emergência. O
    //   eixo do adulto já tinha o seu piso na linha de cima desde sempre
    //   (assinatura ≠ ideação); o do comportamento da criança, não.
    //
    // A repetição, que é o outro achado do mesmo dia, NÃO virou texto de
    // núcleo: virou código em `angulos.ts`. VOZ 7 já era a exortação, e ela
    // falhou com a resposta anterior no histórico — a lista concreta do que
    // ela mesma já orientou custa zero caractere aqui.
    // 12/08/2026 — sobe pra 63.000 por DUAS entradas, e desta vez o
    // crescimento foi MEDIDO contra o comportamento real antes de ser pedido
    // (prova paga em `ayla/prova-core-real.test.ts`, caso Daniel).
    //
    //   CORE_PROFISSIONAL (~5.400) — as duas falhas do caso Daniel não vieram
    //   de falta de proibição. "É o sistema sensorial pedindo input" viola a
    //   VOZ 5 e a EXPLICACAO, que ESTAVAM no prompt e perderam; e a resposta
    //   inteira ignorou planta e plástico porque o PISO só cobre CRISE, e um
    //   relato cotidiano com risco concreto não é crise. Regra que falha em
    //   prompt se corrige estruturalmente, e a estrutura que faltava não era
    //   mais uma proibição: era o MOVIMENTO SUBSTITUTO — várias hipóteses no
    //   lugar da causa declarada, e proteger antes de explicar. Sem os
    //   exemplos concretos ("é o sistema sensorial pedindo" ↔ "pode estar
    //   funcionando como uma forma de regulação") vira exortação, que é
    //   exatamente o que já não segurou.
    //
    //   FRONTEIRA_JURIDICA (~1.100) — o que existia era um exemplo em
    //   EXEMPLOS e uma linha na VOZ 5 sobre não prever benefício. Nenhum dos
    //   dois cobre inventar artigo de lei ou jurisprudência, que é o modo de
    //   falha específico de um modelo neste assunto. O exemplo antigo de
    //   EXEMPLOS foi REMOVIDO e consolidado aqui — o teto pagou parte do
    //   crescimento com poda, não só com número novo.
    //
    // O que este teto NÃO autoriza: as lentes especializadas (Sensorial,
    // Emocional, Comunicação). Elas são conteúdo POR TURNO e não podem entrar
    // no núcleo, que todo turno paga.
    // 12/08/2026 (segunda subida do dia) — sobe pra 67.000. Todo o crescimento
    // é do CORE_PROFISSIONAL, e cada entrada nasceu de comportamento medido no
    // fluxo real, não de vontade de escrever mais:
    //
    //   ORIENTAR OU PERGUNTAR (~1.100) — SUBSTITUI o "AJUDE PRIMEIRO" rígido,
    //   que custou caro: em 12 conversas reais, "ele não quer entrar na escola"
    //   recebeu 28 palavras e duas perguntas sem nenhuma ajuda. A regra antiga
    //   não sabia que ali perguntar ERA o certo — separação, transição,
    //   sobrecarga, medo e conflito pedem condutas diferentes. A trava mudou de
    //   "ajude antes" para "confira o que já sabemos antes de perguntar".
    //
    //   PROPORÇÃO (~450) — a conversa não é o Plano. Decisão da Karina: a
    //   riqueza estrutural (compreensão, estratégias, atividades, crenças,
    //   acompanhamento) mora no Plano, e o turno de WhatsApp responde no
    //   tamanho do que a mãe trouxe. Sem isto, tudo o mais que entrou aqui
    //   empurraria a conversa para virar um plano em miniatura.
    //
    //   CADA CRIANÇA É ÚNICA (~500) — REVERTE uma leitura estreita. Explicar
    //   pelo diagnóstico ("isso acontece com muitas crianças autistas") é
    //   legítimo e ajuda; o erro é ENCERRAR ali. Quatro das 12 respostas reais
    //   abriam generalizando e não voltavam para a criança — o defeito era a
    //   volta que faltava, não a explicação.
    //
    //   COMO ESTA CRIANÇA RECEBE (~550) e INTERESSE É FERRAMENTA (~500) — o
    //   segundo só passou a fazer sentido agora: a auditoria descobriu que o
    //   domínio `gostos` (hiperfocos, filmes, brincadeiras) NUNCA chegava ao
    //   produtor em canal nenhum. Instruir a usar interesse sem o dado teria
    //   sido instrução morta; as duas coisas entram juntas.
    //
    //   CRENÇAS (~700) — expansão do parágrafo que já existia, com as leituras
    //   que aparecem de verdade ("tudo vira uma luta", "tenho medo do futuro
    //   dele") e os deslocamentos que a Kolo quer produzir.
    //
    // O que este teto continua NÃO autorizando: as lentes. Elas são conteúdo
    // por turno e ficam fora do núcleo — inclusive o bloco novo de integração
    // entre domínios, que vive no envelope da lente justamente para não ser
    // pago nos 44% de turnos sem skill.
    // 12/08/2026 (terceira subida) — 70.000, por duas entradas que nasceram de
    // conversa medida, não de vontade de escrever:
    //
    //   A FORMA DA INTERAÇÃO É UMA ALAVANCA (~1.100) — o patrimônio do antigo
    //   KoloDiálogo Afetivo. A auditoria mostrou que o Core já tinha o CARDÁPIO
    //   de formas (gesto, demonstrar, fazer junto, antecipar) mas não o
    //   PRINCÍPIO: olhar a interação entre criança, adulto, demanda e ambiente,
    //   e não só o comportamento da criança. Faltavam também `ritmo da fala` e
    //   `atenção antes da instrução`, ausentes em Core, VOZ e lentes.
    //
    //   INVESTIGAR TAMBÉM É AJUDAR A MÃE A PENSAR (~1.700) — medido no caso A:
    //   "Ele não quer entrar na escola" recebeu UMA pergunta aberta e nada
    //   mais. Correto pela regra (faltava contexto), e pobre como produto: a
    //   mãe não sabe o que é relevante observar. O bloco troca a pergunta
    //   aberta por hipóteses plausíveis que ela reconhece, geradas pela IA a
    //   partir DAQUELE caso — e exige ajuda útil na mesma mensagem.
    //
    // ⚠️ O RISCO DESTE ÚLTIMO É VIRAR TABELA. Ele traz dois exemplos, e os
    // exemplos são a FORMA, nunca o conteúdo: "as opções são geradas por você,
    // a partir daquele caso — não existe lista fixa por assunto". Se algum dia
    // aparecer aqui um mapa "se escola → mostre as opções X", é o paredão de
    // regras voltando pela porta dos fundos.
    // 13/08/2026 — 74.000, pela M1 (o arco da conversa):
    //
    //   FECHE A INVESTIGAÇÃO QUANDO ELA CONVERGIR (~1.200) — a lacuna número
    //   um, medida: a Ayla abre bem (hipóteses numeradas) e não sabe FECHAR.
    //   Reconhecer o achado devolvendo o mérito à mãe, conectar os pontos como
    //   hipótese, e parar de investigar. É o que faz a conversa da Isabela ser
    //   boa no app anterior — e o freio contra o vício dele junto: proibido
    //   narrar o que se passou "na cabecinha dela".
    //
    //   A SEGUNDA PORTA (~1.100) — as hipóteses também servem quando NÃO falta
    //   contexto: quando a mãe lê o comportamento como intenção ("birra",
    //   "me desafia", "do nada"). Aí a lista não decide nada por você, ela
    //   ENSINA A MÃE A LER O FILHO. Vem com a regra do avesso colada — cinco
    //   situações em que NÃO se lista —, porque lista em todo turno é
    //   formulário com cara de ajuda, e esse é o modo de falha mais provável
    //   desta entrada.
    //
    // ⚠️ ESTE TETO ESTÁ FICANDO CARO. Quatro subidas em dois dias (54 → 57 →
    // 63 → 67 → 70 → 74). O núcleo é pago em TODO turno, e a próxima entrada
    // deveria ser PAGA COM PODA, não com número novo — há candidatos: os
    // EXEMPLOS herdados das 11 diretrizes antigas, e a sobreposição entre
    // VOZ 2 e o "ORIENTAR OU PERGUNTAR". A poda foi adiada até a experiência
    // nova ser validada com famílias; quando for, é a primeira coisa a fazer.
    expect(nucleoConducao().length).toBeLessThan(74_000);
  });
});

/**
 * A CRIANÇA ANTES DO RÓTULO — bancada de experiência, 03/08/2026.
 *
 * Três de dez casos explicaram o comportamento pelo diagnóstico tendo dado
 * melhor à mão. O pior: "isso é bem comum no TDAH: a cabeça antecipa a perda",
 * com "antecipa o pior" já registrado no perfil da própria Isabela.
 */
describe("a criança antes do rótulo", () => {
  const PROMPT = readFileSync(resolve(__dirname, "../ia/prompt.ts"), "utf8");

  it("manda usar relato → perfil → diagnóstico, nessa ordem", () => {
    expect(ROTULO).toMatch(/1\) o que a família acabou de relatar/);
    expect(ROTULO).toMatch(/2\) o que já está observado no perfil DELA/);
    expect(ROTULO).toMatch(/3\) o diagnóstico — e só se acrescentar/);
  });

  it("nomeia o atalho exato que apareceu na bancada", () => {
    expect(ROTULO).toMatch(/"é comum no autismo\/TDAH" como a razão de ESTA criança/);
  });

  // NEGATIVO 1 — não pode virar mordaça: informação geral útil segue liberada.
  it("NÃO proíbe toda menção a diagnóstico", () => {
    expect(ROTULO).toMatch(/Mencionar o diagnóstico continua permitido/);
    expect(ROTULO).toMatch(/isso também aparece em pessoas com TDAH/);
    expect(ROTULO).not.toMatch(/nunca (cite|mencione) o diagnóstico/i);
  });

  // NEGATIVO 2 — sem dado individual, possibilidade geral continua valendo.
  it("sem base, oferece a saída em vez de calar", () => {
    expect(ROTULO).toMatch(/uma possibilidade que vale observar/);
  });

  // NEGATIVO 3 — com dado individual, o dado vence.
  it("com relato ou perfil, o diagnóstico não entra", () => {
    expect(ROTULO).toMatch(/Se 1 ou 2 já explicam, o diagnóstico não entra/);
    expect(ROTULO).toMatch(/pelo que a gente já viu nele/);
  });

  it("crença precisa de base — deduzir do diagnóstico não vale", () => {
    expect(ROTULO).toMatch(/fala da criança, fala da família, ou padrão observado/);
    expect(ROTULO).toMatch(/Crença deduzida do diagnóstico não vale/);
  });

  it("futuro descreve ação, e traz o caso Enzo como contraexemplo", () => {
    expect(ROTULO).toMatch(/descreva a AÇÃO, não o resultado/);
    expect(ROTULO).toMatch(/dá pra ampliar o repertório dele aos poucos/);
    // Segunda passada da bancada: o modelo trocou a promessa por prognóstico.
    expect(ROTULO).toMatch(/seletividade costuma melhorar quando…" é promessa disfarçada/);
  });

  // Cobrar lastro fez a Ayla recitar o perfil e pedir confirmação do que já
  // sabia — 5 falhas novas em `mudanca_tema`. O antídoto mora no mesmo bloco.
  it("usar o dado não é recitar o dado nem confirmá-lo", () => {
    expect(ROTULO).toMatch(/RACIOCINAR com eles e ir direto pra ajuda/);
    expect(ROTULO).toMatch(/não é recitá-los de volta, nem pedir confirmação/);
    expect(ROTULO).toMatch(/ele é ponto de partida, não pergunta/);
  });

  it("entra nos DOIS canais, e só quando há entrega", () => {
    expect(RESPONDER).toMatch(/A_CRIANCA_ANTES_DO_ROTULO,\n\s*\]/);
    expect(PROMPT).toMatch(/\$\{A_CRIANCA_ANTES_DO_ROTULO\}/);
    // Desabafo não recebe: quem pede bloco interpretativo é a entrega.
    expect(RESPONDER).toMatch(/\.\.\.\(entrega/);
    expect(PROMPT).toMatch(/entrega\n\s*\? `/);
  });

  it("fica fora do núcleo — que é carregado em todo turno de toda ferramenta", () => {
    expect(nucleoConducao()).not.toContain("De onde vem a sua explicação");
  });
});

/**
 * RECOMPENSA — a regra revista em 09/08/2026.
 *
 * A proibição antiga nasceu do caso da uva-passa: a Ayla oferecia repetidamente
 * um alimento preferido como prêmio por comportamento. A regra funcionou, e
 * ficou larga demais — chegou a proibir "reforço estilo ABA" por nome, o que é
 * oposição a uma técnica, não escolha de intervenção.
 *
 * O que a revisão preserva é a linha que importa: não comprar comportamento, e
 * nunca condicionar o que a criança não pode perder.
 */
describe("recompensa: compreender antes de premiar", () => {
  const nucleo = nucleoConducao();

  it("R1. o princípio é compreender a barreira, não proibir prêmio", () => {
    expect(nucleo).toMatch(/RECOMPENSA NÃO SUBSTITUI COMPREENSÃO/);
    expect(nucleo).toMatch(/entenda o que dificulta a ação antes/i);
  });

  it("R2. o que não pode ser moeda continua protegido", () => {
    expect(nucleo).toMatch(/NUNCA condicione afeto, comida, segurança ou necessidade básica/);
    expect(nucleo).toMatch(/nem troque objeto por obediência/);
  });

  it("R3. interesse conecta — e a distinção está no exemplo", () => {
    expect(nucleo).toMatch(/Interesse serve pra CONECTAR/);
    expect(nucleo).toMatch(/missão de dinossauros é bom; dar o dinossauro por ter lido, não/);
  });

  it("R4. MORDE: a oposição ideológica a uma técnica não pode voltar", () => {
    expect(nucleo).not.toMatch(/estilo ABA/i);
    expect(nucleo).not.toMatch(/não é o método Kolo/i);
  });
});
