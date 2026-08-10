/**
 * PROVA COMPORTAMENTAL DA FATIA 1 — o Plano aprende com o feedback?
 *
 * Reproduz o caminho REAL da seção que ESCOLHE estratégia
 * (`o_que_fazer_diferente`): `assemblePrompt` com modo `output_type`, que é o
 * par exato de `respondAsOutputType`. O `pedido` recebe o `desafioComLastro`
 * montado como `plano.ts` monta.
 *
 * 4 braços: D (baseline, sem histórico) + A/B/C. Juízo CEGO e semântico.
 */
import { mod, ctxWeb, perfilSintetico, recuperarReal, supabaseStub,
  FAMILIA_PILOTO, linha, caixa } from "./comum.mjs";
import { writeFileSync, readFileSync } from "node:fs";
const { assemblePrompt } = await mod("lib/ia/prompt.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const out=[]; const w=(s)=>{out.push(s);console.log(s);};

// A regra REAL, lida do código de produção — nada reescrito à mão.
const SRC = readFileSync("apps/web/src/lib/ia/plano.ts","utf8");
const SISTEMA_APRENDIZADO = SRC.match(/const SISTEMA_APRENDIZADO = `([^`]+)`/)[1];
w("SISTEMA_APRENDIZADO (verbatim do código):\n  "+SISTEMA_APRENDIZADO+"\n");

const DESAFIO = "Quero trabalhar a comunicação da Manu: ela quase não fala com pessoas de fora, e eu queria ajudar nisso.";

const HIST = {
  D: null,
  A: `<o_que_ja_funcionou>\n- comunicação: NÃO funcionou — "tentei os cartões de escolha com figuras, ela ignorou completamente e ficou irritada"\n</o_que_ja_funcionou>`,
  B: `<o_que_ja_funcionou>\n- comunicação: funcionou — "combinar uma frase curta antes de sair de casa ajudou muito, ela usou no parque"\n</o_que_ja_funcionou>`,
  C: `<o_que_ja_funcionou>\n- comunicação: funcionou mais ou menos — "brincar de mercadinho em casa ela adorou e falou bastante, mas na padaria de verdade travou de novo"\n</o_que_ja_funcionou>`,
};

const MANU = { nome:"Manu", idade:6, perfil:"TEA", genero:"feminino",
  secoes:{ essencial:"Manu, 6 anos. INTERESSES: brincar de mercadinho, gatos.",
           comunicacao:"Fala frases completas em casa e com a prima. Com pessoas de fora, trava." },
  pc: perfilSintetico({ comunicacao:{label:"Comunicação",campos:[
        {key:"a",label:"fala frases completas em casa",estado:"preenchido"},
        {key:"b",label:"usa figuras/apontar",estado:"negativo"},
        {key:"c",label:"fala com desconhecidos",estado:"vazio"}]},
      interesses:{label:"Interesses",campos:[{key:"f",label:"interesses fortes",estado:"preenchido",valor:"mercadinho, gatos"}]} }) };

const OT = { key:"o_que_fazer_diferente", label:"O que fazer diferente",
  prompt_template:"A partir do diário recente, sugira uma mudança concreta de abordagem para um desafio recorrente. Aberto a hipóteses, sem afirmar a causa." };

const bps = await recuperarReal({ skill:"comunicacao", idade:6, relato:DESAFIO, comRanking:false });
w("BPs recuperadas (mecanismo atual do Plano, top-3 por peso):");
for(const b of bps) w("  - "+b.titulo.slice(0,70));

const R={};
for (const [k,hist] of Object.entries(HIST)) {
  const pedido = hist ? `${DESAFIO}\n\n${hist}\n${SISTEMA_APRENDIZADO}` : DESAFIO;
  const ctx = ctxWeb({ ...MANU, perfilConsultavel:null, base2:[], bps });
  const { system, messages } = assemblePrompt({
    skills:[{name:"comunicacao",display_name:"Comunicação",objective:"apoiar a comunicação",tone:"próximo",scope:"comunicação",limits:"não diagnostica",kolo_vivo_fields:["essencial","comunicacao"],knowledge_tags:["comunicacao"]}],
    ctx, userInput: pedido, modo:{ kind:"output_type", outputType: OT },
  });
  const r = await gerarConversacional({ provider:"openai", model:MODELO_CONVERSA.openai,
    system: system.map(b=>b.text).join("\n\n"), messages, maxTokens:1400, cacheSystem:true });
  R[k]=r.texto.trim();
  w(`\n${linha()}\nBRAÇO ${k}${hist?"":"  (BASELINE — sem histórico)"}\n${hist?"feedback: "+hist.split("\n")[1]:""}\n`);
  w(caixa(R[k]));
}

// ── JUÍZO CEGO E SEMÂNTICO ───────────────────────────────────────────────
const sys = `Você compara propostas de intervenção para a MESMA criança e o MESMO objetivo.

Uma delas (a REFERÊNCIA) foi feita sem nenhum histórico. As outras foram feitas depois de um feedback da família sobre uma tentativa anterior.

Julgue SEMANTICAMENTE. Mudar as palavras NÃO é mudar a estratégia. Compare: mecanismo da intervenção, ação concreta proposta, nível de desafio, e relação com o feedback.

Para CADA proposta responda EXATAMENTE neste formato:
### P1
MECANISMO: <o mecanismo central em até 12 palavras>
PRESERVOU: <o que manteve da tentativa anterior, ou "nada">
ABANDONOU: <o que deixou de fora, ou "nada">
EVOLUIU: <o que avançou/variou, ou "nada">
USOU_O_FEEDBACK: SIM|NAO|<justificativa curta>
REPETE_O_QUE_FALHOU: SIM|NAO|<justificativa curta>
VEREDITO: PASS|FAIL|<uma frase>`;

const user = `OBJETIVO: "${DESAFIO}"

REFERÊNCIA (sem histórico):
"""
${R.D}
"""

--- P1 · feedback recebido: a família disse que NÃO funcionou — "tentei os cartões de escolha com figuras, ela ignorou completamente e ficou irritada"
"""
${R.A}
"""

--- P2 · feedback recebido: FUNCIONOU — "combinar uma frase curta antes de sair de casa ajudou muito, ela usou no parque"
"""
${R.B}
"""

--- P3 · feedback recebido: FUNCIONOU MAIS OU MENOS — "brincar de mercadinho em casa ela adorou e falou bastante, mas na padaria de verdade travou de novo"
"""
${R.C}
"""`;

const j = await gerarConversacional({ provider:"openai", model:MODELO_CONVERSA.openai, system:sys, messages:[{role:"user",content:user}], maxTokens:1800, cacheSystem:true });
w(`\n\n${linha()}\nJUÍZO SEMÂNTICO\n`); w(caixa(j.texto.trim()));
writeFileSync(`${process.cwd()}/docs/bancada/plano-fatia1-aprendizado-2026-08-10.txt`, out.join("\n"), "utf8");
