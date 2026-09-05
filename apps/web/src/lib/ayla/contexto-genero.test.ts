import { describe, it, expect } from "vitest";
import { montarContextoBase } from "./experimental-contexto";

/**
 * O GÊNERO REGISTRADO CHEGA AO MODELO — A-1, 17/08/2026.
 *
 * ═══ A LACUNA ═══
 *
 * `membros_atipicos.genero` era o ÚNICO dos cinco dados essenciais que o
 * sistema tinha e não entregava. A coluna já vinha no `select` e já era usada
 * por `resolverFoco` — é ela que faz "minha filha" apontar para a criança
 * certa —, mas nenhuma linha do bloco de contexto a mencionava.
 *
 * Consequência: quando a Ayla escrevia "ele" ou "ela", estava adivinhando.
 * Normalmente pelo nome, que é o mesmo palpite removido das proativas no
 * mesmo dia (`endsWith("a") ? "a" : "o"` — todo Nicolas virava menina).
 *
 * ═══ A REGRA ═══
 *
 * Gênero REGISTRADO chega. Ausente, neutro ou estranho NÃO vira palpite, e
 * também não vira lacuna: não se pergunta o gênero de uma criança só para
 * escrever bonito. Quem responde "isto é dado ou não?" é `pronomesPara`, a
 * fonte única do projeto, pelo campo `generoDefinido`.
 */

const MEMBRO = {
  nome: "Manuela",
  data_nascimento: "2020-01-10",
  diagnosticos_formais: null,
};

/**
 * ⚠️ `como_e` é TOP-LEVEL, não vai dentro de `categorias_extras` — foi assim
 * que este teste pegou a própria fixture errada na primeira execução.
 */
const PERFIL = {
  como_e: { interesses: ["dinossauros", "princesas"] },
  categorias_extras: {
    sono: { texto: "Demora a pegar no sono nas noites de escola", atualizado_em: "2026-08-10" },
    comunicacao: { texto: "Fala por palavras soltas", atualizado_em: "2026-08-09" },
  },
};

const montar = (genero?: string | null) =>
  montarContextoBase({
    nomeResponsavel: "Karina",
    membro: { ...MEMBRO, genero },
    perfilVivo: PERFIL as never,
  });

describe("gênero registrado chega ao contexto", () => {
  it("1. feminino vira concordância utilizável", () => {
    const { bloco } = montar("feminino");
    expect(bloco).toContain("ela/dela");
  });

  it("2. masculino idem", () => {
    const { bloco } = montar("masculino");
    expect(bloco).toContain("ele/dele");
  });
});

describe("ausência NÃO vira palpite", () => {
  for (const g of [null, undefined, "", "neutro", "nao_informado", "outro"]) {
    it(`3. ${JSON.stringify(g)} não produz ele/dele nem ela/dela`, () => {
      const { bloco } = montar(g);
      expect(bloco, "inferiu gênero a partir de dado ausente/ambíguo").not.toMatch(
        /\bele\/dele\b|\bela\/dela\b/,
      );
    });
  }

  it("4. MORDE: o nome NÃO decide o gênero", () => {
    // "Manuela" termina em "a" — o palpite antigo diria feminino.
    const { bloco } = montar(null);
    expect(bloco).toContain("Manuela");
    expect(bloco).not.toContain("ela/dela");
  });

  it("5. gênero ausente NÃO entra como lacuna — não se pergunta por isso", () => {
    const { lacunas } = montar(null);
    expect(lacunas.join(" ").toLowerCase()).not.toContain("gênero");
    expect(lacunas.join(" ").toLowerCase()).not.toContain("genero");
  });
});

