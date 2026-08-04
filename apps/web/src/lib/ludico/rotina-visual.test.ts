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
    expect(PAGE).toMatch(/Escreva o que vai acontecer, na ordem/);
    expect(PAGE).toMatch(/A Kolo transforma em cartões ilustrados/);
  });

  it("não pergunta o tipo de rotina — é sempre uma sequência", () => {
    expect(FORM).toMatch(/não se pergunta o tipo/);
    expect(FORM).toMatch(/também prepara .{0,40}pra uma experiência/);
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
  it("começa fechado — onze passos abertos dominam a tela", () => {
    expect(FORM).toMatch(/Ver exemplo · Dia do dentista →/);
    expect(FORM).toMatch(/Onze passos abertos dominam a tela/);
    expect(FORM).toMatch(/Onze passos abertos dominam a tela/);
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
    expect(FORM).toMatch(/apareça nos cartões/);
    expect(FORM).toContain("decisão diferente do tema (que é o cenário)");
  });

  it("a opção de personagem só existe quando a criança tem avatar", () => {
    expect(FORM).toMatch(/\{temAvatar \? \(/);
  });

  it("os chips de tema vêm dos interesses reais, com 'outro' sempre", () => {
    expect(FORM).toMatch(/sugestoes\.map\(\(it\) =>/);
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

// ============================================================
// O TEMA VESTE, NÃO SUBSTITUI — 04/08/2026
// ============================================================

describe("a fantasia não pode trocar o que a criança vai encontrar", () => {
  const GERAR = readFileSync(resolve(__dirname, "gerar.ts"), "utf8");

  it("a instrução que quebrou o Dia do dentista saiu", () => {
    // O prompt mandava "VESTIR cada atividade no universo do tema" e dava como
    // exemplo renomear as etapas: POSTO DOS CAMPEÕES, LAVA-RÁPIDO TURBO.
    // Só sobrevivem no comentário que explica o incidente, nunca na instrução.
    const prompt = GERAR.slice(GERAR.indexOf("const SYSTEM = "));
    expect(prompt).not.toMatch(/POSTO DOS CAMPEÕES|LAVA-RÁPIDO TURBO/);
    expect(prompt).not.toMatch(/VESTE cada uma no universo do tema/);
  });

  it("a regra principal está escrita, com os exemplos reais", () => {
    expect(GERAR).toMatch(/O TEMA VESTE, NÃO SUBSTITUI A REALIDADE/);
    expect(GERAR).toMatch(/dentista continua dentista/);
    expect(GERAR).toMatch(/carro continua carro \(não carruagem\)/);
    expect(GERAR).toMatch(/cadeira do dentista continua cadeira do dentista/);
  });

  it("permite a princesa, proíbe o mago na carruagem", () => {
    expect(GERAR).toMatch(/Pode existir uma princesa indo ao dentista/);
    expect(GERAR).toMatch(/Não pode existir um mago numa carruagem/);
  });

  it("o nome do card diz o que acontece de verdade", () => {
    expect(GERAR).toMatch(/dizendo O QUE ACONTECE DE VERDADE/);
    expect(GERAR).toMatch(/é CADEIRA DO DENTISTA — nunca CADEIRA MÁGICA/);
  });

  it("a cena carrega os objetos reais da situação", () => {
    expect(GERAR).toMatch(/com os objetos REAIS e reconhecíveis da situação/);
  });
});

describe("a história prepara, não repete os cartões", () => {
  const GERAR = readFileSync(resolve(__dirname, "gerar.ts"), "utf8");

  it("complementa em vez de repetir", () => {
    expect(GERAR).toMatch(/Ela COMPLEMENTA os cards, não os repete/);
    expect(GERAR).toMatch(/ajuda a criança a entender e a se preparar por dentro/);
  });

  it("diz o que ela pode fazer e como pedir ajuda", () => {
    expect(GERAR).toMatch(/como pedir ajuda ou avisar que não está gostando/);
    expect(GERAR).toMatch(/existe começo, meio e FIM/);
  });

  it("NUNCA promete resultado", () => {
    expect(GERAR).toMatch(/NUNCA prometa resultado/);
    expect(GERAR).toMatch(/nada de "você vai ficar calmo", "não vai doer"/);
  });

  it("não termina sempre em dormir — nem toda rotina é um dia", () => {
    expect(GERAR).toMatch(/Não termine sempre em dormir/);
    expect(GERAR).not.toMatch(/fecha tranquilo no descanso\/dormir/);
  });

  it("o anti-ABA continua de pé", () => {
    expect(GERAR).toMatch(/ANTI-ABA/);
  });

  it("o título diz pra que ela serve", () => {
    const EDITOR = readFileSync(
      resolve(__dirname, "../../app/(app)/ludico/rotinas/[id]/rotina-editor.tsx"),
      "utf8",
    );
    expect(EDITOR).toMatch(/Uma historinha pra preparar/);
    // O rótulo antigo só pode sobreviver no comentário que explica a troca.
    expect(EDITOR).not.toMatch(/>A história da rotina</);
  });
});

// ============================================================
// A TELA, SIMPLIFICADA
// ============================================================

describe("a tela é ferramenta, não landing", () => {
  it("o topo é curto e diz o que a página faz", () => {
    expect(PAGE).toMatch(/Crie uma rotina visual/);
    expect(PAGE).toMatch(/Escreva o que vai acontecer, na ordem/);
    // A teoria sobre desregulação saiu do topo.
    expect(PAGE).not.toMatch(/o que mais desregula/);
  });

  it("o exemplo começa fechado", () => {
    expect(FORM).toMatch(/const \[verExemplo, setVerExemplo\] = useState\(false\)/);
    expect(FORM).toMatch(/Ver exemplo · Dia do dentista →/);
  });

  it("o exemplo ensina que também serve pra preparar uma experiência", () => {
    expect(FORM).toMatch(/também prepara \{nomeMembro \|\| "a criança"\} pra uma experiência/);
  });

  it("temas: interesses primeiro, populares depois, sem repetir", () => {
    expect(FORM).toMatch(/const sugestoes = useMemo/);
    expect(FORM).toMatch(/TEMAS_POPULARES\.filter\(\(t\) => !vistos\.has\(t\.toLowerCase\(\)\)\)/);
    expect(FORM).toMatch(/"Princesas"/);
  });

  it("princesa não é categoria especial — é tema como qualquer outro", () => {
    expect(FORM).not.toMatch(/Contos e princesas/);
    expect(FORM).toMatch(/Não é catálogo nem categoria/);
  });

  it('"Outro tema" abre campo livre com a pergunta', () => {
    expect(FORM).toMatch(/Qual tema você quer\?/);
    expect(FORM).toMatch(/cavalos, trens, unicórnios/);
  });

  it("a palavra 'avatar' não aparece pra família", () => {
    const visivel = FORM.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"));
    const texto = visivel.join("\n");
    expect(texto).not.toMatch(/>Avatar d|Avatar da |Avatar do /);
    expect(FORM).toMatch(/Quer que \{nomeMembro \|\| "a criança"\} apareça nos cartões\?/);
    expect(FORM).toMatch(/Sim, usar \{nomeMembro \|\| "a criança"\} como personagem/);
  });

  it("sem personagem criado, oferece criar — e não uma opção quebrada", () => {
    expect(FORM).toMatch(/Criar personagem/);
    expect(FORM).toMatch(/href="\/configuracoes\/avatar"/);
  });

  it("a miniatura do personagem aparece quando existe", () => {
    expect(FORM).toMatch(/src=\{avatarUrl\}/);
  });

  it("o atalho da semana não compete com o CTA — fica depois da lista", () => {
    const iBotao = PAGE.indexOf("CriarRotinaVisual");
    const iSemana = PAGE.indexOf("Ver a rotina da semana");
    expect(iSemana).toBeGreaterThan(iBotao);
    expect(PAGE).toMatch(/não pode competir com a fórmula nova/);
  });
});
