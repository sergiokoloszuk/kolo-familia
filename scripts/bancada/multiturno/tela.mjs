/**
 * TELA CEGA MULTITURNO — a unidade é a JORNADA, não a resposta.
 *
 * Reaproveita as duas rubricas já commitadas: os 20 critérios por resposta
 * (`ab-conversa/tela.mjs`) e os 10 da jornada (`jornadas.mjs`). Mantém o que
 * já funcionava: embaralhamento balanceado, revelação travada até o fim,
 * export CSV/JSON, localStorage.
 *
 * A adaptação mínima: cada cartão passa a ser uma CONVERSA inteira (mãe/Ayla
 * alternando), com as respostas individuais expansíveis. Avaliar 252 respostas
 * uma a uma seria impraticável — e premiaria uma resposta bonita isolada
 * dentro de uma conversa ruim, que é exatamente o que não queremos.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const { respostas: R } = JSON.parse(readFileSync(resolve(AQUI, "resultados.json"), "utf8"));
const { JORNADAS, RUBRICA_JORNADA } = await import(new URL("./jornadas.mjs", import.meta.url).href);
const { CRITERIOS } = await import(
  new URL("../ab-conversa/tela.mjs", import.meta.url).href
);

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const leve = (t) =>
  esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/\n/g, "<br>");

// Uma rodada só na tela — avaliar 3× a mesma conversa cansa e não acrescenta.
// A consistência entre rodadas já saiu no agregado automático.
const RODADA = 2;

const unidades = [];
for (const canal of ["whatsapp", "web"]) {
  for (const j of JORNADAS) {
    const conv = (braco) =>
      R.filter((r) => r.rodada === RODADA && r.canal === canal && r.jornada === j.id && r.braco === braco)
        .sort((a, b) => a.turno - b.turno);
    unidades.push({ id: `${canal}_${j.id}`, canal, titulo: j.titulo, olhar: j.olhar, claude: conv("claude"), gpt: conv("gpt") });
  }
}
// Embaralhamento balanceado: A/B alterna por índice, e o mapa fica só no JS.
unidades.forEach((u, i) => (u.ordem = i % 2 === 0 ? ["claude", "gpt"] : ["gpt", "claude"]));

const cartao = (u, braco, rot) => {
  const turnos = u[braco]
    .map(
      (t) => `<div class="turno"><div class="mae"><b>Mãe</b> ${esc(t.fala)}</div>
<div class="ayla"><b>Ayla</b> ${leve(t.texto)}</div>
<div class="meta">${t.palavras}p · ${t.perguntas} pergunta(s) · ${(t.ms / 1000).toFixed(1)}s${t.sinais.length ? " · " + t.sinais.join(", ") : ""}${t.fronteira ? ` · <span class="reveal oculto">⚠ ${t.fronteira}</span>` : ""}</div></div>`,
    )
    .join("");
  return `<div class="cartao">
<div class="rot">Conversa ${rot}<span class="reveal oculto"> — ${braco === "claude" ? "CLAUDE" : "GPT"}</span></div>
<div class="conversa">${turnos}</div>
<table class="notas"><tr><th colspan="2">A JORNADA COMO UM TODO</th></tr>${RUBRICA_JORNADA.map(
    ([k, l]) =>
      `<tr><td>${l}</td><td class="bt">${[1, 2, 3, 4, 5].map((n) => `<button data-u="${u.id}" data-b="${braco}" data-c="j_${k}" data-n="${n}">${n}</button>`).join("")}</td></tr>`,
  ).join("")}</table>
<details><summary>critérios por resposta (opcional)</summary><table class="notas">${CRITERIOS.map(
    ([k, l]) =>
      `<tr><td>${l}</td><td class="bt">${[1, 2, 3, 4, 5].map((n) => `<button data-u="${u.id}" data-b="${braco}" data-c="r_${k}" data-n="${n}">${n}</button>`).join("")}</td></tr>`,
  ).join("")}</table></details>
<textarea placeholder="Comentário" data-u="${u.id}" data-b="${braco}"></textarea></div>`;
};

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Bancada multiturno — avaliação cega</title>
<style>
:root{--bg:#faf9f7;--fg:#1c1a19;--mut:#6b6560;--lin:#e5e0da;--card:#fff;--ac:#6b4ea8}
@media(prefers-color-scheme:dark){:root{--bg:#161512;--fg:#efeae4;--mut:#9d958c;--lin:#2e2a26;--card:#1e1c19;--ac:#b39ae0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
header{position:sticky;top:0;z-index:9;background:var(--bg);border-bottom:1px solid var(--lin);padding:12px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:16px;margin:0;font-weight:600}.prog{color:var(--mut);font-size:14px;font-variant-numeric:tabular-nums}
button.acao{border:1px solid var(--lin);background:var(--card);color:var(--fg);border-radius:99px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer}
button.acao:disabled{opacity:.4;cursor:not-allowed}
main{max-width:1500px;margin:0 auto;padding:24px 20px 120px}
section{margin:0 0 52px;padding-bottom:36px;border-bottom:1px solid var(--lin)}
h2{font-size:18px;margin:0 0 6px}.canal{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);border:1px solid var(--lin);border-radius:99px;padding:2px 9px;margin-left:8px}
.olhar{font-size:14px;color:var(--mut);margin-bottom:14px}
.par{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.cartao{background:var(--card);border:1px solid var(--lin);border-radius:14px;padding:16px}
.rot{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-bottom:12px}
.reveal{color:var(--ac);font-weight:600}.oculto{display:none}
.turno{border-top:1px solid var(--lin);padding:10px 0}.turno:first-child{border-top:0}
.mae{font-size:14px;color:var(--mut);margin-bottom:6px}.mae b,.ayla b{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px}
.ayla{font-size:15px}.ayla b{color:var(--ac)}
.meta{margin-top:6px;font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums}
.notas{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
.notas th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);padding-top:8px}
.notas td{padding:3px 0}.notas td:first-child{color:var(--mut)}
.bt{text-align:right;white-space:nowrap}
.bt button{width:26px;height:26px;margin-left:3px;border:1px solid var(--lin);background:transparent;color:var(--mut);border-radius:6px;cursor:pointer;font:inherit;font-size:12px}
.bt button.on{background:var(--ac);border-color:var(--ac);color:#fff}
details summary{cursor:pointer;color:var(--mut);font-size:13px;margin-top:10px}
textarea{margin-top:10px;width:100%;min-height:50px;background:transparent;border:1px solid var(--lin);border-radius:8px;padding:8px;color:var(--fg);font:inherit;font-size:13px}
@media(max-width:900px){.par{grid-template-columns:1fr}}
</style></head><body>
<header><h1>Bancada multiturno — avaliação cega</h1><span class="prog" id="prog"></span>
<button class="acao" id="revelar" disabled>Revelar</button>
<button class="acao" id="csv">CSV</button><button class="acao" id="json">JSON</button><button class="acao" id="limpar">Limpar</button></header>
<main>${unidades
  .map(
    (u) => `<section><h2>${esc(u.titulo)}<span class="canal">${u.canal}</span></h2>
<div class="olhar">${esc(u.olhar ?? "")}</div>
<div class="par">${u.ordem.map((b, i) => cartao(u, b, "AB"[i])).join("")}</div></section>`,
  )
  .join("")}</main>
<script>
const UNID=${JSON.stringify(unidades.map((u) => ({ id: u.id, canal: u.canal, ordem: u.ordem })))};
const NJ=${RUBRICA_JORNADA.length};
const CHAVE="kolo-multiturno-v1";
let notas=JSON.parse(localStorage.getItem(CHAVE)||"{}");
const total=UNID.length*2*NJ;
function feitas(){let n=0;for(const u of Object.values(notas))for(const b of Object.values(u))n+=Object.keys(b.notas||{}).filter(k=>k.startsWith("j_")).length;return n;}
function atualizar(){const f=feitas();document.getElementById("prog").textContent=f+" de "+total+" notas de jornada";document.getElementById("revelar").disabled=f<total;}
document.addEventListener("click",e=>{const b=e.target.closest(".bt button");if(!b)return;
const{u,b:br,c,n}=b.dataset;notas[u]??={};notas[u][br]??={notas:{}};notas[u][br].notas[c]=+n;
b.parentElement.querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");
localStorage.setItem(CHAVE,JSON.stringify(notas));atualizar();});
document.addEventListener("input",e=>{const t=e.target.closest("textarea");if(!t)return;
const{u,b}=t.dataset;notas[u]??={};notas[u][b]??={notas:{}};notas[u][b].comentario=t.value;
localStorage.setItem(CHAVE,JSON.stringify(notas));});
document.getElementById("revelar").onclick=()=>{document.querySelectorAll(".reveal").forEach(e=>e.classList.remove("oculto"));
const s={};for(const[u,bs]of Object.entries(notas))for(const[b,d]of Object.entries(bs)){s[b]??={t:0,n:0};
for(const[k,v]of Object.entries(d.notas||{}))if(k.startsWith("j_")){s[b].t+=v;s[b].n++;}}
alert("MÉDIA DA JORNADA\\n\\n"+Object.entries(s).map(([k,v])=>(k==="claude"?"CLAUDE":"GPT")+": "+(v.t/v.n).toFixed(2)+" / 5").join("\\n"));};
function baixar(n,t,tp){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:tp}));a.download=n;a.click();}
document.getElementById("json").onclick=()=>baixar("notas-multiturno.json",JSON.stringify(notas,null,2),"application/json");
document.getElementById("csv").onclick=()=>{const l=["unidade,canal,braco,criterio,nota"];
for(const[u,bs]of Object.entries(notas))for(const[b,d]of Object.entries(bs))for(const[k,v]of Object.entries(d.notas||{}))l.push([u,UNID.find(x=>x.id===u)?.canal??"",b,k,v].join(","));
baixar("notas-multiturno.csv",l.join("\\n"),"text/csv");};
document.getElementById("limpar").onclick=()=>{if(!confirm("Apagar notas?"))return;notas={};localStorage.removeItem(CHAVE);
document.querySelectorAll(".bt button.on").forEach(b=>b.classList.remove("on"));document.querySelectorAll("textarea").forEach(t=>t.value="");
document.querySelectorAll(".reveal").forEach(e=>e.classList.add("oculto"));atualizar();};
for(const[u,bs]of Object.entries(notas))for(const[b,d]of Object.entries(bs)){
for(const[k,v]of Object.entries(d.notas||{}))document.querySelectorAll('button[data-u="'+u+'"][data-b="'+b+'"][data-c="'+k+'"]').forEach(x=>x.classList.toggle("on",+x.dataset.n===v));
const t=document.querySelector('textarea[data-u="'+u+'"][data-b="'+b+'"]');if(t&&d.comentario)t.value=d.comentario;}
atualizar();
</script></body></html>`;

writeFileSync(resolve(AQUI, "avaliacao-cega.html"), html, "utf8");
console.log(`✓ avaliacao-cega.html · ${unidades.length} jornadas × 2 braços · rodada ${RODADA}`);
console.log(`  ordem: ${unidades.filter((u) => u.ordem[0] === "claude").length} com Claude em A, ${unidades.filter((u) => u.ordem[0] === "gpt").length} com GPT em A`);