describe("nada do contexto se perde", () => {
  /**
   * Tudo que o bloco entregava ANTES desta mudança.
   *
   * ⚠️ A COMUNICAÇÃO PASSOU A SER CONFERIDA PELO CONTEÚDO, NÃO PELO RÓTULO
   * (05/09/2026, PEND-164). Ela agora sai UMA vez, na linha de topo
   * ("Comunicação hoje: …"), e não mais duplicada como domínio — o texto vinha
   * da mesma fonte nos dois lugares e ocupava o teto duas vezes.
   *
   * O rótulo minúsculo "comunicação" era o do domínio removido; conferi-lo
   * testaria a duplicata, não a informação. O que este teste promete no nome é
   * que **nada se perde** — então ele passa a exigir o texto em si, que é o que
   * chega ao modelo e o que a família tem a ganhar.
   */
  const ESSENCIAIS = [
    "Responsável: Karina",
    "Criança: Manuela, 6 anos",
    "dinossauros",
    "sono:",
    "Fala por palavras soltas",
  ];

  it("6. com gênero, o bloco continua trazendo todo o resto", () => {
    const { bloco } = montar("feminino");
    for (const t of ESSENCIAIS) {
      expect(bloco, `sumiu do contexto: ${t}`).toContain(t);
    }
  });

  it("7. sem gênero, idem — a linha some, o resto fica", () => {
    const { bloco } = montar(null);
    for (const t of ESSENCIAIS) {
      expect(bloco, `sumiu do contexto: ${t}`).toContain(t);
    }
  });

  /**
   * PEND-164 — a comunicação entra UMA vez, e é a cópia que o teto não alcança.
   *
   * ⚠️ MORDE OS DOIS LADOS. Se a duplicata voltar, o texto aparece duas vezes e
   * o teto de 1200 passa a gastar o dobro com o mesmo conteúdo. Se a linha de
   * topo for removida em favor do domínio, a comunicação volta a ser podável —
   * foi exatamente o erro que cometi na primeira tentativa desta correção: o
   * domínio era removido pelo teto e a informação sumia inteira.
   */
  it("8. MORDE: a comunicação aparece uma vez só, e na linha que o teto não poda", () => {
    const { bloco } = montar("feminino");
    const ocorrencias = bloco.split("Fala por palavras soltas").length - 1;
    expect(ocorrencias, "comunicação duplicada no bloco").toBe(1);
    expect(bloco).toContain("Comunicação hoje: Fala por palavras soltas");
    expect(bloco).not.toContain("- comunicação:");
    // A linha de topo vem ANTES da seção de desafios, que é de onde o teto poda.
    expect(bloco.indexOf("Comunicação hoje:")).toBeLessThan(bloco.indexOf("Desafios atuais:"));
  });

  /**
   * PEND-164 — o corte deixou de ser posicional.
   *
   * ⚠️ O CASO MARIO (05/09/2026). `primeiraFrase` cortava no primeiro ponto
   * final: 508 caracteres no banco viravam 117, e "Antecipa falha … crença
   * limitante" — o que reenquadraria o caso — nunca chegava ao modelo. Na Manu
   * a MESMA função entregava o dado decisivo, porque lá ele era a primeira
   * frase. Ordem de digitação decidindo o que o modelo sabe.
   */
  it("9. MORDE: o que está na terceira frase chega tanto quanto o que está na primeira", () => {
    // ⚠️ O TEXTO É O DO PERFIL REAL DO MARIO, com o comprimento real (508 ch).
    // Um fixture curto passaria sem provar nada: o defeito só aparece quando o
    // campo é maior que o corte.
    const COMUNICACAO_REAL =
      "Outras observações: Conversa bem, estamos treinando ter autonomia e ligar para " +
      "resolver coisas, agendar cabeleireiro.\n" +
      "Apresenta resistência em aprender habilidades sociais (falar com atendentes, " +
      "pedir informações).\n" +
      "Antecipa falha em interações com estranhos (porteiro, jardineiro, merendeira) e " +
      "não tenta; crença limitante de que vai dar errado antes de tentar; precisa de " +
      "exposição graduada com apoio.";
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Karina",
      membro: {
        nome: "Mario",
        data_nascimento: "2008-08-05",
        diagnosticos_formais: [],
        genero: "masculino",
      },
      perfilVivo: {
        categorias_extras: {
          comunicacao: { texto: COMUNICACAO_REAL, atualizado_em: "2026-09-05" },
        },
      } as never,
      skills: ["socializacao"],
    });
    // A primeira frase continua chegando — nada foi trocado, só acrescentado.
    expect(bloco).toContain("Conversa bem");
    // E o que ANTES morria no corte da primeira frase agora chega:
    expect(bloco, "o fato da 2ª frase sumiu — o defeito voltou").toContain(
      "resistência em aprender habilidades sociais",
    );
    expect(bloco, "o fato da 3ª frase sumiu — o defeito voltou").toContain("Antecipa falha");
    // ⚠️ A FRONTEIRA, DECLARADA. `TETO_DOMINIO_PERTINENTE = 320` corta por
    // TAMANHO, então a última palavra que couber entra truncada — no perfil
    // real do Mario a linha termina em "…crença limita…". O sentido chega; a
    // palavra inteira exigiria 360. NÃO subi a constante: ela é COMPARTILHADA
    // com `desafiosAtuais`, e alargá-la aqui alarga todos os domínios e
    // recomeça a competição pelo teto do bloco. Fica declarado para que a
    // escolha seja consciente, e não um número esquecido.
    //
    // O que se afirma aqui não é onde o corte cai — isso depende do texto —, e
    // sim que ele deixou de cair na PRIMEIRA FRASE. Antes: 117 caracteres.
    const linha = bloco.split("\n").find((l) => l.startsWith("Comunicação hoje:")) ?? "";
    expect(linha.length, "voltou a cortar na primeira frase").toBeGreaterThan(300);
    expect(linha).toContain("crença li");
  });

  it("8. a única diferença entre os dois casos é a linha do gênero", () => {
    const com = montar("feminino").bloco.split("\n");
    const sem = montar(null).bloco.split("\n");
    const extras = com.filter((l) => !sem.includes(l));
    expect(extras.length, `mudou mais de uma linha: ${JSON.stringify(extras)}`).toBe(1);
    expect(extras[0]).toContain("ela/dela");
  });

  it("9. sem perfil vivo nenhum, continua funcionando", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: null,
      membro: { ...MEMBRO, genero: "masculino" },
      perfilVivo: null,
    });
    expect(bloco).toContain("Criança: Manuela");
    expect(bloco).toContain("ele/dele");
  });
});
