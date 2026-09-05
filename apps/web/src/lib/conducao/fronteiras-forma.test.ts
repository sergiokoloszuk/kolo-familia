import { describe, it, expect } from "vitest";
import {
  formaAtravessada,
  perguntasReais,
  ehMenuDeAlternativas,
  naturezaDoTurno,
  modoForma,
  TETO,
  type ContextoDeForma,
} from "./fronteiras-forma";

/**
 * AS FIXTURES SÃO CONVERSAS REAIS, anonimizadas, colhidas em produção entre
 * 17 e 26/08/2026 na auditoria P0. Os nomes de criança viram [C]; os nomes de
 * quem cuida foram trocados.
 *
 * ⚠️ AS DE NÃO-REGRESSÃO SÃO METADE DO ARQUIVO, e é de propósito. O protocolo
 * (§12, caso I) diz que quase toda correção que suprime algo suprime demais — e
 * aqui o que está em risco é justamente o que a auditoria mediu como BOM:
 * utilidade 4,1 e segurança 4,6. Uma fronteira de forma que estrague uma
 * resposta forte é pior do que fronteira nenhuma.
 */

const ctx = (mensagem: string, jaHouveOrientacao = false): ContextoDeForma => ({
  mensagem,
  jaHouveOrientacao,
});

// ── PROBLEMÁTICAS ────────────────────────────────────────────────────────────

/** FIX-P13 · agressão em casa. Conteúdo correto, QUATRO perguntas. */
const FIX_P13_MSG = "Ontem ele ficou furioso dentro de casa, quebrou os brinquedos dele e bateu a bola na perna da minha vizinha.";
const FIX_P13 = `Anali, sinto muito — deve ter sido muito tenso. Quebrar objetos e acertar a vizinha precisa ser tratado primeiro como uma questão de segurança, sem transformar o [C] em "mau". Antes de tudo: sua vizinha ficou machucada? Ela está com dor forte, inchaço ou dificuldade para andar? Se sim, ofereça ajuda e procure atendimento. E o [C] está calmo e seguro agora?

Se voltar a acontecer:
1. Afaste a vizinha e outras pessoas, sem discutir com ele.
2. Retire bolas, objetos quebráveis e itens perigosos do alcance.
3. Fale pouco e com voz firme.
4. Dê espaço para ele se acalmar, mantendo supervisão à distância segura.`;

/** FIX-P7 · desabafo de anos respondido com menu de 6 opções. */
const FIX_P7_MSG = "A luta com o sono e desde dela pequena";
const FIX_P7 = `Entendo, Dia. Uma luta com o sono desde pequena pode ser muito desgastante para vocês — e não significa que você esteja fazendo algo errado. Para eu indicar o primeiro caminho, qual situação descreve melhor a [C]? 1. demora muito para pegar no sono; 2. só dorme com alguém junto ou com muita ajuda; 3. acorda várias vezes durante a noite; 4. acorda muito cedo; 5. fica agitada ou chora quando chega a hora de dormir; 6. é outra situação. Pode responder só com o número.`;

/** FIX-P17 · mensagem de 12 caracteres respondida com 620. */
const FIX_P17_MSG = "Sim conversa";
const FIX_P17 = `Ótimo, Lorena. Então podemos usar a fala da [C] para ajudá-la a entender e expressar melhor as emoções — algo que também pode influenciar a agitação na hora de dormir. Quando ela se frustra ou fica contrariada, o que acontece mais? 1. chora ou grita; 2. fica irritada quando precisa parar uma brincadeira; 3. consegue explicar o que sentiu, mas demora para se acalmar; 4. outra situação. Por enquanto, experimente nomear sem fazer muitas perguntas: "Você queria continuar dançando. Ficou chateada porque a dança acabou." Depois, ofereça uma escolha simples: "Quer um abraço ou respirar comigo?"`;

