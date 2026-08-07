import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classificarFeedbackRotina,
  falaDoQuadro,
  instrucaoDeAjuste,
} from "./rotina-feedback";

/**
 * O QUE A FAMÍLIA CONTA DEPOIS.
 *
 * A rotina virava artefato e acabava ali: a mãe dizia "guardar o controle ele
 * já faz sozinho" e a criança seguia com um cartão de uma etapa que já
 * dominava — o oposto do objetivo do recurso.
 *
 * O risco de corrigir isso é maior que o de deixar quieto, e é por isso que
 * metade destes testes é sobre NÃO agir: "não funcionou" é das frases mais
 * ambíguas do produto, e tirar cartão por palavra-chave solta custa à família
 * o quadro que ela montou.
 */

const GUIADA = readFileSync(resolve(__dirname, "rotina-guiada.ts"), "utf8");
const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

const ETAPAS = ["aviso", "salvar", "guardar controle", "banho", "jantar"];

describe("A. já consegue → simplifica", () => {
  it.each([
    "Guardar o controle e ir ao banheiro ele já faz sozinho.",
    "Essas duas etapas ela já consegue.",
    "Ficou fácil pra ele agora.",
    "Isso ele já faz sem eu falar nada.",
  ])("lê %s como avanço", (t) => {
    const f = classificarFeedbackRotina(t);
    expect(f?.resultado).toBe("funcionou");
    expect(f?.acao).toBe("simplificar");
  });

  it("a instrução tira etapa, e proíbe acrescentar", () => {
    const i = instrucaoDeAjuste({ resultado: "funcionou", acao: "simplificar" });
    expect(i).toMatch(/TIRE do quadro as etapas que ela nomeou/);
    expect(i).toMatch(/junte duas numa só/);
    expect(i).toMatch(/NÃO acrescente etapa nova/);
    expect(i).toMatch(/Menos cartão aqui é o objetivo do recurso/);
  });
});

describe("B. não funcionou → pergunta onde, e só depois mexe", () => {
  it("sem indicação de onde travou, INVESTIGA — não edita", () => {
    const f = classificarFeedbackRotina("Não funcionou.");
    expect(f?.resultado).toBe("nao_funcionou");
    expect(f?.acao).toBe("investigar");
  });

  it.each(["Não adiantou nada.", "Ele ignorou os cards.", "Continuou brigando do mesmo jeito."])(
    "%s também é não funcionou",
    (t) => {
      expect(classificarFeedbackRotina(t)?.resultado).toBe("nao_funcionou");
    },
  );

  it("com o ponto citado, ajusta SÓ o trecho", () => {
    const f = classificarFeedbackRotina("Não funcionou na hora de guardar o controle.");
    expect(f?.acao).toBe("ajustar_trecho");
  });

  it("a investigação não repete a orientação e faz UMA pergunta com opções", () => {
    const i = instrucaoDeAjuste({ resultado: "nao_funcionou", acao: "investigar" });
    expect(i).toMatch(/Não mexa no quadro neste turno/);
    expect(i).toMatch(/não repita a mesma orientação com outras palavras/);
    expect(i).toMatch(/UMA pergunta discriminativa/);
    expect(i).toMatch(/opções vindas das etapas que existem/);
  });

  it("'não funcionou' NUNCA é lido como 'funcionou'", () => {
    // A positiva está contida na negativa; a ordem dos testes no módulo é o
    // que impede a leitura invertida.
    expect(classificarFeedbackRotina("não funcionou")?.resultado).toBe("nao_funcionou");
    expect(classificarFeedbackRotina("não deu certo")?.resultado).toBe("nao_funcionou");
  });
});

describe("C. parcial → preserva o que funcionou", () => {
  it("'funcionou até o banho, mas depois não quis jantar'", () => {
    const f = classificarFeedbackRotina("Funcionou até o banho, mas depois ele não quis jantar.");
    expect(f?.resultado).toBe("parcial");
    expect(f?.acao).toBe("ajustar_trecho");
  });

  it("a instrução é explícita sobre não destruir o acerto", () => {
    const i = instrucaoDeAjuste({ resultado: "parcial", acao: "ajustar_trecho" });
    expect(i).toMatch(/NÃO DESTRUA O QUE DEU CERTO/);
    expect(i).toMatch(/ficam EXATAMENTE como estão — mesmo texto, mesma ordem/);
    expect(i).toMatch(/NÃO acrescente cartão em outro lugar/);
  });

  it("funcionou inteiro não vira edição nenhuma", () => {
    const f = classificarFeedbackRotina("Funcionou! Foi bem melhor ontem.");
    expect(f?.resultado).toBe("funcionou");
    expect(f?.acao).toBe("nenhum");
    expect(instrucaoDeAjuste(f!)).toMatch(/NÃO mexa no quadro/);
  });
});

describe("D. não precisa mais → aposenta o recurso", () => {
  it.each(["Não precisa mais dos cards.", "Já podemos tirar o quadro.", "Não usamos mais."])(
    "%s",
    (t) => {
      expect(classificarFeedbackRotina(t)?.acao).toBe("aposentar");
    },
  );

  it("aposentar não insiste em salvar o quadro", () => {
    const i = instrucaoDeAjuste({ resultado: "funcionou", acao: "aposentar" });
    expect(i).toMatch(/Não insista nem tente salvar o quadro/);
    expect(i).toMatch(/O recurso existe pra chegar aqui/);
  });
});

// ============================================================
// A ÂNCORA — metade do valor deste módulo é NÃO agir
// ============================================================

