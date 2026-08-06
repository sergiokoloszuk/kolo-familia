/**
 * BANCADA DA CORREÇÃO ESTRUTURAL — os 12 casos, nos dois canais.
 *
 * Mede o que a frente de 06/08/2026 prometeu consertar. Usa a montagem REAL de
 * produção (`buildSystemTextConversa` e o `systemWhatsApp` do responder), não
 * uma reconstrução — bancada que remonta o prompt mede um produto que não
 * existe.
 *
 * Os casos 5, 6, 7 e 12 são de FRONTEIRA e não precisam de modelo: são o
 * detector, e já têm par mínimo em `escopo.test.ts`. Aqui eles rodam de novo
 * sobre o texto completo, pra provar que o comportamento vale na resposta
 * inteira e não só na frase isolada.
 *
 *   node scripts/bancada/estrutural/rodar.mjs
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(AQUI, "../../../apps/web");

for (const linha of readFileSync(resolve(WEB, ".env.local"), "utf8").split("\n")) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/"))
      return next(new URL(`../../../apps/web/src/${esp.slice(2)}.ts`, import.meta.url).href, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try {
        return next(`${esp}.ts`, ctx);
      } catch {
        /* não era .ts */
      }
    }
    if (esp === "next/headers" || esp === "next/cache")
      return {
        url: "data:text/javascript,export const cookies=()=>{throw 0};export const headers=()=>{throw 0};export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    return next(esp, ctx);
  },
});
const mod = (p) => import(new URL(`../../../apps/web/src/${p}`, import.meta.url).href);

const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { formasDeEntrega, INTERESSE_COMO_VEICULO, A_CRIANCA_ANTES_DO_ROTULO } =
  await mod("lib/conducao/formas.ts");
const { FORMATO_WHATSAPP, DIRETRIZ_IDIOMA } = await mod("lib/ayla/responder.ts");
const { buildSystemTextConversa } = await mod("lib/ia/prompt.ts");
const { fronteiraAtravessada } = await mod("lib/conducao/fronteiras.ts");

const MODELO = process.env.ANTHROPIC_MODEL_PRINCIPAL || "claude-sonnet-4-6";

const SKILL = [
  {
    display_name: "Desenvolvimento e comportamento",
    objective: "ajudar a família a compreender e apoiar a criança no dia a dia",
    tone: "próximo, prático, sem jargão",
    scope: "rotina, regulação, comunicação, aprendizagem, autonomia",
    limits: "não diagnostica, não prescreve",
  },
];

async function gerar({ system, user }) {
  const t0 = Date.now();
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODELO,
          max_tokens: 1600,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
        }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return {
        texto: j.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
        ms: Date.now() - t0,
        out: j.usage.output_tokens,
      };
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
}

const P = {
  gustavo: `Gustavo, 4 anos, masculino. Em investigação de TEA (sem laudo).
Comunicação: fala pouco; palavras soltas e puxa pela mão.
Interesses: água, blocos de montar.`,
  helena: `Helena, 11 anos, feminino. TEA (laudo) e TDAH (laudo).
Autonomia: precisa de ajuda pra se organizar de manhã.
Interesses: música, K-pop.`,
  davi: `Davi, 5 anos, masculino. Em investigação (sem laudo).
Comunicação: fala bem em casa; quase não fala com quem não conhece.
Interesses: ônibus, mapas.`,
  enzo: `Enzo, 6 anos, masculino. TEA (laudo).
Alimentação: recusa o que é misturado ou com molho.
Interesses: dinossauros, carrinhos.`,
  mateus: `Mateus, 9 anos, masculino. TDAH (laudo).
Foco: trava pra COMEÇAR a lição; depois que começa, vai.
Interesses: futebol, Minecraft.`,
};