/** FIX-P10 · 2.420 caracteres. Reduzido aqui ao que importa para o detector. */
const FIX_P10_MSG = "O [C] está dando muito trabalho na escola como bater nos amiguinhos, mas professoras e acaba indo para a coordenação para se acalmar. Quando vou com ele pra outros lugares na presença de algum conhecido nosso, o [C] acaba gritando comigo, me batendo, me xingando e no final acaba me pedindo desculpas. Só como passo a maior parte do tempo com ele em casa, quando tá nos 2 ele fica tranquilo. É mais essa questão mesmo que me preocupa muito e eu já não sei mais o que fazer com ele nessas horas.";
const FIX_P10 = "x".repeat(2420);

// ── NÃO-REGRESSÃO ────────────────────────────────────────────────────────────

/** FIX-P1 · a melhor da amostra: 717 chars, ZERO perguntas, resolve o calor. */
const FIX_P1_MSG = "Então, ele algumas noites está dormindo um pedaço da noite sozinho. Essa noite ele dormiu um pedaço da noite sozinho, mas aí ele sentiu o calor e ele me chamou porque ele estava suado. Então, eu acho que eu vou ter que deixar uma camiseta para ele trocar, caso ele fique suado, sabe? Mas às vezes eu deixo a janela um pouco aberta, mas também não dá para deixar o ventilador e a janela abertas ao mesmo tempo, porque aí fica muito frio de madrugada.";
const FIX_P1 = `Isso está indo: o [C] já está conseguindo atravessar uma parte da noite sozinho, e dessa vez chamou por um desconforto concreto — o calor. Deixe uma camiseta leve e, se ajudar, uma toalhinha ao alcance dele ou pronta para você entregar. Antes de abrir mais a janela, eu testaria reduzir uma camada de roupa ou coberta. Ventilador e janela não precisam ser proibidos por medo de ele ficar doente; o cuidado é evitar vento direto e observar se ele fica confortável. Quando ele chamar, use poucas palavras: "Você está suado. Vamos trocar a camiseta e voltar a deitar." Depois, retome a rotina sem transformar o despertar numa conversa longa. Repara se, com essa troca preparada, ele volta a dormir com menos ajuda.`;

/** FIX-P11 · situação delicada: a mãe conta que bateu no filho. */
const FIX_P11_MSG = "Nos meus pais até que ele ficou calmo. Mas quando eu saí com uma amiga ontem e ele conhece muito bem, foi horrível pq ele disse inúmeras coisas horríveis pra mim. Me bateu o tempo todo. Eu assim tô muito triste com essa situação... até que chegou uma hora me explodi e bati nele.";
const FIX_P11 = `Tamires, sinto muito. Deve ter sido muito doloroso ouvir tudo isso e ser agredida. Você não é uma mãe horrível por ter perdido o controle; foi uma situação muito intensa. Ao mesmo tempo, bater nele não é seguro — e agora o mais importante é proteger vocês dois, sem culpa e sem esconder o que aconteceu. Se isso começar de novo, não tente manter a conversa: afaste [C] da sua amiga, bloqueie os golpes sem machucá-lo e diga só: "Eu não vou deixar você me bater. Vamos sair daqui."`;

/** FIX-P14 · personalização funcional: TDAH+TEA calibram o prazo. */
const FIX_P14_MSG = "Fiz uma droga com ele, disse que se ele se comportar até quinta-feira que ele vai ter o celular de volta, onde ele se comportou.";
const FIX_P14 = `Anali, você não fez "uma droga". Você tentou encontrar uma consequência, provavelmente num momento muito difícil. Só que "se comportar até quinta" é um período longo e pouco claro para o [C], especialmente com TDAH e TEA. Ele pode não saber exatamente o que precisa fazer nem conseguir sustentar isso por vários dias. Em vez de esperar até quinta, escolha 1 ou 2 comportamentos observáveis e faça revisões curtas: "Vamos tentar até o almoço". Se ele conseguir, reconheça imediatamente.`;

/** FIX-P15 · a idade (11 anos) altera a conduta. Termina com UMA pergunta. */
const FIX_P15_MSG = "Já era segunda vez";
const FIX_P15 = `Entendi, Anali. Como já aconteceu pela segunda vez, não use isso no combinado do celular nem como castigo. Pode acontecer por vários motivos, mas aos 11 anos vale acompanhar. Por agora: acolha sem bronca, troque a roupa de cama e preserve a privacidade dele; observe se há dor ou ardor ao urinar, febre, muita sede ou prisão de ventre. Aconteceu em noites próximas ou foram episódios bem espaçados?`;

