/**
 * BANCADA DE EXPERIÊNCIA — a nova arquitetura melhorou a conversa de verdade?
 *
 * A suíte de 408 testes prova CONTRATO: a instrução certa está no lugar certo.
 * Isto aqui mede COMPORTAMENTO: o que o modelo real devolve com o prompt real,
 * nos dois canais.
 *
 * Diferença importante em relação à bancada da fronteira: lá os prompts eram
 * extraídos por regex do TS. Aqui os módulos de produção são IMPORTADOS —
 * `nucleoConducao()`, `formasDeEntrega()`, `ehEntrega()`, `dividirEmBolhas()`,
 * `templateBoasVindasComDesafio()`. Se a bancada monta o prompt por conta
 * própria, ela mede um produto que não existe.
 *
 * Nada é corrigido durante a execução: a bancada REGISTRA. Ver o padrão da
 * versão inteira vale mais que consertar caso a caso (decisão do Sérgio).
 *
 *   node scripts/bancada/experiencia.mjs
 *   node scripts/bancada/experiencia.mjs --caso mateus
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../..");
const WEB = resolve(RAIZ, "apps/web");

const envPath = resolve(WEB, ".env.local");
if (existsSync(envPath)) {
  for (const linha of readFileSync(envPath, "utf8").split("\n")) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY ausente (apps/web/.env.local).");
  process.exit(1);
}

// O código de produção importa sem extensão (o Next resolve; o ESM do Node, não).
const { registerHooks } = await import("node:module");
registerHooks({
  resolve(especificador, contexto, proximo) {
    if (especificador.startsWith(".") && !/\.[a-z]+$/.test(especificador)) {
      try {
        return proximo(`${especificador}.ts`, contexto);
      } catch {
        /* não era .ts */
      }
    }
    return proximo(especificador, contexto);
  },
  // `@/lib/...` é alias do tsconfig — o Node não conhece.
  resolve2: undefined,
});
registerHooks({
  resolve(especificador, contexto, proximo) {
    if (especificador.startsWith("@/")) {
      return proximo(
        new URL(`../../apps/web/src/${especificador.slice(2)}.ts`, import.meta.url).href,
        contexto,
      );
    }
    // `responder.ts` puxa logging → supabase/server → next/headers, que só
    // existe dentro do request do Next. A bancada não chama nada disso: ela lê
    // as CONSTANTES do módulo. Um stub aqui evita ter que recortar o prompt
    // pra fora do código de produção — que é justamente o que faria a bancada
    // medir um produto que não existe.
    if (especificador === "next/headers" || especificador === "next/cache") {
      return {
        url: "data:text/javascript,export const cookies=()=>{throw new Error('stub')};export const headers=()=>{throw new Error('stub')};export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    }
    return proximo(especificador, contexto);
  },
});

const mod = (p) => import(new URL(`../../apps/web/src/${p}`, import.meta.url).href);

const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { formasDeEntrega, INTERESSE_COMO_VEICULO } = await mod("lib/conducao/formas.ts");
const { dividirEmBolhas } = await mod("lib/ayla/bolhas.ts");
const { templateBoasVindasComDesafio } = await mod("lib/ayla/messageTemplates.ts");
const { FORMATO_WHATSAPP, DIRETRIZ_IDIOMA } = await mod("lib/ayla/responder.ts");
const { VOZ_CONVERSA, blocoIntencao } = await mod("lib/ia/prompt.ts");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODELO = "claude-sonnet-4-5-20250929";

/** Monta o system EXATAMENTE como o responder.ts monta. */
function systemWhatsApp({ entrega, tema }) {
  return [
    nucleoConducao(),
    FORMATO_WHATSAPP,
    ...(entrega ? [formasDeEntrega({ canal: "whatsapp", tema }), INTERESSE_COMO_VEICULO] : []),
    DIRETRIZ_IDIOMA,
  ].join("\n\n");
}

/** Monta o system como buildSystemTextConversa monta (sem as skills do banco). */
function systemWeb({ intencao, tema }) {
  const entrega = intencao === "desafio";
  return [
    nucleoConducao(),
    VOZ_CONVERSA,
    blocoIntencao(intencao),
    ...(entrega ? [formasDeEntrega({ canal: "web", tema }), INTERESSE_COMO_VEICULO] : []),
    "# Como responder (formato da web)\n\nVocê conversa DENTRO do app — pode usar markdown leve.",
  ].join("\n\n");
}

async function gerar(system, mensagens) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const r = await client.messages.create({
        model: MODELO,
        max_tokens: 1400,
        system,
        messages: mensagens,
      });
      return r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    } catch (e) {
      if (tentativa === 2) throw e;
      await new Promise((r) => setTimeout(r, 2000 * (tentativa + 1)));
    }
  }
}

