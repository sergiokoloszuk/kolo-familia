import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { itensDoSystem } from "./__harness/system-array";
import {
  FORMATO_WHATSAPP,
  formasDeEntrega,
  pedeEntregaEstruturada,
  INTERESSE_COMO_VEICULO,
  A_CRIANCA_ANTES_DO_ROTULO,
  IDIOMA_DA_CONVERSA,
} from "@/lib/conducao/formas";

/**
 * PEND-145 — o caminho OFICIAL do WhatsApp mandava markdown que o canal não
 * renderiza.
 *
 * MEDI nas respostas reais desde o rollout de 17/08 (n=2.288 Legacy × 270
 * Oficial):
 *
 *   `**` cru ........ 0,8% → **65,2%**
 *   `##` / `###` .... 0,1% → **9,6%**
 *   citação `>` ..... 0,3% → **22,2%**
 *   lista numerada .. 1,5% → **35,9%**
 *   mediana .......... 376 → **812** chars
 *
 * E NÃO era falta de acolhimento — no recorte pareado das mesmas 12 famílias, o
 * Oficial valida emoção em 27,1% contra 11,3%, e acolhe antes de orientar em
 * 20,1% contra 10,2%. Por isso este teste guarda as duas coisas: que a regra de
 * formato chegou, e que nada do Core do Legacy veio junto.
 */

const EXPERIMENTAL = readFileSync(resolve(__dirname, "experimental.ts"), "utf8");
const RESPONDER = readFileSync(resolve(__dirname, "responder.ts"), "utf8");
const FORMAS = readFileSync(resolve(__dirname, "../conducao/formas.ts"), "utf8");
const PROMPT_WEB = readFileSync(resolve(__dirname, "../ia/prompt.ts"), "utf8");

/** Sem comentários — asserção estrutural testa código, não prosa. */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");


