/**
 * ATIVAÇÃO — a mãe não precisa saber usar a Kolo.
 *
 * Mede o que a Ayla faz quando a família não sabe o que pedir, e o que ela NÃO
 * faz quando o pedido já é específico (não pode virar menu).
 */
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
const WEB = new URL("../../apps/web/", import.meta.url);
const env = readFileSync(new URL(".env.local", WEB), "utf8");
const g = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
process.env.ANTHROPIC_API_KEY = g("ANTHROPIC_API_KEY");
const { registerHooks } = await import("node:module");
registerHooks({ resolve(e,c,n){ if(e.startsWith(".")&&!/\.[a-z]+$/.test(e)){try{return n(`${e}.ts`,c)}catch{}} return n(e,c);} });
registerHooks({ resolve(e,c,n){ if(e.startsWith("@/")) return n(new URL(`src/${e.slice(2)}.ts`,WEB).href,c); return n(e,c);} });
registerHooks({ resolve(e,c,n){ if(e==="next/headers"||e==="next/cache") return {url:"data:text/javascript,export const cookies=()=>{};export const headers=()=>{};export const revalidatePath=()=>{};export const revalidateTag=()=>{};",shortCircuit:true}; return n(e,c);} });
const { nucleoConducao } = await import(new URL("src/lib/conducao/diretrizes.ts", WEB).href);
const { FORMATO_WHATSAPP } = await import(new URL("src/lib/ayla/responder.ts", WEB).href);
const { formasDeEntrega, INTERESSE_COMO_VEICULO, A_CRIANCA_ANTES_DO_ROTULO } = await import(new URL("src/lib/conducao/formas.ts", WEB).href);
const { classificarIntencao } = await import(new URL("src/lib/ayla/intent.ts", WEB).href);
const { pediuRotinaExplicitamente } = await import(new URL("src/lib/ayla/rotina-guiada.ts", WEB).href);
const cli = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PERFIL_CHEIO = `PERFIL: Théo, 6 anos, TEA (laudo).
DESAFIOS QUE A FAMÍLIA MARCOU NO CADASTRO: as emoções e as crises, o sono, a alimentação.
Interesses: dinossauros.`;
const PERFIL_VAZIO = `PERFIL: Lia, 5 anos. (nada mais informado)`;

const CASOS = [
  { id:"1 perdida", perfil:PERFIL_CHEIO, mae:"Estou perdida com meu filho.", quer:"caminhos" },
  { id:"2 tudo junto", perfil:PERFIL_CHEIO, mae:"Tem tanta coisa: sono, escola, crises e alimentação.", quer:"caminhos" },
  { id:"3 rotina", perfil:PERFIL_CHEIO, mae:"Quero uma rotina da tarde.", quer:"direto" },
  { id:"4 plano", perfil:PERFIL_CHEIO, mae:"Quero um plano para desenvolver pinça.", quer:"direto" },
  { id:"5 o que pedir", perfil:PERFIL_CHEIO, mae:"Não sei nem o que posso pedir aqui.", quer:"capacidades" },
  { id:"6 onboarding cheio", perfil:PERFIL_CHEIO, mae:"Oi, cheguei agora. Não sei por onde começar.", quer:"caminhos" },
  { id:"7 onboarding vazio", perfil:PERFIL_VAZIO, mae:"Oi, cheguei agora. Não sei por onde começar.", quer:"nao_inventa" },
  { id:"10 desafio concreto", perfil:PERFIL_CHEIO, mae:"Ele grita e se joga no chão toda vez que a gente precisa sair de casa de manhã. Já tentei avisar antes.", quer:"estrategia" },
];

const FERRAMENTAS = /plano estratégico|rotina visual|relatório|história social|cartões ilustrados/i;
const FERRAMENTAS_G = /plano estratégico|rotina visual|relatório|história social|cartões ilustrados/gi;
const R = [];
for (const c of CASOS) {
  const cl = await classificarIntencao({ texto: c.mae, temasOnboarding: ["emocional","sono","nutricional"] });
  const especifico = cl.intencao !== "outro" || pediuRotinaExplicitamente(c.mae);
  const sistema = `${nucleoConducao()}\n\n${FORMATO_WHATSAPP}\n\n${formasDeEntrega({canal:"whatsapp"})}\n\n${INTERESSE_COMO_VEICULO}\n\n${A_CRIANCA_ANTES_DO_ROTULO}`;
  const r = await cli.messages.create({ model:"claude-sonnet-4-5-20250929", max_tokens:900, system:sistema,
    messages:[{role:"user",content:`${c.perfil}\n\n<mensagem_de_agora>${c.mae}</mensagem_de_agora>`}]});
  const t = r.content.filter(b=>b.type==="text").map(b=>b.text).join("");
  console.log("\n"+"█".repeat(74)+`\nCASO ${c.id}  — "${c.mae}"\n`+"█".repeat(74));
  console.log(`[intencao=${cl.intencao} → ${especifico?"ROTEIA direto":"conversa"}]\n`);
  console.log(t.slice(0,1100));

  let ok=true, nota="";
  if (c.quer==="caminhos") {
    // O PORTÃO é organizar os pontos sem nomear ferramenta. Recomendar por onde
    // começar é o alvo, mas a spec admite "deixa escolher" quando são muitos
    // temas — então entra como MEDIDA, não como portão: perseguir isso seria
    // ajustar o prompt contra a variação do modelo.
    const temPontos = /1[\.\)]|•|—\s|primeiro|segundo/i.test(t) || t.split("\n").filter(l=>l.trim()).length>=4;
    const recomenda = /eu começaria|eu pegaria|eu iria primeiro|comece(mos)? p|começa(mos)? p/i.test(t);
    ok = temPontos && !FERRAMENTAS.test(t);
    nota = `pontos=${temPontos} semFerramenta=${!FERRAMENTAS.test(t)} | recomendou=${recomenda}`;
  } else if (c.quer==="direto") {
    ok = especifico;
    nota = `roteou=${especifico}`;
  } else if (c.quer==="capacidades") {
    // O portão é não virar CATÁLOGO. Citar um recurso dentro do problema
    // ("montamos uma rotina visual que ajuda ele a saber o que vem antes de
    // dormir") é boa escrita; o que não pode é a resposta ser uma lista de
    // nomes. Mede-se por quantos nomes distintos aparecem.
    const nomes = new Set((t.match(FERRAMENTAS_G) ?? []).map((x) => x.toLowerCase()));
    const porProblema = /se (ele|ela|o|a)|quando (a|o|ele|ela)|está (difícil|complicado|pesado)/i.test(t);
    ok = nomes.size <= 1 && porProblema;
    nota = `nomesCitados=${nomes.size} porProblema=${porProblema}`;
  } else if (c.quer==="nao_inventa") {
    ok = !/emoç|crise|sono|aliment/i.test(t);
    nota = `naoInventou=${ok}`;
  } else if (c.quer==="estrategia") {
    ok = /em vez de|experimente|tente|você pode (dizer|falar)|eu (começaria|faria)|o que eu faria|no lugar de/i.test(t);
    nota = `entregou=${ok}`;
  }
  console.log(`\n   ➜ ${ok?"ok":"FALHA"}  ${nota}`);
  R.push({id:c.id, ok, nota});
}
console.log("\n"+"═".repeat(74));
for(const r of R) console.log(`${r.ok?"  ok ":"FALHA"}  ${r.id.padEnd(22)} ${r.nota}`);
const f=R.filter(x=>!x.ok);
console.log(`\n${R.length-f.length}/${R.length}`);