// ── R7 · ensinar a família a dar contexto ────────────────────────────────────

const FIX_R7_1_MSG = "Ele grita";
const FIX_R7_2_MSG = "Ele grita quando desligo o tablet";
const FIX_R7_3_MSG =
  "Ontem ele gritou quando pedi para desligar o tablet. Eu tinha avisado 10 minutos antes e mostrei no relógio, mas quando o timer tocou ele jogou o controle no chão e chorou uns 5 minutos. Foi na sala, comigo e com a irmã dele junto. Depois ele veio me abraçar. Isso acontece quase todo dia no fim da tarde, e a única coisa que já tentei foi avisar antes.";

// ============================================================
describe("perguntasReais — o que NÃO é pergunta da Ayla", () => {
  it("1. fala pronta entre aspas NÃO conta — é a frase que a mãe vai usar", () => {
    const t = `Fale baixo e diga: "Você prefere sair agora ou em 5 minutos?" Depois espere.`;
    expect(perguntasReais(t)).toHaveLength(0);
  });

  it("2. a querystring do link NÃO conta", () => {
    const t = "Montei um plano. É só tocar aqui: https://exemplo.app/auth/wa?k=abc123 Dá uma olhada.";
    expect(perguntasReais(t)).toHaveLength(0);
  });

  it("3. item de menu NÃO conta aqui — tem fronteira própria", () => {
    const t = "O que acontece mais?\n1. chora ou grita;\n2. fica irritada;\n3. outra coisa.";
    expect(perguntasReais(t)).toHaveLength(1);
  });

  it("4. MORDE: pergunta real da Ayla conta", () => {
    const t = "Entendi. A vizinha ficou machucada? E ele está calmo agora?";
    expect(perguntasReais(t)).toHaveLength(2);
  });

  it("5. FIX-P17 tem UMA pergunta real, não duas — o `?` cru mentia", () => {
    // O contador ingênuo achava 3 (uma real + duas falas prontas). Este é
    // exatamente o motivo pelo qual a poda por `?` foi recusada.
    expect(perguntasReais(FIX_P17)).toHaveLength(1);
  });
});