// ============================================================
// CONTEXTOS — o que o canal manda como <notas_internas>
// ============================================================

const CTX = {
  isabela: `Você está falando com Renata, mãe de Isabela.
<o_que_ja_sabemos_da_crianca>
Isabela, 15 anos, feminino. Diagnóstico informado pela família: TDAH (laudo).
O essencial: gosta muito de cinema e de desenhar. Tem um grupo de 4 amigas da escola desde os 8 anos.
Regulação emocional: fica ansiosa antes de coisas novas; costuma antecipar o pior.
Escola: vai bem em humanas; sofre com prazos.
</o_que_ja_sabemos_da_crianca>`,

  enzo: `Você está falando com Paula, mãe de Enzo.
<o_que_ja_sabemos_da_crianca>
Enzo, 6 anos, masculino. Diagnóstico informado pela família: TEA (laudo).
Alimentação: aceita arroz, macarrão sem molho, pão, banana, iogurte. Recusa tudo que é misturado ou com molho. Textura pastosa costuma ser recusada.
Sensorial: incomoda-se com cheiro forte.
Como é / interesses: dinossauros, carrinhos.
</o_que_ja_sabemos_da_crianca>`,

  mateus: `Você está falando com Juliana, mãe de Mateus.
<o_que_ja_sabemos_da_crianca>
Mateus, 9 anos, masculino. Diagnóstico informado pela família: TDAH (laudo).
Rotina: chega da escola 12h40. Almoça. Futebol às 15h30 às terças e quintas.
Foco: tem muita dificuldade pra COMEÇAR a lição — trava no início, depois vai.
Como é / interesses: futebol, Minecraft.
</o_que_ja_sabemos_da_crianca>`,

  lego: `Você está falando com Fernanda, mãe de Caio.
<o_que_ja_sabemos_da_crianca>
Caio, 7 anos, masculino. Diagnóstico informado pela família: TEA (laudo).
Como é / interesses: Lego (registrado há 8 meses, ninguém confirmou depois), praia.
Motor: dificuldade com movimento fino; cansa ao escrever.
</o_que_ja_sabemos_da_crianca>`,

  helena: `Você está falando com Bia, mãe de Helena.
<o_que_ja_sabemos_da_crianca>
Helena, 5 anos, feminino. Em investigação de TEA (sem laudo).
Rotina: manhã corrida; sai de casa 7h.
Foco: dispersa muito em atividade dirigida.
Como é / interesses: música, dançar.
</o_que_ja_sabemos_da_crianca>`,
};

const nota = (t) => `\n\n<notas_internas>\nREGRA DESTE TURNO: responda no WhatsApp, no formato do canal.\n</notas_internas>\n\n<mensagem_de_agora>\n${t}\n</mensagem_de_agora>`;

// ============================================================
// OS CASOS
// ============================================================

