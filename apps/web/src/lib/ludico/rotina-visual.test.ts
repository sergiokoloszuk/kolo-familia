import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { passosDoTexto, nomeAPartirDosPassos } from "./interesses";

/**
 * A FÓRMULA ÚNICA — Rotina Visual, 04/08/2026.
 *
 * Antes existiam três portas: "Montar com a Kolo" (chat), "Rotina da semana" e
 * "Nova rotina". A mãe precisava entender a arquitetura do produto pra
 * escolher. Agora é uma coisa só — nome opcional, os passos, o tema, gerar —
 * porque "segunda-feira", "dia do dentista" e "brincar → guardar → banho" são a
 * mesma coisa pra ela: uma sequência que a criança precisa ENXERGAR.
 */

const PAGE = readFileSync(
  resolve(__dirname, "../../app/(app)/ludico/rotinas/page.tsx"),
  "utf8",
);
const FORM = readFileSync(
  resolve(__dirname, "../../app/(app)/ludico/rotinas/criar-rotina-visual.tsx"),
  "utf8",
);
const ACTIONS = readFileSync(
  resolve(__dirname, "../../app/(app)/ludico/rotinas/actions.ts"),
  "utf8",
);
const INTERESSES = readFileSync(resolve(__dirname, "interesses.ts"), "utf8");

// ============================================================
// ⚠️ PORTÃO RECORRENTE — ISOLAMENTO ENTRE CRIANÇAS E FAMÍLIAS
//
// Decisão do Sérgio (04/08/2026): todo recurso que usa perfil, interesse,
// avatar ou artefato salvo passa por aqui. Vem dos casos Manu/Mario, do link
// que abria a rotina do irmão e do plano que herdou o assunto de outra
// conversa — a mesma falha, três vezes, em lugares diferentes.
// ============================================================

describe("PORTÃO: nada vaza de outra criança ou de outra família", () => {
  it("os interesses conferem o membro CONTRA a família antes de ler o perfil", () => {
    expect(INTERESSES).toMatch(/\.eq\("id", params\.membroId\)\n\s*\.eq\("family_account_id", params\.familyId\)/);
    expect(INTERESSES).toMatch(/confiar só nele deixaria passar um id de outra conta/);
  });

  it("o avatar é filtrado por membro E por família", () => {
    expect(INTERESSES).toMatch(
      /from\("avatares_membros_atipicos"\)[\s\S]{0,160}?\.eq\("membro_atipico_id", params\.membroId\)\n\s*\.eq\("family_account_id", params\.familyId\)/,
    );
  });

  it("a tela carrega chips e avatar da criança ATIVA, não de qualquer uma", () => {
    expect(PAGE).toMatch(/interessesDaCrianca\(supabase, \{ membroId: ativaId, familyId \}\)/);
    expect(PAGE).toMatch(/avatarDaCrianca\(supabase, \{ membroId: ativaId, familyId \}\)/);
  });

  it("criar rotina recusa membro que não é da família", () => {
    expect(ACTIONS).toMatch(
      /\.eq\("id", membroAtipicoId\)\n\s*\.eq\("family_account_id", family\.id\)/,
    );
    expect(ACTIONS).toMatch(/Não encontrei essa criança na sua conta/);
  });

  it("o avatar usado na geração passa pela mesma checagem", () => {
    expect(ACTIONS).toMatch(
      /avatarDaCrianca\(supabase, \{ membroId: membroAtipicoId, familyId: family\.id \}\)/,
    );
  });

  it("a rotina nasce amarrada à família e ao membro conferidos", () => {
    expect(ACTIONS).toMatch(/family_account_id: family\.id,\n\s*membro_atipico_id: membroAtipicoId,/);
  });
});

// ============================================================
// A FÓRMULA
// ============================================================