describe("naturezaDoTurno — a proporção manda", () => {
  it("6. mensagem mínima, SEM assunto em pé, é turno simples", () => {
    expect(naturezaDoTurno("Sim conversa")).toBe("simples");
    expect(naturezaDoTurno("Oi boa tarde")).toBe("simples");
  });

  it("6b. MORDE: mensagem curta que CONTINUA um assunto não é cumprimento", () => {
    // O caso que derrubou a primeira versão do detector: "Já era segunda vez"
    // tem 18 caracteres e sustenta uma conversa inteira sobre conduta.
    expect(naturezaDoTurno("Já era segunda vez", true)).toBe("continuacao");
    expect(naturezaDoTurno("Sim conversa", true)).toBe("continuacao");
    expect(TETO.simples).toBeLessThan(TETO.continuacao);
    expect(TETO.continuacao).toBeLessThan(TETO.orientacao);
  });

  /**
   * PEND-FIDELIDADE — a inversão do Nível 3 (05/09/2026).
   *
   * ⚠️ O DEFEITO MEDIDO. "Pode me passar." tem 15 caracteres. Caía em
   * `continuacao` e recebia teto 500 — **o menor da progressão inteira**, bem
   * onde o §6 do documento da agência quer a resposta maior. Três das seis
   * execuções do passo a passo saíram acima (507, 507, 729).
   */
  it("MORDE: pedido explícito de entrega completa não cai no teto de continuação", () => {
    for (const m of [
      "Pode me passar.",
      "me passa o passo a passo",
      "manda a lista",
      "me manda o roteiro",
      "pode mandar o planejamento",
    ]) {
      expect(naturezaDoTurno(m, true), `"${m}" deveria comprar espaço`).toBe("entrega");
    }
    expect(TETO.entrega).toBeGreaterThan(TETO.continuacao);
    expect(TETO.entrega).toBeGreaterThan(TETO.orientacao);
  });

  /**
   * ⚠️ E O CONTRÁRIO PRECISA CONTINUAR VALENDO. O §59 do documento usa
   * "Me mostra." e responde em PROSA, ainda no Nível 2. MEDI: essa frase virou
   * lista numerada em 3 de 6 execuções. Transformá-la em `entrega` seria
   * institucionalizar o defeito em vez de corrigi-lo.
   */
  it("MORDE: 'me mostra' e 'me explica' NÃO são Nível 3", () => {
    for (const m of ["Me mostra.", "me explica", "me ensina", "Como?", "como faço?"]) {
      expect(naturezaDoTurno(m, true), `"${m}" não é entrega`).not.toBe("entrega");
    }
  });
  it("7. pedido com lei/laudo/documento compra teto maior", () => {
    expect(naturezaDoTurno("tem alguma lei que embasa a redução de carga horária?")).toBe("tecnico");
    expect(naturezaDoTurno("preciso mandar o laudo pra escola")).toBe("tecnico");
  });
  it("8. relato longo também compra teto maior", () => {
    expect(naturezaDoTurno(FIX_P10_MSG)).toBe("tecnico");
    expect(naturezaDoTurno(FIX_P1_MSG)).toBe("tecnico");
  });
  it("9. na dúvida, orientacao", () => {
    expect(naturezaDoTurno("ele não quer ir pra escola de manhã e eu não sei o que fazer")).toBe("orientacao");
  });
});

describe("ehMenuDeAlternativas", () => {
  it("10. três itens ou mais é menu, inline ou em linhas", () => {
    expect(ehMenuDeAlternativas(FIX_P7)).toBe(true);
    expect(ehMenuDeAlternativas("1. a;\n2. b;\n3. c")).toBe(true);
  });
  it("11. MORDE: escolha binária em prosa NÃO é menu", () => {
    expect(ehMenuDeAlternativas("Prefere começar pelo banho ou pelo jantar?")).toBe(false);
  });
  it("12. MORDE: dois itens não é menu", () => {
    expect(ehMenuDeAlternativas("Pode ser: 1. agora; 2. depois.")).toBe(false);
  });
});

// ============================================================
describe("FIXTURES PROBLEMÁTICAS — a fronteira precisa disparar", () => {
  it("FIX-P13 · quatro perguntas numa resposta só", () => {
    const r = formaAtravessada(FIX_P13, ctx(FIX_P13_MSG, true));
    expect(r?.fronteira.nome).toBe("forma_duas_perguntas");
    expect(r?.achados[0].detalhe).toMatch(/^3 perguntas|^4 perguntas/);
  });

  it("FIX-P7 · desabafo respondido com menu, antes de qualquer ajuda", () => {
    const r = formaAtravessada(FIX_P7, ctx(FIX_P7_MSG, false));
    expect(r?.fronteira.nome).toBe("forma_menu_antes_do_valor");
  });

  it("FIX-P7 · MORDE: o MESMO menu, DEPOIS de já ter ajudado, não é barrado por menu", () => {
    const r = formaAtravessada(FIX_P7, ctx(FIX_P7_MSG, true));
    expect(r?.fronteira.nome).not.toBe("forma_menu_antes_do_valor");
  });

  it("FIX-P17 · 620 chars para uma mensagem de 12 — desproporção", () => {
    const r = formaAtravessada(FIX_P17, ctx(FIX_P17_MSG, true));
    expect(r?.fronteira.nome).toBe("forma_tamanho");
    expect(r?.achados[0].detalhe).toMatch(/"continuacao"/);
  });

  it("FIX-P10 · 2.420 caracteres, mesmo num relato longo", () => {
    const r = formaAtravessada(FIX_P10, ctx(FIX_P10_MSG, true));
    expect(r?.fronteira.nome).toBe("forma_tamanho");
  });
});

