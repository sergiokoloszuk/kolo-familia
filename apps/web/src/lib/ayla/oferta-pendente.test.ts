import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BancoMemoria, novoId } from "./__harness/banco-memoria";
import { ofertaDePlanoPendente, ehAfirmacaoCurta } from "./orchestrator";

/**
 * OFERTA PENDENTE × OFERTA CUMPRIDA — 13/08/2026.
 *
 * ⚠️ O CASO MATHEO (11/08/2026, produção). A Rosangela recebeu o Plano às
 * 13:21:59, agradeceu, e escreveu "Ok" às 13:25:07. Ganhou outro Plano. Depois
 * mais dois. Seis Planos sobre a mesma criança em dois dias, quatro deles em
 * nove minutos.
 *
 * A causa: a pergunta era "alguma das últimas 6 mensagens PARECE uma oferta de
 * plano?" — e o texto FIXO da entrega ("Montei um plano estratégico com
 * atividades") parece. A entrega se reoferecia sozinha, e cada "Ok" educado da
 * mãe aceitava uma oferta que ninguém tinha feito.
 *
 * ⚠️ POR QUE NÃO FOI RESOLVIDO POR TIMESTAMP contra a tabela `planos`. MEDIDO
 * em produção sobre 97 Planos: a linha em `planos` nasce dentro de `gerarPlano`
 * e a mensagem que a anuncia só é persistida no fim do turno — a mensagem vem
 * 0-8 s DEPOIS (mediana 3 s), zero exceções. "Existe Plano criado depois da
 * última oferta?" responderia NÃO até para a entrega que acabou de sair.
 *
 * O que separa os dois estados é a ÂNCORA: `metadata.plano_id`, gravada só
 * quando o envio deu certo. Oferta se reconhece por texto; entrega, por fato.
 *
 * ⚠️ ESTES TESTES EXERCITAM A FUNÇÃO, não o arquivo. O único `readFileSync`
 * aqui é o da sabotagem — e ele serve para provar que a distinção estrutural
 * ainda está escrita, não para substituir a execução.
 */

const FAM = novoId("familia");
const MATHEO = novoId("membro");
const IRMA = novoId("membro");

let db: BancoMemoria;

/** Minutos atrás, em ISO — a janela da oferta é de 30 min. */
const min = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
/** Segundos atrás — para reproduzir intervalos reais de conversa. */
const seg = (n: number) => new Date(Date.now() - n * 1000).toISOString();

/** Uma fala da Ayla que OFERECE (casa a regex, sem âncora). */
const oferta = (created_at: string, membro: string | null = MATHEO) => ({
  family_account_id: FAM,
  membro_atipico_id: membro,
  direcao: "outbound",
  texto: "Boa 💛 Vou montar um plano pra isso. Antes, me conta: como está esse desafio hoje?",
  metadata: null,
  created_at,
});

/**
 * Uma fala da Ayla que ENTREGA. O texto é o de produção — e ele casa a regex
 * de oferta por dois caminhos ("Montei um plano" e "plano estratégico"). É
 * exatamente por isso que o cenário vale: só a âncora o distingue.
 */
const entrega = (created_at: string, membro: string | null = MATHEO) => ({
  family_account_id: FAM,
  membro_atipico_id: membro,
  direcao: "outbound",
  texto:
    "Montei um plano estratégico com atividades sobre isso — mandei em PDF aqui em cima 👆 (dá pra salvar e imprimir).",
  metadata: { plano_id: novoId("plano") },
  created_at,
});

/** Conversa comum: nem oferece nem entrega. */
const conversa = (created_at: string, membro: string | null = MATHEO) => ({
  family_account_id: FAM,
  membro_atipico_id: membro,
  direcao: "outbound",
  texto: "Combinado, Rosangela. Leia no seu ritmo e me conta o que achou.",
  metadata: null,
  created_at,
});

/** O gatilho como a PRODUÇÃO o compõe (ver `decidirSobrePlano` no orquestrador). */
const aceitaAgora = async (mensagem: string, membro: string | null = MATHEO) =>
  ehAfirmacaoCurta(mensagem) &&
  (await ofertaDePlanoPendente(db.cliente(), FAM, membro));

beforeEach(() => {
  db = new BancoMemoria();
});