// ─────────────────────────────────────────────────────────────────────────────
describe("A · a regra de formato chegou ao caminho OFICIAL", () => {
  it("1. `experimental.ts` injeta FORMATO_WHATSAPP", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/FORMATO_WHATSAPP/);
    expect(src).toMatch(/from "@\/lib\/conducao\/formas"/);
  });

  it("2. e o formato entra POR ÚLTIMO no system — o Core demonstra markdown", () => {
    const itens = itensDoSystem(EXPERIMENTAL);
    expect(itens.at(-1)).toBe("formato");
    expect(itens[0]).toBe("core.conteudo");
  });

  it("3. a proibição cobre o que o canal NÃO converte", () => {
    // ⚠️ A REGRA MUDOU EM 05/09/2026, e este guarda mudou junto — mas não
    // afrouxou. O que era "sem markdown" virou uma lista do que o WhatsApp
    // realmente não renderiza. Títulos, citações e listas continuam proibidos
    // porque `paraWhatsApp` NÃO os converte para nada.
    expect(FORMATO_WHATSAPP).toContain("##");
    expect(FORMATO_WHATSAPP).toMatch(/sem títulos/i);
    expect(FORMATO_WHATSAPP).toMatch(/sem citações/i);
    expect(FORMATO_WHATSAPP).toMatch(/sem listas com - ou •/i);
  });

  it("3b. MORDE: negrito só é liberado porque o envio normaliza a marcação", () => {
    // ⚠️ ESTAS DUAS AFIRMAÇÕES ANDAM JUNTAS OU NENHUMA VALE. Liberar negrito no
    // prompt sem o conversor no funil devolve `**` cru à tela da família — que
    // é exatamente o defeito medido em 65,2% das respostas após o rollout de
    // 17/08. Se alguém remover `paraWhatsApp` de `enviarTexto`, este teste cai
    // e a regra do prompt precisa voltar atrás no mesmo commit.
    expect(FORMATO_WHATSAPP).toMatch(/NEGRITO é permitido/);
    const sender = readFileSync(
      resolve(process.cwd(), "src/lib/ayla/whatsappSender.ts"),
      "utf8",
    );
    expect(sender).toMatch(/message: paraWhatsApp\(params\.texto\)/);
  });

  /**
   * PEND-FIDELIDADE — o desabafo graduado (05/09/2026).
   *
   * ⚠️ O DEFEITO MEDIDO na bancada de fidelidade, 6 execucoes: **0 de 6**
   * ofereceram a escolha que o §46 do documento da agência pede, **6 de 6**
   * deram instrução de ação e **5 de 6** abriram rastreio de risco — para uma
   * mensagem ("não aguento mais… chorei escondida… exausta") que NÃO dispara
   * `RISCO_INEQUIVOCO`. A regra existe no Core §15, verbatim do §46, e perdeu
   * para o reflexo de segurança do próprio modelo. Regra que falha em prompt se
   * corrige por posição: esta linha é a última palavra do último bloco.
   *
   * ⚠️ E ELA NÃO AFROUXA NADA. O gate determinístico (`mensagemPedeSeguranca`
   * → `RISCO_INEQUIVOCO`) segue intocado, e a linha manda fazer a checagem
   * curta diante de sinal real. O que ela desfaz é tratar tristeza comum como
   * emergência.
   */
  it("3c. MORDE: o desabafo é graduado — acolhimento e escolha antes de rastreio", () => {
    expect(FORMATO_WHATSAPP).toMatch(/DESABAFO/);
    expect(FORMATO_WHATSAPP).toMatch(/não rastreio/);
    expect(FORMATO_WHATSAPP).toMatch(/sinal real/);
    expect(FORMATO_WHATSAPP).toMatch(/quer contar ou pensar no que fazer/);
    // A porta determinística de segurança continua de pé, e não é aqui.
    const seg = readFileSync(resolve(process.cwd(), "src/lib/ayla/estado-seguranca.ts"), "utf8");
    expect(seg).toMatch(/RISCO_INEQUIVOCO/);
    expect(seg).toMatch(/suic/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B · UMA regra de entrega, um dono", () => {
  it("4. o Legacy delega — não reimplementa", () => {
    const src = semComentarios(RESPONDER);
    expect(src).toMatch(/return pedeEntregaEstruturada\(/);
    // a regra antiga não pode ter ficado para trás
    expect(src).not.toMatch(/return Boolean\(params\.sinais\?\.desafio\)/);
  });

  it("5. e a constante mora num só lugar — o Legacy só reexporta", () => {
    expect(FORMAS).toMatch(/export const FORMATO_WHATSAPP = `# Formato \(WhatsApp\)/);
    const src = semComentarios(RESPONDER);
    expect(src).not.toMatch(/const FORMATO_WHATSAPP = `/);
    expect(src).toMatch(/export \{ FORMATO_WHATSAPP \}/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C · OS 12 CASOS — estrutura só quando é entrega de fato", () => {
  // A→J são conversacionais: prosa. K e L são entrega: estrutura permitida.
  const CASOS: Array<[string, string, boolean]> = [
    ["A · desabafo emocional", "desabafo", false],
    ["B · pergunta simples", "duvida", false],
    ["C · comunicação (desafio do dia a dia)", "desafio", true],
    ["D · sono (desafio)", "desafio", true],
    ["E · alimentação (desafio)", "desafio", true],
    ["F · escola (desafio)", "desafio", true],
    ["G · sensorial (desafio)", "desafio", true],
    ["H · pedido de brincadeira (desafio)", "desafio", true],
    ["I · mensagem curta 'não'", "outro", false],
    ["J · áudio transcrito — desabafo", "desabafo", false],
    ["K · crise", "crise", false],
    ["L · sem classificação", null as unknown as string, false],
  ];

  for (const [nome, intencao, esperado] of CASOS) {
    it(`6.${nome} → ${esperado ? "estrutura permitida" : "texto corrido"}`, () => {
      expect(pedeEntregaEstruturada({ intencao })).toBe(esperado);
    });
  }

  it("7. crise e desabafo NUNCA recebem formatação — título em cima de desabafo é frieza", () => {
    for (const i of ["crise", "desabafo", "duvida", "outro", null, undefined, ""]) {
      expect(pedeEntregaEstruturada({ intencao: i })).toBe(false);
    }
  });

  it("8. as três exclusões do Legacy continuam vencendo mesmo em `desafio`", () => {
    expect(pedeEntregaEstruturada({ intencao: "desafio", regenerando: true })).toBe(false);
    expect(pedeEntregaEstruturada({ intencao: "desafio", querPlano: true })).toBe(false);
    expect(pedeEntregaEstruturada({ intencao: "desafio", precisaEscolherMembro: true })).toBe(false);
    expect(pedeEntregaEstruturada({ intencao: "desafio" })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D · o canal decide a sintaxe do título", () => {
  it("9. no WhatsApp o título é UM asterisco; na web é `##`", () => {
    expect(formasDeEntrega({ canal: "whatsapp" })).toContain("*Assim*");
    expect(formasDeEntrega({ canal: "whatsapp" })).not.toContain("## Assim");
    expect(formasDeEntrega({ canal: "web" })).toContain("## Assim");
  });

  it("10. o Oficial pede a forma do WhatsApp, nunca a da web", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/formasDeEntrega\(\{ canal: "whatsapp"/);
    expect(src).not.toMatch(/canal: "web"/);
  });

  it("11. e só injeta a forma quando há entrega", () => {
    // ⚠️ A forma da condicional mudou de ternário para spread quando as duas
    // constantes irmãs entraram (o gate passou a carregar três itens, como o
    // Legacy sempre fez). O que este teste guarda é o GATE, não a sintaxe dele.
    const src = semComentarios(EXPERIMENTAL);
    const i = src.indexOf("...(entrega");
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, src.indexOf(": [])", i))).toContain("formasDeEntrega(");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("E · a WEB não foi tocada", () => {
  it("12. continua com a própria sintaxe e o próprio gate", () => {
    expect(PROMPT_WEB).toMatch(/formasDeEntrega\(\{ canal: "web", tema \}\)/);
    expect(PROMPT_WEB).toMatch(/intencao === "desafio"/);
    expect(PROMPT_WEB).not.toMatch(/FORMATO_WHATSAPP/);
  });

  it("13. e a regra compartilhada concorda com o literal que a web usa", () => {
    // Se um dia divergirem, este teste cai antes de a divergência chegar à tela.
    for (const i of ["crise", "desafio", "duvida", "desabafo", "outro"]) {
      expect(pedeEntregaEstruturada({ intencao: i })).toBe(i === "desafio");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("F · NADA do Core do Legacy veio junto", () => {
  it("14. `experimental.ts` não importa o núcleo nem o Core do código", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).not.toMatch(/nucleoConducao/);
    expect(src).not.toMatch(/conducao\/diretrizes/);
  });

  it("15. o Core do Oficial continua vindo do documento do banco", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/resolverDocumento\(supabase, "core"/);
    expect(src).toMatch(/core\.conteudo/);
  });

  it("16. o check-in continua FORA — ele é da PEND-081, não desta frente", () => {
    // ⚠️ ESTA ASSERÇÃO ENCOLHEU EM 24/08/2026, e o motivo é bom. Quando foi
    // escrita, a missão da PEND-145 proibia explicitamente mexer no comercial —
    // então `FATOS_COMERCIAIS` e `notaComercial` estavam na lista de proibidos.
    // A missão seguinte (PEND-115) AUTORIZOU exatamente isso, e eles entraram.
    // Manter a proibição seria um teste guardando uma decisão revogada.
    // O check-in continua fora, e esse é o que ainda vale.
    expect(semComentarios(EXPERIMENTAL)).not.toContain("ayla_daily_checkins");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G · custo — zero chamada nova", () => {
  it("17. o formato é prompt, não chamada: nenhum `await` novo foi introduzido", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("const entrega = pedeEntregaEstruturada"), src.indexOf("const { bloco,"));
    expect(bloco).not.toMatch(/await/);
    expect(bloco).not.toMatch(/gerarConversacional|messages\.stream|fetch\(/);
  });

  it("18. e o acréscimo de contexto é o esperado", () => {
    const conversa = FORMATO_WHATSAPP.length;
    const comEntrega = conversa + formasDeEntrega({ canal: "whatsapp", tema: "sono" }).length;
    // ~7k tokens é a mediana MEDIDA do Oficial; 3,5 chars/token em português.
    console.log(
      `\n  turno conversacional: +${conversa} chars ≈ +${Math.round(conversa / 3.5)} tokens` +
        `\n  turno de entrega:     +${comEntrega} chars ≈ +${Math.round(comEntrega / 3.5)} tokens` +
        `\n  sobre a mediana medida de 7.011 tokens: +${((100 * conversa) / 3.5 / 7011).toFixed(1)}% e +${((100 * comEntrega) / 3.5 / 7011).toFixed(1)}%\n`,
    );
    expect(conversa).toBeLessThan(3000);
    expect(comEntrega).toBeLessThan(6000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H · o BLOCO DE ENTREGA ficou completo (PEND-144, itens 5 e 6)", () => {
  // ⚠️ A PEND-145 portou UMA das três. O Legacy sempre injetou as três juntas,
  // sob o mesmo gate — e o Oficial ficou com o gate e um terço do conteúdo.
  const NO_GATE = ["formasDeEntrega(", "INTERESSE_COMO_VEICULO", "A_CRIANCA_ANTES_DO_ROTULO"];

  it("24. as três entram juntas no Oficial, sob o mesmo `entrega`", () => {
    const src = semComentarios(EXPERIMENTAL);
    const i = src.indexOf("...(entrega");
    expect(i).toBeGreaterThan(-1);
    const gate = src.slice(i, src.indexOf(": [])", i));
    for (const c of NO_GATE) expect(gate).toContain(c);
  });

  it("25. e é a MESMA unidade que o Legacy declara — nem mais, nem menos", () => {
    const itens = (fonte: string) => {
      const src = semComentarios(fonte);
      const i = src.indexOf("...(entrega");
      const gate = src.slice(i, src.indexOf(": [])", i));
      return NO_GATE.filter((c) => gate.includes(c));
    };
    expect(itens(EXPERIMENTAL)).toEqual(itens(RESPONDER));
    expect(itens(EXPERIMENTAL)).toHaveLength(3);
  });

  it("26. FORA do gate continua só o formato — turno conversacional não muda", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("const formato = ["), src.indexOf("...(entrega"));
    expect(bloco).toContain("FORMATO_WHATSAPP");
    expect(bloco).not.toContain("INTERESSE_COMO_VEICULO");
    expect(bloco).not.toContain("A_CRIANCA_ANTES_DO_ROTULO");
  });

  it("27. o interesse pode ser VEÍCULO, e a constante calibra o freio em vez de soltá-lo", () => {
    // Sem ela sobra só o freio do contexto ("não puxe um interesse guardado"),
    // que sozinho mata o mecanismo em vez de calibrá-lo. As três asserções são
    // as três frases que fazem essa calibragem, no texto real da constante.
    expect(INTERESSE_COMO_VEICULO).toMatch(/USE o interesse dele/);
    expect(INTERESSE_COMO_VEICULO).toMatch(/NÃO afrouxa o freio/);
    expect(INTERESSE_COMO_VEICULO).toMatch(/o interesse é o veículo de uma entrega que ela pediu/);
  });

  it("28. e a explicação nasce da criança, não do rótulo", () => {
    expect(A_CRIANCA_ANTES_DO_ROTULO).toMatch(/diagn[óo]stico|r[óo]tulo/i);
  });

  it("29. nenhuma chamada de modelo entrou junto", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("const formato = ["), src.indexOf("const { bloco,"));
    for (const p of ["await", "gerarConversacional", "messages.stream", "fetch(", "supabase"]) {
      expect(bloco).not.toContain(p);
    }
  });

  it("30. o Legacy não ganhou nada — segue com uma ocorrência de cada", () => {
    const src = semComentarios(RESPONDER);
    expect((src.match(/INTERESSE_COMO_VEICULO/g) ?? []).length).toBe(2); // import + uso
    expect((src.match(/A_CRIANCA_ANTES_DO_ROTULO/g) ?? []).length).toBe(2);
  });

  it("31. a WEB continua com o próprio bloco, intocada", () => {
    // A web injeta as mesmas duas, pelo gate dela, desde antes desta frente.
    expect(PROMPT_WEB).toMatch(/\$\{INTERESSE_COMO_VEICULO\}/);
    expect(PROMPT_WEB).toMatch(/\$\{A_CRIANCA_ANTES_DO_ROTULO\}/);
    expect(PROMPT_WEB).not.toMatch(/FORMATO_WHATSAPP/);
  });

  it("32. custo: o acréscimo cai SÓ no turno de entrega", () => {
    const conversa = FORMATO_WHATSAPP.length;
    const entregaChars =
      conversa +
      formasDeEntrega({ canal: "whatsapp", tema: "sono" }).length +
      INTERESSE_COMO_VEICULO.length +
      A_CRIANCA_ANTES_DO_ROTULO.length;
    const tok = (c: number) => Math.round(c / 3.5);
    console.log(
      `\n  conversacional: +${tok(conversa)} tokens (+${((100 * tok(conversa)) / 7011).toFixed(1)}%) — INALTERADO` +
        `\n  entrega:        +${tok(entregaChars)} tokens (+${((100 * tok(entregaChars)) / 7011).toFixed(1)}%)` +
        `\n  as duas novas:  +${tok(INTERESSE_COMO_VEICULO.length + A_CRIANCA_ANTES_DO_ROTULO.length)} tokens\n`,
    );
    // ⚠️ ESTE TETO SUBIU DE 1.500 PARA 2.600 EM 26/08/2026 (R4a), e o motivo
    // fica escrito porque o teste estava certo em existir.
    //
    // Ele nasceu para impedir que o bloco de ENTREGA (PEND-144, itens 5 e 6)
    // inflasse todo turno — e essa proteção continua valendo: as três peças de
    // entrega seguem fora do turno conversacional, e é o que o teste 29 prende.
    //
    // O que mudou foi outra decisão, e é deliberada: o gate que guardava a
    // entrega (`pedeEntregaEstruturada`) devolve false em 100% dos turnos do
    // Oficial, então TUDO que depende dele é inerte. A disciplina de tamanho
    // precisava entrar por onde de fato chega às famílias — `FORMATO_WHATSAPP`,
    // que é incondicional.
    //
    // O CUSTO, MEDIDO: 1.393 → 2.273 caracteres, ~+251 tokens, sobre um prompt
    // de 7.136 tokens (p50 medido em produção) = **+3,5%** de entrada. A troca é
    // por saída menor: `tokensSaida` p50 = 300, e respostas com p50 de 666
    // caracteres, 38,5% acima de 800.
    //
    // ⚠️ SEM REGRESSÃO DE CACHE: o prefixo cacheável do `system` já terminava no
    // primeiro elemento (`core.conteudo`), porque `bloco` — que varia a cada
    // turno — vem logo depois. Crescer o item 8 não move esse limite.
    expect(conversa).toBeLessThan(2600);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("I · IDIOMA — a regra mínima chegou ao OFICIAL (PEND-144, item 7)", () => {
  /**
   * ⚠️ O QUE ESTES TESTES PROVAM, E O QUE NÃO PROVAM.
   *
   * PROVAM: que a regra está montada, com o conteúdo aprovado, na posição certa,
   * sem depender do cadastro, sem chamada de modelo e sem tocar Web/Legacy.
   *
   * NÃO PROVAM que a Ayla responde em espanhol quando a pessoa escreve em
   * espanhol. Isso é comportamento de modelo e só se prova executando — foi o
   * que a investigação de 24/08 fez em teste controlado (Core v9 +
   * `gpt-5.6-luna`): sem regra, 3 de 4 respostas em espanhol saíram limpas e
   * **1 de 4 vazou para português**. A regra existe por causa dessa 1.
   */
  it("33. o Oficial injeta a regra, e ela é a NOVA — não a do Legacy", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).toMatch(/IDIOMA_DA_CONVERSA/);
    expect(src).not.toMatch(/DIRETRIZ_IDIOMA/);
  });

  it("34. e ela é o ÚLTIMO item do último bloco — 'leia por último' tem de ser verdade", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("const formato = ["), src.indexOf(".filter(Boolean)", src.indexOf("const formato = [")));
    const itens = bloco
      .split(",")
      .map((x) => x.trim())
      // o fecho do array vira um item vazio/`]` no split — não é um bloco
      .filter((x) => /[A-Za-z]/.test(x))
      // `instrucaoExtra` vale "" no turno normal — ver `__harness/system-array`
      .filter((x) => !x.startsWith("instrucaoExtra"));
    expect(itens.at(-1)).toContain("IDIOMA_DA_CONVERSA");
    // e `formato` continua sendo o último do `system`
    expect(itensDoSystem(EXPERIMENTAL).at(-1)).toBe("formato");
  });

  it("35. a regra é INCONDICIONAL — vale no desabafo e na entrega", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("const formato = ["), src.indexOf(".filter(Boolean)", src.indexOf("const formato = [")));
    const gate = bloco.slice(bloco.indexOf("...(entrega"), bloco.indexOf(": [])"));
    expect(gate).not.toContain("IDIOMA_DA_CONVERSA");
  });

  it("36. o texto é o aprovado — e diz PESSOA, nunca mãe", () => {
    expect(IDIOMA_DA_CONVERSA).toMatch(/ÚLTIMA mensagem da pessoa/);
    expect(IDIOMA_DA_CONVERSA).toMatch(/INTEIRA num único idioma/);
    expect(IDIOMA_DA_CONVERSA).toMatch(/nunca misture português com espanhol ou inglês/);
    expect(IDIOMA_DA_CONVERSA).toMatch(/ESCREVA na língua da pessoa/);
    expect(IDIOMA_DA_CONVERSA).toMatch(/curta ou ambígua/);
    // ⚠️ a Kolo não presume que quem escreve é a mãe
    expect(IDIOMA_DA_CONVERSA).not.toMatch(/\bmãe\b/i);
  });

  it("37. o idioma NÃO é decidido pelo cadastro — a coluna é de plataforma/proativa", () => {
    const src = semComentarios(EXPERIMENTAL);
    expect(src).not.toMatch(/family_accounts.*idioma|\bidioma\b\s*[=:]/);
    expect(src).not.toMatch(/idiomaPorTelefone|traduzirProativa/);
  });

  it("38. contexto em português NÃO obriga saída em português — está escrito", () => {
    expect(IDIOMA_DA_CONVERSA).toMatch(/podem vir em português: leia normalmente/);
  });

  it("39. nomes próprios não são traduzidos", () => {
    expect(IDIOMA_DA_CONVERSA).toMatch(/nomes próprios ficam como são/);
  });

  it("40. NÃO copiamos a diretiva antiga — é 81% menor, e mede-se", () => {
    const antiga = readFileSync(resolve(__dirname, "responder.ts"), "utf8");
    const i = antiga.indexOf("export const DIRETRIZ_IDIOMA = `");
    const velha = antiga.slice(i + "export const DIRETRIZ_IDIOMA = `".length, antiga.indexOf("`;", i));
    const tok = (s: string) => Math.round(s.length / 3.5);
    console.log(
      `\n  DIRETRIZ_IDIOMA (Legacy) : ${velha.length} chars ≈ ${tok(velha)} tokens (+${((100 * tok(velha)) / 7011).toFixed(1)}%)` +
        `\n  IDIOMA_DA_CONVERSA       : ${IDIOMA_DA_CONVERSA.length} chars ≈ ${tok(IDIOMA_DA_CONVERSA)} tokens (+${((100 * tok(IDIOMA_DA_CONVERSA)) / 7011).toFixed(1)}%)` +
        `\n  redução                  : ${(100 - (100 * IDIOMA_DA_CONVERSA.length) / velha.length).toFixed(0)}%\n`,
    );
    expect(IDIOMA_DA_CONVERSA.length).toBeLessThan(velha.length * 0.3);
    // e não é um recorte da antiga: nenhuma das regras de gramática veio junto
    for (const descartado of ["enclítico", "darte", "lusismo", "falsos amigos", "tú", "latinoamericano"]) {
      expect(IDIOMA_DA_CONVERSA.toLowerCase()).not.toContain(descartado.toLowerCase());
    }
  });

  it("41. zero chamada de modelo e zero detector de idioma", () => {
    const src = semComentarios(EXPERIMENTAL);
    const bloco = src.slice(src.indexOf("const formato = ["), src.indexOf("const { bloco,"));
    for (const p of ["await", "gerarConversacional", "fetch(", "supabase", "detect", "franc", "langdetect"]) {
      expect(bloco).not.toContain(p);
    }
  });

  it("42. Web, proativas e Legacy intocados", () => {
    // a web tem o próprio tratamento; as proativas continuam com traduzirProativa
    expect(PROMPT_WEB).not.toMatch(/IDIOMA_DA_CONVERSA/);
    const legacy = semComentarios(readFileSync(resolve(__dirname, "responder.ts"), "utf8"));
    expect(legacy).not.toMatch(/IDIOMA_DA_CONVERSA/);
    expect(legacy).toMatch(/DIRETRIZ_IDIOMA,/); // o Legacy segue como está
  });
});