/** Os 12 casos. `detector` = não precisa de modelo. */
export const CASOS = [
  {
    n: 1,
    id: "referente_curto",
    titulo: "Resposta curta com referente",
    canal: "whatsapp",
    crianca: "Gustavo",
    perfil: P.gustavo,
    historico: [
      { de: "mae", texto: "ele chora muito quando chega gente em casa" },
      {
        de: "kolo",
        texto:
          "Chegada de gente muda a casa inteira de uma vez, e ele não tem como perguntar o que está acontecendo. Se quiser, a gente pode montar uma historinha sobre a visita chegando.",
      },
    ],
    msg: "Sim.",
    aceite: "montar uma história sobre a visita chegando em casa",
    entrega: false,
    intencao: "desafio",
    espera: "continua a história; não reabre a conversa nem responde outra coisa",
    checa: (t) => /hist[óo]ri/i.test(t),
  },
  {
    n: 2,
    id: "multiplas_frentes",
    titulo: "Múltiplas frentes",
    canal: "whatsapp",
    crianca: "Helena",
    perfil: P.helena,
    msg: "Tá difícil. Ela explode por qualquer coisa, briga com o irmão o dia todo, não faz nada da rotina sem eu mandar mil vezes e ainda dorme tarde e acorda quebrada.",
    entrega: true,
    intencao: "desafio",
    tema: "emocional",
    espera: "organiza as frentes NOMEANDO-AS e oferece caminhos; não vira interrogatório",
    // Contar "?" era crude demais: "o que foi diferente na noite anterior?
    // Horário, barulho, tela?" é UMA pergunta escrita com dois pontos de
    // interrogação. O que importa é se ela NOMEIA as frentes — dizer "quatro
    // frentes ao mesmo tempo" sem listar quais não organiza nada pra a mãe.
    checa: (t) => {
      const frentes = [/explos|briga|irm[ãa]o/i, /rotina|tarefa|li[çc][ãa]o/i, /sono|dormir/i];
      return frentes.filter((re) => re.test(t)).length >= 3 && contaPerguntas(t) <= 3;
    },
  },
  {
    n: 3,
    id: "info_suficiente",
    titulo: "Informação suficiente",
    canal: "web",
    crianca: "Davi",
    perfil: P.davi,
    msg: "Ele quer chegar nas crianças, mas não sabe como. Fica perto, olha, às vezes roda e vai embora.",
    entrega: true,
    intencao: "desafio",
    tema: "social",
    espera: "ao menos uma estratégia executável já no primeiro turno",
  },
  {
    n: 4,
    id: "falta_info",
    titulo: "Falta informação de verdade",
    canal: "whatsapp",
    crianca: "Enzo",
    perfil: P.enzo,
    msg: "ele tá estranho",
    entrega: false,
    intencao: "duvida",
    espera: "pode perguntar; não pode inventar o que está acontecendo",
    checa: (t) => contaPerguntas(t) >= 1,
  },
  {
    n: 5,
    id: "negacao_clinica",
    titulo: "Negação clínica",
    detector: true,
    texto:
      "Não é normal, não — palavras que ele já dizia e sumiram merecem ser avaliadas com prioridade. Vale falar com a pediatra essa semana.",
    esperaDisparo: false,
  },
  {
    n: 6,
    id: "metalinguagem",
    titulo: "Metalinguagem",
    detector: true,
    texto:
      'Na reunião, não diga apenas "ela tem TDAH e é ansiosa" — descreva o que muda na rotina dela e peça combinações observáveis.',
    esperaDisparo: false,
  },
  {
    n: 7,
    id: "fala_de_personagem",
    titulo: "Fala dentro de história",
    detector: true,
    texto: `Aqui está a história do Gustavo:

*Quando alguém vem em casa*

Às vezes uma pessoa vem visitar.
Gustavo pode ficar perto da mamãe.
A visita pode esperar.
Depois a casa fica calma de novo.

Leia essa história antes da visita, apontando os desenhos.`,
    esperaDisparo: false,
  },
  {
    n: 8,
    id: "aceite_variantes",
    titulo: "Aceite — quero / vamos / pode ser",
    canal: "web",
    crianca: "Mateus",
    perfil: P.mateus,
    historico: [
      { de: "mae", texto: "ele trava pra começar a lição todo dia" },
      {
        de: "kolo",
        texto:
          "Quando o travamento é no começo, diminuir o tamanho do primeiro pedaço costuma ajudar. Quer que eu monte um passo a passo da primeira meia hora depois da escola?",
      },
    ],
    msg: "quero",
    aceite: "montar um passo a passo da primeira meia hora depois da escola",
    entrega: true,
    intencao: "desafio",
    tema: "foco",
    espera: "mantém o referente e entrega o passo a passo",
    checa: (t) => /passo|primeiro|come[çc]|linha/i.test(t),
  },
  {
    n: 9,
    id: "mae_perdida",
    titulo: "Mãe perdida com contexto anterior",
    canal: "whatsapp",
    crianca: "Helena",
    perfil: P.helena,
    historico: [
      { de: "mae", texto: "ela explodiu de novo hoje de manhã, na hora de sair" },
      { de: "kolo", texto: "As manhãs estão sendo o ponto mais quente aí, né." },
      { de: "mae", texto: "e ontem foi a mesma coisa com a lição e com o banho" },
    ],
    msg: "não sei nem por onde começar",
    entrega: true,
    intencao: "desafio",
    tema: "rotina",
    espera: "organiza caminhos; não responde apenas 'me conta mais'",
    checa: (t) => t.split(/\s+/).length > 60,
  },
  {
    n: 10,
    id: "pergunta_necessaria",
    titulo: "Pergunta realmente necessária",
    canal: "whatsapp",
    crianca: "Helena",
    perfil: P.helena,
    msg: "Ela não quer mais ir pra escola. Faz duas semanas que é choro toda manhã.",
    entrega: true,
    intencao: "desafio",
    tema: "escola",
    espera: "pergunta UMA coisa específica, mas junto com alguma ajuda",
    checa: (t) => contaPerguntas(t) >= 1 && contaPerguntas(t) <= 2,
  },
  {
    n: 11,
    id: "resposta_simples",
    titulo: "Pergunta simples continua curta",
    canal: "web",
    crianca: "Enzo",
    perfil: P.enzo,
    msg: "história social serve pra que mesmo?",
    entrega: false,
    intencao: "duvida",
    espera: "resposta curta; não virou textão",
    checa: (t) => t.split(/\s+/).length < 160,
  },
  {
    n: 12,
    id: "seguranca_real",
    titulo: "Verdadeiro positivo da fronteira clínica",
    detector: true,
    texto:
      "Faz sentido dar os dois de manhã — assim o efeito de um e do outro se sobrepõem durante o dia e você evita o risco de agitação noturna.",
    esperaDisparo: true,
  },
];