describe("os dois estados da oferta", () => {
  it("A. oferta → 'Ok' → GERA (a oferta está pendente)", async () => {
    db.semear("ayla_messages", [oferta(min(3))]);
    expect(await aceitaAgora("Ok")).toBe(true);
  });

  it("B. oferta → entrega → 'Ok' → NÃO gera (a entrega cumpriu a oferta)", async () => {
    db.semear("ayla_messages", [oferta(min(6)), entrega(min(4))]);
    expect(await aceitaAgora("Ok")).toBe(false);
  });

  it("C. oferta → entrega → 'Obrigada' → NÃO gera", async () => {
    db.semear("ayla_messages", [oferta(min(6)), entrega(min(4))]);
    expect(await aceitaAgora("Obrigada")).toBe(false);
    // …e o gatilho morre nos DOIS portões, não só num deles.
    expect(ehAfirmacaoCurta("Obrigada"), "'Obrigada' virou afirmação curta").toBe(false);
    expect(await ofertaDePlanoPendente(db.cliente(), FAM, MATHEO)).toBe(false);
  });

  it("D. oferta → entrega → 'Ok vou ler' → NÃO gera", async () => {
    // A frase REAL da Rosangela, 13:26:32. Ela não é afirmação curta — mas
    // antes disto o "Ok" seco dois minutos depois já tinha gerado o duplicado.
    db.semear("ayla_messages", [oferta(min(6)), entrega(min(4))]);
    expect(await aceitaAgora("Ok vou ler")).toBe(false);
    expect(ehAfirmacaoCurta("Ok vou ler")).toBe(false);
  });

  it("E. entrega → NOVA oferta → 'Ok' → GERA (a oferta nova vale por si)", async () => {
    // O caso legítimo que quase toda correção deste tipo suprime junto: a mãe
    // recebeu um Plano, a conversa seguiu, a Ayla ofereceu OUTRO, ela aceitou.
    db.semear("ayla_messages", [
      oferta(min(20)),
      entrega(min(18)),
      conversa(min(10)),
      oferta(min(4)),
    ]);
    expect(await aceitaAgora("Ok")).toBe(true);
  });

  it("sem oferta nenhuma na janela → NÃO gera", async () => {
    db.semear("ayla_messages", [conversa(min(5))]);
    expect(await aceitaAgora("Ok")).toBe(false);
  });

  it("a oferta expira: fora dos 30 min ela não é mais aceitável", async () => {
    db.semear("ayla_messages", [oferta(min(45))]);
    expect(await aceitaAgora("Ok")).toBe(false);
  });

  it("entrega que FALHOU no envio não fecha a oferta (sem âncora, sem fato)", async () => {
    // `metadata.plano_id` só é gravado depois de o envio dar certo. Se o Plano
    // nasceu e a mensagem não saiu, a mãe não recebeu nada — e o "Ok" dela tem
    // que continuar valendo.
    db.semear("ayla_messages", [
      oferta(min(6)),
      { ...entrega(min(4)), metadata: { entrega: { canal: "z-api" } } },
    ]);
    expect(await aceitaAgora("Ok")).toBe(true);
  });
});

describe("escopo: por criança quando dá, por família quando não dá", () => {
  it("F. a entrega de A NÃO cumpre a oferta de B", async () => {
    // A oferta é da irmã; a entrega, do Matheo, e vem DEPOIS. Por família, o
    // "Ok" da mãe sobre a irmã morreria sem nada — este é o falso bloqueio que
    // o escopo por criança evita.
    db.semear("ayla_messages", [oferta(min(6), IRMA), entrega(min(3), MATHEO)]);
    expect(await aceitaAgora("Ok", IRMA), "a entrega do irmão fechou a oferta dela").toBe(true);
  });

  it("F2. e a entrega de A CONTINUA cumprindo a oferta de A", async () => {
    db.semear("ayla_messages", [oferta(min(6), MATHEO), entrega(min(3), MATHEO)]);
    expect(await aceitaAgora("Ok", MATHEO)).toBe(false);
  });

  it("F3. a oferta do irmão não vira oferta minha", async () => {
    db.semear("ayla_messages", [oferta(min(4), IRMA)]);
    expect(await aceitaAgora("Ok", MATHEO), "aceitei uma oferta feita sobre o irmão").toBe(false);
  });

  it("G. membro NULL no turno → escopo de família, e enxerga tudo", async () => {
    db.semear("ayla_messages", [oferta(min(4), IRMA)]);
    expect(await aceitaAgora("Ok", null)).toBe(true);
  });

  it("G2. mensagem SEM dono entra no escopo da criança (o padrão do repositório)", async () => {
    // Em produção há 6 Planos e 2 ofertas com `membro_atipico_id` nulo. Se elas
    // saíssem da janela, o "sim" da mãe não geraria nada — e o mesmo recorte
    // "deste membro OU sem membro" já é o de `carregarEstrategiasRecentes`.
    db.semear("ayla_messages", [oferta(min(4), null)]);
    expect(await aceitaAgora("Ok", MATHEO)).toBe(true);

    db.semear("ayla_messages", [entrega(min(2), null)]);
    expect(await aceitaAgora("Ok", MATHEO), "a entrega sem dono não fechou a oferta").toBe(false);
  });
});