describe("nada mexe no quadro sem âncora", () => {
  it("conversa comum não vira feedback", () => {
    for (const t of ["Bom dia!", "Ele acordou bem hoje.", "Quanto custa o plano?"])
      expect(classificarFeedbackRotina(t)).toBeNull();
  });

  it("a fala precisa tocar no quadro — pelo nome", () => {
    expect(falaDoQuadro("A rotina não funcionou", [])).toBe(true);
    expect(falaDoQuadro("Os cartões ajudaram", [])).toBe(true);
    expect(falaDoQuadro("Aquele combinado da loja funcionou", [])).toBe(true);
  });

  it("ou por uma etapa que está mesmo lá dentro", () => {
    expect(falaDoQuadro("guardar controle ele já faz sozinho", ETAPAS)).toBe(true);
    expect(falaDoQuadro("a natação não funcionou", ETAPAS)).toBe(false);
  });

  it("'não funcionou' solto NÃO autoriza mexer", () => {
    // Pode ser sobre o plano, o remédio, a escola. O custo de errar aqui é a
    // família perder o quadro.
    expect(falaDoQuadro("não funcionou", ETAPAS)).toBe(false);
  });

  it("etapa curta demais não serve de âncora", () => {
    // "sim", "não" e afins casariam com qualquer frase.
    expect(falaDoQuadro("isso não funcionou", ["ir", "pá"])).toBe(false);
  });

  it("o leitor exige rotina existente E âncora, nesta ordem", () => {
    expect(GUIADA).toMatch(/export async function lerFeedbackDaRotina/);
    expect(GUIADA).toMatch(/if \(!rot\) return null;/);
    expect(GUIADA).toMatch(/return falaDoQuadro\(params\.texto, etapas\) \? feedback : null;/);
  });
});

// ============================================================
// A LIGAÇÃO
// ============================================================

describe("H. dois membros — feedback de um nunca mexe no outro", () => {
  it("a rotina lida é a do membro em foco, não a mais recente da família", () => {
    expect(GUIADA).toMatch(/\.eq\("membro_atipico_id", params\.membroAtipicoId\)/);
  });

  it("o orquestrador resolve o membro ANTES de ler o feedback", () => {
    const t = ORCH.slice(ORCH.indexOf("const ehFeedbackDeRotina"));
    expect(t.indexOf("const membroId = alvo.membroId")).toBeLessThan(
      t.indexOf("await lerFeedbackDaRotina"),
    );
  });

  it("membro ambíguo pergunta qual criança antes de qualquer coisa", () => {
    const t = ORCH.slice(ORCH.indexOf("const ehFeedbackDeRotina"));
    expect(t.indexOf("perguntarQualCrianca")).toBeLessThan(t.indexOf("await lerFeedbackDaRotina"));
  });
});

describe("o resultado é gravado, e é ele que evita a cobrança", () => {
  it("grava resultado + nota + data na rotina", () => {
    expect(GUIADA).toMatch(/resultado: params\.feedback\.resultado/);
    expect(GUIADA).toMatch(/resultado_nota: params\.texto\.slice\(0, 500\)/);
  });

  it("grava ANTES de tentar editar — feedback é resultado mesmo sem edição", () => {
    const t = GUIADA.slice(GUIADA.indexOf("export async function editarRotina"));
    expect(t.indexOf("resultado: params.feedback.resultado")).toBeLessThan(
      t.indexOf("client.messages.create"),
    );
  });

  it("investigar e 'funcionou inteiro' não editam o quadro", () => {
    expect(GUIADA).toMatch(
      /if \(params\.feedback\.acao === "investigar" \|\| params\.feedback\.acao === "nenhum"\) return null;/,
    );
  });

  it("a instrução do feedback acompanha o editor, sem substituí-lo", () => {
    // O editor já sabe casar tarefas e preservar a arte dos cartões gerados —
    // é isso que faz a simplificação não custar as imagens que já existem.
    expect(GUIADA).toMatch(
      /\$\{SYSTEM_EDITAR\}\s+\$\{instrucaoDeAjuste\(params\.feedback\)\}/,
    );
  });
});

describe("E/F. follow-up preservado", () => {
  it("feedback espontâneo preenche resultado, que tira da fila", () => {
    // A fila é `resultado is null and seguimento_enviado_em is null` (0075).
    expect(GUIADA).toMatch(/resultado_em: new Date\(\)\.toISOString\(\)/);
  });

  it("a retomada continua marcando seguimento só após envio aceito", () => {
    const t = ORCH.slice(ORCH.indexOf("export async function sendRotinaSeguimento"));
    expect(t.indexOf("if (r.enviada)")).toBeLessThan(t.indexOf("seguimento_enviado_em:"));
  });
});

describe("I/J/K. o que já existia continua", () => {
  it("pedido explícito de edição segue funcionando sem feedback", () => {
    expect(ORCH).toMatch(/intent === "rotina_editar" \|\| pedeEditarRotina\(inbound\.texto\)/);
  });

  it("feedback sem âncora devolve a conversa ao fluxo normal", () => {
    expect(ORCH).toMatch(/const semAncora =/);
    expect(ORCH).toMatch(/const msg = semAncora \? null : await editarRotina/);
  });

  it("mini continua propondo recorte e rotina grande continua perguntando", () => {
    expect(GUIADA).toMatch(/faltaSequencia && tamanho === "mini"/);
    expect(GUIADA).toMatch(/faltaSequencia && tamanho !== "mini"/);
  });
});