const CASOS = [
  {
    id: "familia_nova",
    titulo: "1. FAMÍLIA NOVA — a introdução, e a entrega logo depois",
    canal: "whatsapp",
    entrega: true,
    tema: "nutricional",
    // A introdução é DETERMINÍSTICA (template). Só o 2º turno vai ao modelo.
    determinístico: () =>
      templateBoasVindasComDesafio({
        nomeMae: "Carla",
        nomeMembro: "Théo",
        genero: "masculino",
        desafios: ["nutricional", "foco", "rotina"],
      }),
    ctx: `Você está falando com Carla, mãe de Théo.
<o_que_ja_sabemos_da_crianca>
Théo, 6 anos, masculino. Em investigação (sem laudo).
No cadastro a família marcou: nutricional, foco, rotina.
</o_que_ja_sabemos_da_crianca>`,
    turnos: ["a alimentação. ele só come 5 coisas e eu já não sei mais o que fazer"],
  },
  {
    id: "isabela",
    titulo: "2. ISABELA / CINEMA",
    canal: "whatsapp",
    entrega: true,
    tema: "emocional",
    ctx: CTX.isabela,
    turnos: [
      "ela passou em cinema mas agora está muito ansiosa e acha que não vai dar conta ficar longe das amigas. queria ajuda de como orientar, incentivar, mostrar um novo futuro vindo mas com menos ansiedade",
    ],
  },
  {
    id: "enzo",
    titulo: "3. ENZO / SELETIVIDADE",
    canal: "whatsapp",
    entrega: true,
    tema: "nutricional",
    ctx: CTX.enzo,
    turnos: ["o enzo não come quase nada, só aceita as mesmas coisas. tô preocupada"],
  },
  {
    id: "mateus",
    titulo: "4. MATEUS / IPAD",
    canal: "whatsapp",
    entrega: true,
    tema: "rotina",
    ctx: CTX.mateus,
    turnos: ["Qual horário você acha melhor pra encaixar iPad?"],
  },
  {
    id: "simples",
    titulo: "5. PROBLEMA SIMPLES — sem blocos",
    canal: "whatsapp",
    entrega: false, // ehEntrega() = false: não há desafio detectado
    tema: null,
    ctx: CTX.helena,
    turnos: ["Como aviso que faltam cinco minutos pra guardar o celular?"],
  },
  {
    id: "desabafo",
    titulo: "6. DESABAFO — sem arquitetura editorial",
    canal: "whatsapp",
    entrega: false,
    tema: null,
    ctx: CTX.helena,
    turnos: [
      "hoje foi um dia horrível. eu tô exausta, chorei no banho. parece que nada que eu faço dá certo com ela",
    ],
  },
  {
    id: "interesse_antigo",
    titulo: "7. INTERESSE ANTIGO — checagem leve",
    canal: "whatsapp",
    entrega: true,
    tema: "motor",
    ctx: CTX.lego,
    turnos: [
      "o caio odeia escrever, cansa rápido e desiste. queria uma atividade pra ele treinar a mão sem ser lição",
    ],
  },
  {
    id: "mudanca_tema",
    titulo: "8. MUDANÇA DE TEMA — começa em rotina, vira foco",
    canal: "whatsapp",
    entrega: true,
    tema: "rotina",
    ctx: CTX.mateus,
    turnos: [
      "a rotina da tarde dele tá uma bagunça, ele não para em nada",
      "e me dá uma atividade pra trabalhar o foco dele?",
    ],
    temaTurno2: "foco",
  },
  {
    id: "isabela_web",
    titulo: "2b. ISABELA / CINEMA — no canal WEB",
    canal: "web",
    intencao: "desafio",
    tema: "emocional",
    ctx: CTX.isabela,
    turnos: [
      "ela passou em cinema mas agora está muito ansiosa e acha que não vai dar conta ficar longe das amigas. queria ajuda de como orientar, incentivar, mostrar um novo futuro vindo mas com menos ansiedade",
    ],
  },
  {
    id: "desabafo_web",
    titulo: "6b. DESABAFO — no canal WEB",
    canal: "web",
    intencao: "desabafo",
    tema: null,
    ctx: CTX.helena,
    turnos: ["hoje foi um dia horrível. eu tô exausta, chorei no banho."],
  },
];

// ============================================================
// MEDIÇÕES OBJETIVAS — contadas, não julgadas
// ============================================================

const TITULO_WA = /^\s*(?:[\p{Extended_Pictographic}]+\s*)?\*[^*\n]{1,48}\*\s*$/u;
const TITULO_WEB = /^\s*\*\*[^*\n]{1,48}\*\*\s*:?\s*$/;