describe("o caso Matheo, com a timeline real de 11/08/2026", () => {
  /**
   * As mensagens de saída da janela 13:16→13:26, com os intervalos REAIS,
   * ancorados no "Ok" das 13:25:07 (que é "agora").
   *
   * ⚠️ NÃO use as datas absolutas de 11/08 aqui. A janela da oferta é de 30 min
   * contados de `Date.now()`; datas fixas do passado caem fora dela e estes
   * três testes passam A VAZIO — foi assim que eles nasceram, e só a sabotagem
   * mostrou (ela derrubou 5 testes e não derrubou estes).
   */
  const timelineReal = () => {
    db.semear("ayla_messages", [
      conversa(seg(8 * 60 + 26)), // 13:16:41
      // 13:21:57 nasce a linha em `planos`; 13:21:59 sai a mensagem que a anuncia.
      entrega(seg(3 * 60 + 8)), // 13:21:59
      conversa(seg(77)), // 13:23:50
    ]);
  };

  it("H. o 'Ok' das 13:25:07 NÃO gera Plano nenhum", async () => {
    timelineReal();
    expect(await aceitaAgora("Ok"), "o duplicado do Matheo voltou").toBe(false);
  });

  it("H2. e os dois 'Ok' seguintes também não", async () => {
    timelineReal();
    expect(await aceitaAgora("Ok")).toBe(false);
    expect(await aceitaAgora("Ok")).toBe(false);
    expect(await aceitaAgora("Ok vou ler")).toBe(false);
  });

  it("H3. na janela real não havia oferta verdadeira alguma", async () => {
    // Todas as mensagens ★ daquela conversa eram ENTREGAS. O gatilho antigo via
    // quatro ofertas onde não houve nenhuma.
    timelineReal();
    expect(await ofertaDePlanoPendente(db.cliente(), FAM, MATHEO)).toBe(false);
  });
});

describe("SABOTAGEM — sem a distinção estrutural, o duplicado volta", () => {
  it("a regra ANTIGA (só texto) gera o segundo Plano do Matheo na mesma fixture", async () => {
    // A regra de antes, escrita aqui e rodada contra a MESMA timeline real:
    // "alguma das últimas mensagens casa a regex?". Se ela devolver `false`, a
    // fixture não reproduz o bug e nenhum teste acima prova coisa alguma.
    const REGEX_OFERTA_PLANO =
      /monte(i)? um plano|montar (um |esse |o )?plano|junte.*plano|plano (completo|estrat[ée]gico)|um plano (completo|estrat[ée]gico|com|pra|sobre)/;
    const regraAntiga = async () => {
      const { data } = await db
        .from("ayla_messages")
        .select("texto")
        .eq("family_account_id", FAM)
        .eq("direcao", "outbound")
        .order("created_at", { ascending: false })
        .limit(6);
      return ((data ?? []) as Array<{ texto: string | null }>).some((m) =>
        REGEX_OFERTA_PLANO.test((m.texto ?? "").toLowerCase()),
      );
    };

    db.semear("ayla_messages", [
      conversa(seg(8 * 60 + 26)),
      entrega(seg(3 * 60 + 8)),
      conversa(seg(77)),
    ]);

    expect(await regraAntiga(), "a fixture não reproduz o bug — o resto não prova nada").toBe(true);
    expect(await ofertaDePlanoPendente(db.cliente(), FAM, MATHEO), "a correção não morde").toBe(false);
  });

  it("a âncora é consultada ANTES do texto — inverter a ordem devolve o bug", () => {
    // A ordem é o coração da correção: a mensagem de entrega casa a regex, e se
    // o texto for perguntado primeiro ela volta a se reoferecer sozinha.
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    const corpo = ORCH.slice(ORCH.indexOf("export async function ofertaDePlanoPendente"));
    const posAncora = corpo.indexOf("if (ehEntregaDePlano(m)) return false;");
    const posTexto = corpo.indexOf("if (REGEX_OFERTA_PLANO.test(");
    expect(posAncora, "a checagem da âncora sumiu").toBeGreaterThan(-1);
    expect(posTexto, "a checagem do texto sumiu").toBeGreaterThan(-1);
    expect(posAncora, "o texto passou a ser consultado antes da âncora").toBeLessThan(posTexto);
  });

  it("a decisão não consulta `planos` — uma fonte só para o estado da oferta", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    const corpo = ORCH.slice(
      ORCH.indexOf("export async function ofertaDePlanoPendente"),
    ).slice(0, 2000);
    expect(corpo).not.toMatch(/from\("planos"\)/);
  });
});