describe("uma porta só", () => {
  it("as três portas antigas saíram da entrada", () => {
    expect(PAGE).not.toMatch(/Montar com a Kolo/);
    expect(PAGE).not.toMatch(/<NovaRotina/);
    expect(PAGE).not.toMatch(/rotinas\/assistente/);
  });

  it("a semana continua alcançável — mas só por quem já montou lá", () => {
    expect(PAGE).toMatch(/const temSemana = /);
    expect(PAGE).toMatch(/\{temSemana && \(/);
    expect(PAGE).toMatch(/Ver a rotina da semana que você já montou/);
    // A rota continua viva: links e tokens antigos não podem quebrar.
    expect(PAGE).toMatch(/href="\/ludico\/rotinas\/semana"/);
  });

  it("a promessa da tela cabe em uma frase", () => {
    expect(PAGE).toMatch(/Você escreve o que vai acontecer/);
    expect(PAGE).toMatch(/A Kolo transforma a sequência em cartões ilustrados/);
  });

  it("não pergunta o tipo de rotina — é sempre uma sequência", () => {
    expect(FORM).toMatch(/não se pergunta o tipo/);
    expect(FORM).toMatch(/Serve pro dia inteiro, pra um passeio ou pra um momento difícil/);
  });
});

describe("sem horário em todo o caminho novo", () => {
  it("o formulário não tem campo de hora — só o comentário que explica a ausência", () => {
    expect(FORM).not.toMatch(/type="time"|placeholder="[^"]*d{1,2}h/i);
    expect(FORM).not.toMatch(/setHora|value={hora/);
    expect(FORM).toMatch(/Sem horário: era a maior fonte de rotina barrada/);
  });

  it("a ação grava hora null, e diz por quê", () => {
    expect(ACTIONS).toMatch(/\/\/ SEM HORA\. Ver o comentário do bloco\.\n\s*hora: null/);
    expect(ACTIONS).toMatch(/maior fonte de rotina barrada/);
  });
});

describe("o exemplo do dentista ensina sem assustar", () => {
  it("mostra 6 passos e esconde o resto atrás de 'ver completo'", () => {
    expect(FORM).toMatch(/const EXEMPLO_CURTO = 6/);
    expect(FORM).toMatch(/Ver exemplo completo/);
    expect(FORM).toMatch(/Onze de cara faz a\n \* {2}tela parecer trabalho/);
  });

  it("os 11 passos são os do dentista, e ensinam previsibilidade", () => {
    expect(FORM).toMatch(/"Espero minha vez"/);
    expect(FORM).toMatch(/"Abro a boca para o dentista olhar"/);
  });

  it("nenhum emoji nos passos — os cartões têm ilustração própria", () => {
    const bloco = FORM.slice(FORM.indexOf("const EXEMPLO ="), FORM.indexOf("];", FORM.indexOf("const EXEMPLO =")));
    expect(bloco).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("tema e personagem são coisas diferentes", () => {
  it("o avatar NÃO é um chip de tema", () => {
    expect(FORM).toMatch(/Personagem dos cartões/);
    expect(FORM).toMatch(/o tema é o cenário, o\n {10}personagem é quem aparece/);
  });

  it("a opção de personagem só existe quando a criança tem avatar", () => {
    expect(FORM).toMatch(/\{temAvatar && \(/);
  });

  it("os chips de tema vêm dos interesses reais, com 'outro' sempre", () => {
    expect(FORM).toMatch(/interesses\.map\(\(it\) =>/);
    expect(FORM).toMatch(/Outro tema/);
  });
});

// ============================================================
// COLAR UM BLOCO VIRA LINHAS
// ============================================================

describe("o texto colado vira passos", () => {
  it("quebra por vírgula quando há mais de uma", () => {
    expect(passosDoTexto("café, escola, almoço, brincar, banho")).toEqual([
      "café",
      "escola",
      "almoço",
      "brincar",
      "banho",
    ]);
  });

  it("uma vírgula só NÃO quebra — é um passo com detalhe", () => {
    expect(passosDoTexto("almoço, depois banho")).toEqual(["almoço, depois banho"]);
  });

  it("quebra por linha, e limpa numeração colada junto", () => {
    expect(passosDoTexto("1. Estou em casa\n2) Coloco o sapato\n- Vou de carro")).toEqual([
      "Estou em casa",
      "Coloco o sapato",
      "Vou de carro",
    ]);
  });

  it("ponto final não separa — 'vou de carro até o dentista.' é um passo", () => {
    expect(passosDoTexto("Vou de carro até o dentista.")).toEqual(["Vou de carro até o dentista."]);
  });

  it("linha vazia some", () => {
    expect(passosDoTexto("café\n\n\nescola")).toEqual(["café", "escola"]);
  });

  it("o formulário usa o mesmo divisor — não tem cópia própria", () => {
    expect(FORM).toMatch(/import \{ passosDoTexto \} from "@\/lib\/ludico\/interesses"/);
  });
});

// ============================================================
// NOME AUTOMÁTICO — sem inventar contexto
// ============================================================

describe("nome em branco vira título coerente", () => {
  it("usa o primeiro e o último passo, que foram ela que escreveu", () => {
    expect(nomeAPartirDosPassos(["Estou em casa", "Espero minha vez", "Volto para casa"])).toBe(
      "Estou em casa até Volto para casa",
    );
  });

  it("um passo só vira o próprio passo", () => {
    expect(nomeAPartirDosPassos(["Tomar banho"])).toBe("Tomar banho");
  });

  it("nunca fica vazio", () => {
    expect(nomeAPartirDosPassos([])).toBe("Minha rotina");
  });

  it("a ação só nomeia quando a mãe deixou em branco", () => {
    expect(ACTIONS).toMatch(/const titulo = nome\.trim\(\) \|\| nomeAPartirDosPassos\(limpos\)/);
  });
});

// ============================================================
// O QUE JÁ EXISTIA CONTINUA — nada de segundo sistema
// ============================================================

describe("reusa o que já funcionava", () => {
  it("mesmo gerador de cartões e mesma historinha", () => {
    expect(ACTIONS).toMatch(/gerarRoteiroRotina\(/);
    expect(ACTIONS).toMatch(/ilustrarCards\(/);
    expect(ACTIONS).toMatch(/historia: roteiro\.historia/);
  });

  it("a rotina nova abre em cartões", () => {
    expect(ACTIONS).toMatch(/modo_exibicao: "cartoes"/);
  });

  it("sem tema e sem avatar, existe como lista — não trava a criação", () => {
    expect(ACTIONS).toMatch(/if \(temaParaRoteiro\) \{/);
    expect(ACTIONS).toMatch(/a mãe\n\s*\/\/ escolhe o tema depois na própria tela/);
  });

  it("falha na ilustração não perde a rotina — marca erro e segue", () => {
    expect(ACTIONS).toMatch(/cards_status: "erro"/);
  });

  it("nada nasce na semana por este caminho", () => {
    expect(ACTIONS).toMatch(/dia_semana: null/);
  });
});

// ============================================================
// EDIÇÃO COMPLETA — as palavras dela voltam editáveis
// ============================================================

describe("editar devolve a lista com as palavras da mãe", () => {
  const EDITOR = readFileSync(
    resolve(__dirname, "../../app/(app)/ludico/rotinas/[id]/rotina-editor.tsx"),
    "utf8",
  );

  it("o editor finalmente importa `editarTarefa`", () => {
    // A action existia desde sempre e nunca tinha sido ligada: dava pra
    // reordenar e apagar um passo, nunca pra corrigir o texto.
    expect(EDITOR).toMatch(/^\s*editarTarefa,$/m);
    expect(EDITOR).toMatch(/function renomearPasso\(id: string, texto: string\)/);
  });

  it("a lista editável aparece em modo edição, antes de adicionar", () => {
    expect(EDITOR).toMatch(/\{editando \? \(\n\s*<>\n\s*\{tarefas\.length > 0 && \(\n\s*<ListaEditavel/);
  });

  it("cada passo é um campo com o texto dela", () => {
    expect(EDITOR).toMatch(/defaultValue=\{t\.texto\}/);
    expect(EDITOR).toMatch(/onBlur=\{\(e\) => onRenomear\(t\.id, e\.target\.value\)\}/);
  });

  it("Enter salva e Escape desiste — sem botão de salvar", () => {
    expect(EDITOR).toMatch(/if \(e\.key === "Enter"\) e\.currentTarget\.blur\(\)/);
    expect(EDITOR).toMatch(/if \(e\.key === "Escape"\)/);
    expect(EDITOR).toMatch(/sem botão de salvar, que é mais uma coisa pra ela lembrar/);
  });

  it("reordenar e apagar continuam ali, na mesma linha", () => {
    expect(EDITOR).toMatch(/onMover\(i, -1\)/);
    expect(EDITOR).toMatch(/onMover\(i, 1\)/);
    expect(EDITOR).toMatch(/onRemover\(t\.id\)/);
  });

  it("texto vazio não apaga o passo por acidente", () => {
    expect(EDITOR).toMatch(/const t = texto\.trim\(\);\n\s*if \(!t\) return;/);
  });

  it("texto igual não gasta uma escrita no banco", () => {
    expect(EDITOR).toMatch(/if \(!atual \|\| atual\.texto === t\) return;/);
  });
});