function medir(texto, canal) {
  const linhas = texto.split("\n");
  const titulos = linhas.filter((l) => (canal === "web" ? TITULO_WEB : TITULO_WA).test(l.trim()));
  const bolhas = canal === "whatsapp" ? dividirEmBolhas(texto) : [texto];
  const soTitulo = bolhas.filter((b) => (canal === "web" ? TITULO_WEB : TITULO_WA).test(b.trim()));
  return {
    titulos: titulos.length,
    bolhas: bolhas.length,
    bolhasSoTitulo: soTitulo.length,
    perguntas: (texto.match(/\?/g) || []).length,
    emojis: (texto.match(/[\p{Extended_Pictographic}]/gu) || []).length,
    palavras: texto.split(/\s+/).filter(Boolean).length,
    ofertaPlano: /plano estratégico|montar um plano/i.test(texto),
    promessaFutura: /vou montar|vou gerar|vou te mandar|já vou/i.test(texto),
    crencaNomeada: /crença limitante|a crença dela/i.test(texto),
    promessaResultado: /vai dar tudo certo|vai ficar tudo bem|com certeza vai/i.test(texto),
  };
}

// ============================================================
// JUÍZES SEPARADOS — um critério por juiz, sem nota agregada
// ============================================================

const CRITERIOS = [
  ["entendeu", "A resposta mostra que entendeu o que ESTA família trouxe — reorganiza o relato dela, não devolve genérico?"],
  ["personalizou", "Usa o nome, a idade certa e algo REAL do perfil desta criança (não um conselho que serviria pra qualquer uma)?"],
  ["direcao_cedo", "A mãe sai com uma direção concreta JÁ nesta resposta, sem ter que responder perguntas antes?"],
  ["executavel", "As orientações são executáveis hoje (o que fazer, o que dizer, o que observar) e não rótulos como 'mantenha o limite'?"],
  ["riqueza", "Tem substância — mais de uma ideia útil, com o porquê — sem virar aula nem lista genérica?"],
  ["naturalidade", "Soa como uma pessoa que entende falando com outra, não como material de consultoria nem chatbot?"],
  ["interesse_pertinente", "Se usou um interesse da criança, foi como VEÍCULO de uma ideia (não pra puxar assunto nem exibir memória)? Se não usou, isso foi adequado? Responda 'sim' quando o uso (ou o não-uso) foi pertinente."],
  ["crenca_com_base", "Se trouxe uma crença/reframe, ela tem base numa fala real do relato e foi apresentada como possibilidade ('pode estar pesando'), nunca nomeada como diagnóstico? Responda 'sim' também quando NÃO trouxe crença e isso era o certo."],
  ["futuro_sem_promessa", "Se falou de futuro, ligou realidade + possibilidade + passo concreto, sem prometer resultado? 'sim' também se não falou de futuro e não era o caso."],
  ["sem_perguntas_desnecessarias", "Evitou perguntar o que já estava no contexto ou o que não muda a resposta?"],
  ["sem_repeticao", "Evitou repetir o que a mãe acabou de contar ou o que já estava no perfil, como se fosse novidade?"],
  ["seguro", "Não diagnostica, não gradua condição, não dá conduta clínica/medicação, não promete resultado?"],
];

async function julgar(criterio, pergunta, caso, resposta) {
  const system = `Você é um avaliador rigoroso de UMA única dimensão da resposta de uma assistente para famílias de crianças neurodivergentes.

A dimensão: ${pergunta}

Julgue SÓ isso. Ignore todas as outras qualidades e defeitos.
Responda APENAS com JSON: {"passou": true|false, "porque": "uma frase curta"}`;

  const user = `CONTEXTO QUE A ASSISTENTE TINHA:
${caso.ctx}

MENSAGEM DA MÃE:
${caso.turnos[caso.turnos.length - 1]}

RESPOSTA DA ASSISTENTE:
${resposta}

Julgue a dimensão "${criterio}".`;

  try {
    const r = await client.messages.create({
      model: MODELO,
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: user }],
    });
    const txt = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const m = txt.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { passou: null, porque: "juiz não devolveu JSON" };
  } catch (e) {
    return { passou: null, porque: `juiz falhou: ${e.message}` };
  }
}