// ============================================================
describe("NÃO-REGRESSÃO — o que já era bom continua passando", () => {
  it("FIX-P1 · 717 chars, zero perguntas, num relato longo: PASSA", () => {
    expect(formaAtravessada(FIX_P1, ctx(FIX_P1_MSG, true))).toBeNull();
  });

  it("FIX-P11 · situação delicada com fala pronta entre aspas: PASSA", () => {
    expect(formaAtravessada(FIX_P11, ctx(FIX_P11_MSG, true))).toBeNull();
  });

  it("FIX-P14 · personalização funcional TDAH+TEA: PASSA", () => {
    expect(formaAtravessada(FIX_P14, ctx(FIX_P14_MSG, true))).toBeNull();
  });

  it("FIX-P15 · idade altera a conduta e há UMA pergunta no fim: PASSA", () => {
    expect(formaAtravessada(FIX_P15, ctx(FIX_P15_MSG, true))).toBeNull();
  });

  it("MORDE: texto vazio nunca atravessa nada", () => {
    expect(formaAtravessada("", ctx("oi"))).toBeNull();
    expect(formaAtravessada("   ", ctx("oi"))).toBeNull();
  });
});

// ============================================================
describe("R7 · a natureza do turno reconhece relato pobre × relato rico", () => {
  it("R7-1 · 'Ele grita' é turno simples — resposta longa aqui é despejo", () => {
    expect(naturezaDoTurno(FIX_R7_1_MSG)).toBe("simples");
  });
  it("R7-2 · com um antecedente já vira orientacao", () => {
    expect(naturezaDoTurno(FIX_R7_2_MSG)).toBe("orientacao");
  });
  it("R7-3 · relato rico cabe em `orientacao` — 700 chars bastam para respondê-lo", () => {
    // ⚠️ ESTA EXPECTATIVA FOI CORRIGIDA, e o motivo fica escrito: eu havia
    // assumido que relato rico exigiria o teto de 1.200. Não exige — o relato
    // tem 358 caracteres e o que ele pede é uma orientação, não um parecer.
    // `tecnico` existe para o pedido que fica RUIM se for curto (lei, laudo,
    // documento), não para o relato bem contado. Errar aqui daria à Ayla
    // licença para responder 1.200 caracteres sempre que a mãe escrevesse bem —
    // exatamente o defeito que esta frente existe para corrigir.
    expect(naturezaDoTurno(FIX_R7_3_MSG)).toBe("orientacao");
  });
});

// ============================================================
describe("As instruções de refazer preservam o que a auditoria mediu como bom", () => {
  const instr = FRONTEIRAS_NOMES();
  function FRONTEIRAS_NOMES() {
    return {
      tamanho: formaAtravessada(FIX_P10, ctx(FIX_P10_MSG, true))!.fronteira.instrucao([
        { codigo: "longa_demais", detalhe: "2420 caracteres" },
      ]),
      perguntas: formaAtravessada(FIX_P13, ctx(FIX_P13_MSG, true))!.fronteira.instrucao([
        { codigo: "perguntas_demais", detalhe: "4 perguntas" },
      ]),
      menu: formaAtravessada(FIX_P7, ctx(FIX_P7_MSG, false))!.fronteira.instrucao([
        { codigo: "menu_antes_do_valor", detalhe: "" },
      ]),
    };
  }

  it("13. a de tamanho manda preservar segurança, personalização e fala pronta", () => {
    expect(instr.tamanho).toMatch(/segurança/i);
    expect(instr.tamanho).toMatch(/específico desta criança/i);
    expect(instr.tamanho).toMatch(/fala pronta/i);
    expect(instr.tamanho).not.toMatch(/corte o fim|trunque/i);
  });

  it("14. a de perguntas manda MANTER a orientação e cortar só as perguntas", () => {
    expect(instr.perguntas).toMatch(/mantendo TODO o conteúdo útil/);
    expect(instr.perguntas).toMatch(/encurte as perguntas/);
  });

  it("15. a de menu oferece ajudar OU perguntar — nunca só perguntar", () => {
    expect(instr.menu).toMatch(/entregue \*\*uma\*\* coisa aplicável hoje/);
    expect(instr.menu).toMatch(/uma\*\* pergunta/);
  });
});