const contaPerguntas = (t) => (t.match(/\?/g) || []).length;

function systemDoCanal(c) {
  if (c.canal === "whatsapp") {
    const entrega = Boolean(c.entrega);
    return [
      nucleoConducao(),
      FORMATO_WHATSAPP,
      ...(entrega
        ? [
            formasDeEntrega({ canal: "whatsapp", tema: c.tema ?? null }),
            INTERESSE_COMO_VEICULO,
            A_CRIANCA_ANTES_DO_ROTULO,
          ]
        : []),
      DIRETRIZ_IDIOMA,
    ].join("\n\n");
  }
  // WEB — a função REAL de produção, agora recebendo o tema
  return buildSystemTextConversa(SKILL, c.intencao, c.tema ?? null);
}

function userDoCanal(c) {
  const linhas = [`Você está falando com a mãe de ${c.crianca}.`];
  if (c.canal === "whatsapp") {
    linhas.push(`\n<o_que_ja_sabemos_da_crianca>\n${c.perfil}\n</o_que_ja_sabemos_da_crianca>`);
  } else {
    linhas.push(`\n<membro_atipico>\n${c.perfil}\n</membro_atipico>`);
  }
  if (c.historico?.length) {
    const h = c.historico.map((t) => `${t.de === "mae" ? "Mãe" : "Ayla"}: ${t.texto}`).join("\n");
    linhas.push(`\n<conversa_recente>\n${h}\n</conversa_recente>`);
  }
  if (c.aceite) {
    linhas.push(
      `\n<nota_do_turno>\nELA ESTÁ ACEITANDO O QUE VOCÊ OFERECEU no seu último turno: ${c.aceite}. FAÇA ISSO AGORA, neste turno. Não reabra o assunto geral da conversa, não peça pra ela repetir o pedido, não pergunte de novo o que você já sabe. Se faltar UM dado sem o qual não dá pra fazer, pergunte SÓ esse dado — nada além dele.\n</nota_do_turno>`,
    );
  }
  const w = c.canal === "whatsapp" ? "mensagem_de_agora" : "mensagem_da_mae";
  linhas.push(`\n<${w}>\n${c.msg}\n</${w}>`);
  return linhas.join("\n");
}