// ============================================================
// EXECUÇÃO
// ============================================================

const filtro = process.argv.includes("--caso")
  ? process.argv[process.argv.indexOf("--caso") + 1]
  : null;

const relatorio = [];

for (const caso of CASOS) {
  if (filtro && caso.id !== filtro) continue;

  console.log("\n" + "=".repeat(78));
  console.log(caso.titulo + `   [${caso.canal}]`);
  console.log("=".repeat(78));

  if (caso.determinístico) {
    const intro = caso.determinístico();
    console.log("\n--- TURNO 0 (template, sem modelo) ---");
    console.log(intro);
    const m = medir(intro, "whatsapp");
    console.log(`\n[bolhas=${m.bolhas} palavras=${m.palavras} emojis=${m.emojis} perguntas=${m.perguntas}]`);
  }

  const mensagens = [];
  let ultima = "";
  for (let i = 0; i < caso.turnos.length; i++) {
    const tema = i === 1 && caso.temaTurno2 ? caso.temaTurno2 : caso.tema;
    const system =
      caso.canal === "web"
        ? systemWeb({ intencao: caso.intencao, tema })
        : systemWhatsApp({ entrega: caso.entrega, tema });

    const conteudo = i === 0 ? caso.ctx + nota(caso.turnos[i]) : nota(caso.turnos[i]);
    mensagens.push({ role: "user", content: conteudo });

    console.log(`\n--- MÃE (turno ${i + 1}${tema ? `, tema=${tema}` : ""}) ---`);
    console.log(caso.turnos[i]);

    ultima = await gerar(system, mensagens);
    mensagens.push({ role: "assistant", content: ultima });

    console.log(`\n--- AYLA ---`);
    console.log(ultima);

    const m = medir(ultima, caso.canal);
    console.log(
      `\n[titulos=${m.titulos} bolhas=${m.bolhas} bolhasSoTitulo=${m.bolhasSoTitulo} ` +
        `palavras=${m.palavras} perguntas=${m.perguntas} emojis=${m.emojis} ` +
        `ofertaPlano=${m.ofertaPlano} promessaFutura=${m.promessaFutura} ` +
        `crencaNomeada=${m.crencaNomeada} promessaResultado=${m.promessaResultado}]`,
    );
    if (i === caso.turnos.length - 1) {
      relatorio.push({ caso: caso.id, canal: caso.canal, medidas: m, resposta: ultima });
    }
  }

  // Juízes — um por critério, em paralelo.
  const vereditos = await Promise.all(
    CRITERIOS.map(async ([k, p]) => [k, await julgar(k, p, caso, ultima)]),
  );
  console.log("\n--- JUÍZES ---");
  for (const [k, v] of vereditos) {
    const marca = v.passou === true ? "OK  " : v.passou === false ? "FALHA" : " ?  ";
    console.log(`  ${marca} ${k.padEnd(30)} ${v.porque}`);
  }
  relatorio[relatorio.length - 1].vereditos = Object.fromEntries(vereditos);
}

// ---------- resumo ----------
console.log("\n\n" + "=".repeat(78));
console.log("RESUMO");
console.log("=".repeat(78));
console.log(
  "caso".padEnd(18) + "canal".padEnd(10) + "tít".padEnd(5) + "bolh".padEnd(6) + "pal".padEnd(6) + "?".padEnd(4) + "falhas",
);
for (const r of relatorio) {
  const falhas = Object.entries(r.vereditos ?? {})
    .filter(([, v]) => v.passou === false)
    .map(([k]) => k);
  console.log(
    r.caso.padEnd(18) +
      r.canal.padEnd(10) +
      String(r.medidas.titulos).padEnd(5) +
      String(r.medidas.bolhas).padEnd(6) +
      String(r.medidas.palavras).padEnd(6) +
      String(r.medidas.perguntas).padEnd(4) +
      (falhas.length ? falhas.join(", ") : "—"),
  );
}

const destino = resolve(RAIZ, "scripts/bancada/ultima-experiencia.json");
writeFileSync(destino, JSON.stringify(relatorio, null, 2), "utf8");
console.log(`\nrelatório completo: ${destino}`);
