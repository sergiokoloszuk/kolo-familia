/**
 * O PLACAR DA ARENA DE VALOR.
 *
 * ⚠️ O NÚMERO QUE DECIDE É A TAXA DE NÍVEL 3, não a média. Uma média sobe com
 * muitas respostas "2" e não responde à pergunta da missão, que é sobre a
 * família perceber valor — e isso acontece no 3, não no 2.
 *
 * ⚠️ O GANHO DE CADA CAMADA É MEDIDO EM PAR, não por ranking global:
 *   Pós  = (B−A) e (D−C) e (F−E)
 *   BP   = (C−A) e (D−B) e (F−E' )
 *   DNA  = (E−A) e (F−D)
 * Comparar só os extremos esconderia qual camada carrega o ganho.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const AQUI = dirname(fileURLToPath(import.meta.url));
type J = Record<string, any>;
const J: J[] = JSON.parse(readFileSync(resolve(AQUI, "resultados", "julgamentos.json"), "utf8"));
const G: J[] = JSON.parse(readFileSync(resolve(AQUI, "resultados", "geracoes.json"), "utf8"));
const BR = ["A","B","C","D","E","F"];
const NOME: Record<string,string> = { A:"atual", B:"+Pós", C:"+BP", D:"+Pós+BP", E:"+DNA", F:"+Pós+BP+DNA" };
const por = (b:string) => J.filter(j=>j.braco===b);
const pct = (n:number,d:number)=> d? (100*n/d).toFixed(0)+"%" : "—";
const taxa3 = (b:string)=>{const d=por(b);return d.length? d.filter(j=>j.valor_kolo===3).length/d.length : 0;};

console.log("\n=== PLACAR VALOR KOLO ===\n");
console.log("braço        n    média   nív0   nív1   nív2   NÍV3   pagaria  entrega  interesse  óbvio  jargão");
console.log("-".repeat(104));
for (const b of BR) {
  const d = por(b); if (!d.length) continue;
  const m = (d.reduce((a,j)=>a+(j.valor_kolo??0),0)/d.length).toFixed(2);
  const c = (n:number)=>d.filter(j=>j.valor_kolo===n).length;
  console.log(
    (b+" "+NOME[b]).padEnd(13)+String(d.length).padStart(3)+"   "+m.padStart(5)+"  "+
    pct(c(0),d.length).padStart(5)+"  "+pct(c(1),d.length).padStart(5)+"  "+pct(c(2),d.length).padStart(5)+"  "+
    pct(c(3),d.length).padStart(5)+"  "+pct(d.filter(j=>j.pagaria).length,d.length).padStart(7)+"  "+
    pct(d.filter(j=>j.entregou_concreto).length,d.length).padStart(7)+"  "+
    pct(d.filter(j=>j.usou_interesse).length,d.length).padStart(9)+"  "+
    pct(d.filter(j=>j.obvio).length,d.length).padStart(5)+"  "+
    pct(d.filter(j=>j.jargao).length,d.length).padStart(6));
}

console.log("\n=== ASK × DELIVER (primeira ação) ===\n");
const ACOES=["DELIVER","ASK_DELIVER","ASK","SAFETY","ACKNOWLEDGE"];
console.log("braço        "+ACOES.map(a=>a.padStart(12)).join(""));
for (const b of BR){const d=por(b); if(!d.length)continue;
  console.log((b+" "+NOME[b]).padEnd(13)+ACOES.map(a=>pct(d.filter(j=>j.primeira_acao===a).length,d.length).padStart(12)).join(""));}

console.log("\n=== NOS PEDIDOS EXPLÍCITOS DE ENTREGA (tipo entrega_direta) ===\n");
for (const b of BR){const d=por(b).filter(j=>j.tipo==="entrega_direta"); if(!d.length)continue;
  console.log((b+" "+NOME[b]).padEnd(13)+"DELIVER "+pct(d.filter(j=>["DELIVER","ASK_DELIVER"].includes(j.primeira_acao)).length,d.length).padStart(5)+
    " | nível3 "+pct(d.filter(j=>j.valor_kolo===3).length,d.length).padStart(5)+" | concreto "+pct(d.filter(j=>j.entregou_concreto).length,d.length).padStart(5));}

console.log("\n=== PERSEVERAÇÃO DE SEGURANÇA (caso T4, turnos 3-5) ===\n");
for (const b of BR){const d=por(b).filter(j=>j.caso==="T4-seguranca"&&j.turno>=3); if(!d.length)continue;
  console.log((b+" "+NOME[b]).padEnd(13)+"repetiu segurança em "+pct(d.filter(j=>j.seguranca_excessiva||j.primeira_acao==="SAFETY").length,d.length).padStart(5)+" dos turnos 3-5 (n="+d.length+")");}

console.log("\n=== PERGUNTOU O QUE O PERFIL JÁ SABIA ===\n");
for (const b of BR){const d=por(b); if(!d.length)continue;
  console.log((b+" "+NOME[b]).padEnd(13)+pct(d.filter(j=>j.perguntou_o_sabido).length,d.length).padStart(5)+"  | usou o perfil: "+pct(d.filter(j=>j.usou_perfil).length,d.length));}

console.log("\n=== GANHO POR CAMADA (pontos percentuais de nível 3) ===\n");
const t3=(b:string)=>taxa3(b)*100;
console.log(`PÓS  : B−A ${(t3("B")-t3("A")).toFixed(0).padStart(4)}pp · D−C ${(t3("D")-t3("C")).toFixed(0).padStart(4)}pp · F−E ${(t3("F")-t3("E")).toFixed(0).padStart(4)}pp`);
console.log(`BP   : C−A ${(t3("C")-t3("A")).toFixed(0).padStart(4)}pp · D−B ${(t3("D")-t3("B")).toFixed(0).padStart(4)}pp`);
console.log(`DNA  : E−A ${(t3("E")-t3("A")).toFixed(0).padStart(4)}pp · F−D ${(t3("F")-t3("D")).toFixed(0).padStart(4)}pp`);

console.log("\n=== VENCEDOR POR CASO (quantas vezes o juiz elegeu 'melhor') ===\n");
const casos=[...new Set(J.map(j=>j.caso))];
console.log("caso".padEnd(18)+BR.map(b=>b.padStart(4)).join("")+"   tipo");
for (const c of casos){const d=J.filter(j=>j.caso===c);
  console.log(c.padEnd(18)+BR.map(b=>String(d.filter(j=>j.braco===b&&j.foi_melhor).length).padStart(4)).join("")+"   "+(d[0]?.tipo??""));}
console.log("\nTOTAL".padEnd(18)+BR.map(b=>String(por(b).filter(j=>j.foi_melhor).length).padStart(4)).join(""));
console.log("PIOR ".padEnd(18)+BR.map(b=>String(por(b).filter(j=>j.foi_pior).length).padStart(4)).join(""));

console.log("\n=== CUSTO E LATÊNCIA (das gerações) ===\n");
for (const b of BR){const d=G.filter(g=>g.braco===b); if(!d.length)continue;
  const ms=d.map(g=>g.ms).sort((a,b)=>a-b);
  const tin=d.reduce((a,g)=>a+g.tokensIn,0), tout=d.reduce((a,g)=>a+g.tokensOut,0);
  const usd=(tin*0.28+tout*2.2)/1e6;
  console.log((b+" "+NOME[b]).padEnd(13)+"system "+String(Math.round(d.reduce((a,g)=>a+g.charsSystem,0)/d.length)).padStart(6)+" chars | in "+String(tin).padStart(7)+" out "+String(tout).padStart(6)+" | USD "+usd.toFixed(4)+" | p50 "+String(ms[Math.floor(ms.length/2)]).padStart(5)+"ms | resposta "+String(Math.round(d.reduce((a,g)=>a+g.fala.length,0)/d.length)).padStart(4)+" chars");}