// ============================================================
describe("MODO — o padrão é não fazer nada", () => {
  const ANTES = process.env.AYLA_FORMA_MODO;
  const set = (v?: string) => {
    if (v === undefined) delete process.env.AYLA_FORMA_MODO;
    else process.env.AYLA_FORMA_MODO = v;
  };

  it("16. sem a variável, o modo é off", () => {
    set(undefined);
    expect(modoForma()).toBe("off");
    set(ANTES);
  });

  it("17. só `sombra` e `ativo` valem; erro de digitação é off", () => {
    set("sombra");
    expect(modoForma()).toBe("sombra");
    set("ativo");
    expect(modoForma()).toBe("ativo");
    set("sim");
    expect(modoForma()).toBe("off");
    set("");
    expect(modoForma()).toBe("off");
    set(ANTES);
  });

  it("18. os tetos são os acordados na especificação", () => {
    expect(TETO.simples).toBe(350);
    expect(TETO.orientacao).toBe(700);
    expect(TETO.tecnico).toBe(1200);
  });
});

// ============================================================
// AS DUAS INVARIANTES ESTRUTURAIS
//
// Testam o TEXTO do caminho oficial, e não o comportamento — é o formato que
// o repositório já usa para prender decisão de arquitetura (§12). O que elas
// impedem: alguém mover a rede de forma para antes da rede de segurança, ou
// tirar a guarda do modo `off` e ligar a detecção para todo mundo sem querer.
// ============================================================
describe("INVARIANTES do caminho oficial", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const OFICIAL = fs.readFileSync(
    path.join(__dirname, "..", "ayla", "experimental.ts"),
    "utf8",
  );

  it("19. MORDE: a rede de SEGURANÇA continua vindo antes da rede de FORMA", () => {
    const iSeguranca = OFICIAL.indexOf("fronteiraAtravessada(texto");
    const iForma = OFICIAL.indexOf("formaAtravessada(texto");
    expect(iSeguranca).toBeGreaterThan(0);
    expect(iForma).toBeGreaterThan(0);
    expect(iSeguranca).toBeLessThan(iForma);
  });

  it("20. MORDE: a detecção fica atrás da guarda do modo — `off` não roda nada", () => {
    expect(OFICIAL).toMatch(/const modoDeForma = modoForma\(\);/);
    expect(OFICIAL).toMatch(/if \(modoDeForma !== "off"\) \{/);
    // E a chamada da rede de forma acontece DENTRO da guarda.
    const iGuarda = OFICIAL.indexOf('if (modoDeForma !== "off")');
    const iChamada = OFICIAL.indexOf("formaAtravessada(texto");
    expect(iGuarda).toBeLessThan(iChamada);
  });

  it("21. MORDE: em sombra o texto NÃO é reatribuído pela rede de forma", () => {
    // A rede de segurança faz `texto = segunda` / `texto = ...piso(...)`.
    // A de forma não pode ter nenhuma atribuição a `texto` no seu bloco.
    const inicio = OFICIAL.indexOf("// ── A REDE DE FORMA");
    const fim = OFICIAL.indexOf("await logarUsoApi(supabase", inicio);
    expect(inicio).toBeGreaterThan(0);
    expect(fim).toBeGreaterThan(inicio);
    const bloco = OFICIAL.slice(inicio, fim);
    expect(bloco).not.toMatch(/\btexto\s*=/);
  });

  it("22. MORDE: o disparo é PERSISTIDO — senão a taxa some com a retenção", () => {
    const inicio = OFICIAL.indexOf("// ── A REDE DE FORMA");
    const fim = OFICIAL.indexOf("await logarUsoApi(supabase", inicio);
    const bloco = OFICIAL.slice(inicio, fim);
    expect(bloco).toMatch(/kind: "ayla_forma_disparo"/);
    expect(bloco).toMatch(/persistir: true/);
  });
});