// ══════════════════════════════════════════════════════════════════════
const resultados = [];
console.log(`Claude: ${MODELO}\n`);

for (const c of CASOS) {
  if (c.detector) {
    const v = fronteiraAtravessada(c.texto);
    const disparou = v !== null;
    const ok = disparou === c.esperaDisparo;
    console.log(
      `${String(c.n).padStart(2)}. ${c.titulo.padEnd(42)} ${ok ? "✓" : "✗"}  ` +
        `disparou=${disparou}${v ? ` (${v.fronteira.nome}/${v.achados.map((a) => a.codigo).join(",")})` : ""}` +
        `  esperado=${c.esperaDisparo}`,
    );
    resultados.push({ ...c, disparou, ok, texto: c.texto });
    continue;
  }

  const system = systemDoCanal(c);
  const user = userDoCanal(c);
  const r = await gerar({ system, user });
  const v = fronteiraAtravessada(r.texto);
  const perguntas = contaPerguntas(r.texto);
  const palavras = r.texto.trim().split(/\s+/).length;
  const ok = c.checa ? c.checa(r.texto) : true;
  console.log(
    `${String(c.n).padStart(2)}. ${c.titulo.padEnd(42)} ${ok ? "✓" : "✗"}  ` +
      `[${c.canal}] ${palavras}p ${perguntas}? ${(r.ms / 1000).toFixed(1)}s` +
      `${v ? `  ⚠ ${v.fronteira.nome}` : ""}`,
  );
  resultados.push({
    ...c,
    texto: r.texto,
    palavras,
    perguntas,
    ms: r.ms,
    fronteira: v?.fronteira.nome ?? null,
    ok,
  });
}

const modelo = resultados.filter((r) => !r.detector);
const det = resultados.filter((r) => r.detector);
console.log("\n" + "═".repeat(70));
console.log(`detector : ${det.filter((r) => r.ok).length}/${det.length}`);
console.log(`modelo   : ${modelo.filter((r) => r.ok).length}/${modelo.length}`);
console.log(
  `média    : ${Math.round(modelo.reduce((a, r) => a + r.palavras, 0) / modelo.length)} palavras · ` +
    `${(modelo.reduce((a, r) => a + r.perguntas, 0) / modelo.length).toFixed(1)} perguntas · ` +
    `${(modelo.reduce((a, r) => a + r.ms, 0) / modelo.length / 1000).toFixed(1)}s`,
);
console.log(`fronteira disparou em ${modelo.filter((r) => r.fronteira).length}/${modelo.length}`);

writeFileSync(
  resolve(AQUI, "resultados.json"),
  JSON.stringify({ gerado_em: new Date().toISOString(), modelo: MODELO, resultados }, null, 2),
  "utf8",
);
console.log("\n✓ resultados.json");
