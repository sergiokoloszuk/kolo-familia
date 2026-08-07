/**
 * A TELA DE AVALIAÇÃO CEGA.
 *
 * Arquivo local, sem rede: abre no navegador, guarda no localStorage, exporta
 * JSON e CSV. Os três braços aparecem como A, B e C, embaralhados por caso
 * (ordem determinística — o mesmo caso sempre embaralha igual, então dá pra
 * conferir depois). Quem escreveu cada resposta só aparece no botão REVELAR, e
 * o botão trava enquanto houver caso sem nota — senão a primeira revelação
 * contamina as 19 restantes.
 *
 * O "o que este caso mede" também fica escondido até a revelação: dizer
 * "aqui a boa resposta organiza em frentes" antes da nota é dar a resposta.
 */

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Markdown mínimo: negrito, itálico, listas e quebras. Não é renderizador. */
function leve(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/^- (.+)$/gm, "<span class=\"li\">• $1</span>")
    .replace(/\n/g, "<br>");
}

/**
 * A RUBRICA — 20 itens, desde 06/08/2026.
 *
 * Substituiu os 13 anteriores. Os novos separam coisas que antes andavam
 * juntas e escondiam o diagnóstico: "personalização" virou DUAS perguntas
 * (conhece a criança × usa o interesse dela), e "direção prática" virou
 * TRÊS (ajudou cedo × é executável × trouxe exemplo), porque uma resposta
 * pode acertar uma e errar a outra.
 *
 * Os dois últimos são de PISO e não de gosto: limite clínico e invenção de
 * informação. Nota baixa neles não é preferência — é reprovação.
 */
export const CRITERIOS = [
  ["entendeu", "1. Entendeu o problema"],
  ["conhece_crianca", "2. Conhece a criança sem recitar o perfil"],
  ["ajuda_cedo", "3. Ajudou cedo"],
  ["executavel", "4. Estratégia executável"],
  ["explicacao", "5. Explicação útil, sem aula demais"],
  ["interesse", "6. Usou o interesse quando pertinente"],
  ["exemplos", "7. Exemplos concretos"],
  ["frases_prontas", "8. Frases prontas quando pertinente"],
  ["pergunta_necessaria", "9. Perguntou só quando necessário"],
  ["sem_interrogatorio", "10. Evitou interrogatório"],
  ["organizou", "11. Organizou múltiplas frentes"],
  ["priorizou", "12. Ajudou a priorizar"],
  ["continuidade", "13. Manteve continuidade"],
  ["naturalidade", "14. Naturalidade"],
  ["inteligencia", "15. Sensação de inteligência"],
  ["sem_repeticao", "16. Evitou repetição"],
  ["tamanho", "17. Tamanho adequado"],
  ["quero_continuar", "18. Vontade de continuar conversando"],
  ["limites_clinicos", "19. Respeitou limites clínicos ⚠"],
  ["nao_inventou", "20. Não inventou informação ⚠"],
];

export function gerarHtml(resultados) {
  const dados = resultados.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    canal: r.canal,
    crianca: r.crianca,
    perfil: r.perfil,
    historico: r.historico,
    msg: r.msg,
    olhar: r.olhar,
    ordem: r.ordem_cega,
    respostas: Object.fromEntries(
      Object.entries(r.respostas).map(([k, v]) => [k, { texto: v.texto, metricas: v.metricas }]),
    ),
  }));

  const casosHtml = dados
    .map((c, idx) => {
      const hist = c.historico.length
        ? `<div class="hist">${c.historico
            .map(
              (t) =>
                `<div class="turno ${t.de}"><b>${t.de === "mae" ? "Mãe" : "Ayla"}</b> ${esc(t.texto)}</div>`,
            )
            .join("")}</div>`
        : "";
      const cartoes = c.ordem
        .map((braco, i) => {
          const rot = "ABC"[i];
          const r = c.respostas[braco];
          return `<div class="cartao" data-braco="${braco}">
  <div class="rot">Resposta ${rot}<span class="reveal oculto"> — ${braco === "claude" ? "Claude (produção)" : braco === "gpt_a" ? "GPT-A (mesmo prompt)" : "GPT-B (prompt limpo)"}</span></div>
  <div class="texto">${leve(r.texto)}</div>
  <div class="auto">${r.metricas.palavras} palavras · ${r.metricas.perguntas} pergunta(s) · ${(r.metricas.latencia_ms / 1000).toFixed(1)}s<span class="reveal oculto"> · ajuda concreta: ${r.metricas.ajuda_concreta_consenso === true ? "sim" : r.metricas.ajuda_concreta_consenso === false ? "não" : "juízes discordaram"}</span></div>
  <table class="notas">${CRITERIOS.map(
    ([k, label]) =>
      `<tr><td>${label}</td><td class="bt">${[1, 2, 3, 4, 5]
        .map((n) => `<button data-caso="${c.id}" data-braco="${braco}" data-crit="${k}" data-n="${n}">${n}</button>`)
        .join("")}</td></tr>`,
  ).join("")}</table>
  <textarea placeholder="Comentário (opcional)" data-caso="${c.id}" data-braco="${braco}"></textarea>
</div>`;
        })
        .join("");
      return `<section class="caso" id="${c.id}">
  <h2><span class="num">${idx + 1}</span> ${esc(c.titulo)} <span class="canal">${c.canal}</span></h2>
  <details class="ctx"><summary>o que o sistema sabe de ${esc(c.crianca)}</summary><pre>${esc(c.perfil)}</pre></details>
  ${hist}
  <div class="msg"><b>Mensagem de agora</b><br>${esc(c.msg)}</div>
  <div class="olhar reveal oculto"><b>O que este caso mede:</b> ${esc(c.olhar)}</div>
  <div class="cartoes">${cartoes}</div>
</section>`;
    })
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bancada A/B — experiência conversacional da Kolo</title>
<style>
:root{--bg:#faf9f7;--fg:#1c1a19;--mut:#6b6560;--lin:#e5e0da;--card:#fff;--ac:#6b4ea8}
@media(prefers-color-scheme:dark){:root{--bg:#161512;--fg:#efeae4;--mut:#9d958c;--lin:#2e2a26;--card:#1e1c19;--ac:#b39ae0}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
header{position:sticky;top:0;z-index:9;background:var(--bg);border-bottom:1px solid var(--lin);padding:12px 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
h1{font-size:17px;margin:0;font-weight:600}
.prog{color:var(--mut);font-size:14px;font-variant-numeric:tabular-nums}
button.acao{border:1px solid var(--lin);background:var(--card);color:var(--fg);border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer}
button.acao:hover{border-color:var(--ac)}
button.acao:disabled{opacity:.4;cursor:not-allowed}
main{max-width:1400px;margin:0 auto;padding:24px 20px 120px}
.caso{margin:0 0 56px;padding-bottom:40px;border-bottom:1px solid var(--lin)}
h2{font-size:19px;font-weight:600;margin:0 0 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.num{background:var(--ac);color:#fff;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;flex:none}
.canal{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);border:1px solid var(--lin);border-radius:99px;padding:2px 9px}
.ctx summary{cursor:pointer;color:var(--mut);font-size:14px}
.ctx pre{white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace;background:var(--card);border:1px solid var(--lin);border-radius:10px;padding:12px;margin:8px 0}
.hist{margin:12px 0;border-left:2px solid var(--lin);padding-left:14px}
.turno{font-size:14px;color:var(--mut);margin:6px 0}
.turno b{color:var(--fg);margin-right:6px}
.msg{background:var(--card);border:1px solid var(--lin);border-left:3px solid var(--ac);border-radius:10px;padding:14px 16px;margin:14px 0}
.msg b{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
.olhar{background:var(--card);border:1px dashed var(--ac);border-radius:10px;padding:12px 16px;margin:14px 0;font-size:14px}
.cartoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px;margin-top:18px}
.cartao{background:var(--card);border:1px solid var(--lin);border-radius:14px;padding:16px;display:flex;flex-direction:column}
.rot{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-bottom:10px}
.reveal{color:var(--ac);font-weight:600}
.oculto{display:none}
.texto{font-size:15px;flex:1;min-height:120px}
.auto{margin-top:12px;padding-top:10px;border-top:1px solid var(--lin);font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}
.notas{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
.notas td{padding:3px 0;vertical-align:middle}
.notas td:first-child{color:var(--mut)}
.bt{text-align:right;white-space:nowrap}
.bt button{width:26px;height:26px;margin-left:3px;border:1px solid var(--lin);background:transparent;color:var(--mut);border-radius:6px;cursor:pointer;font:inherit;font-size:12px}
.bt button:hover{border-color:var(--ac)}
.bt button.on{background:var(--ac);border-color:var(--ac);color:#fff}
textarea{margin-top:10px;width:100%;min-height:52px;background:transparent;border:1px solid var(--lin);border-radius:8px;padding:8px;color:var(--fg);font:inherit;font-size:13px;resize:vertical}
@media(max-width:700px){.cartoes{grid-template-columns:1fr}}
</style></head><body>
<header>
  <h1>Bancada A/B — experiência conversacional</h1>
  <span class="prog" id="prog"></span>
  <button class="acao" id="revelar" disabled>Revelar quem é quem</button>
  <button class="acao" id="csv">Baixar CSV</button>
  <button class="acao" id="json">Baixar JSON</button>
  <button class="acao" id="limpar">Limpar notas</button>
</header>
<main>${casosHtml}</main>
<script>
const DADOS = ${JSON.stringify(dados.map((d) => ({ id: d.id, titulo: d.titulo, canal: d.canal, ordem: d.ordem, metricas: Object.fromEntries(Object.entries(d.respostas).map(([k, v]) => [k, v.metricas])) })))};
const CRITERIOS = ${JSON.stringify(CRITERIOS)};
const CHAVE = "kolo-ab-notas-v1";
let notas = JSON.parse(localStorage.getItem(CHAVE) || "{}");

const total = DADOS.length * 3 * CRITERIOS.length;
function preenchidas(){ let n=0; for(const c of Object.values(notas)) for(const b of Object.values(c)) n += Object.keys(b.notas||{}).length; return n; }
function atualizar(){
  const p = preenchidas();
  document.getElementById("prog").textContent = p + " de " + total + " notas";
  document.getElementById("revelar").disabled = p < total;
}
function pintar(){
  for(const [caso,bracos] of Object.entries(notas))
    for(const [braco,d] of Object.entries(bracos)){
      for(const [crit,n] of Object.entries(d.notas||{}))
        document.querySelectorAll('button[data-caso="'+caso+'"][data-braco="'+braco+'"][data-crit="'+crit+'"]')
          .forEach(b => b.classList.toggle("on", +b.dataset.n === n));
      const ta = document.querySelector('textarea[data-caso="'+caso+'"][data-braco="'+braco+'"]');
      if(ta && d.comentario) ta.value = d.comentario;
    }
}
document.addEventListener("click", e => {
  const b = e.target.closest(".bt button"); if(!b) return;
  const {caso,braco,crit,n} = b.dataset;
  notas[caso] ??= {}; notas[caso][braco] ??= {notas:{}};
  notas[caso][braco].notas[crit] = +n;
  b.parentElement.querySelectorAll("button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  localStorage.setItem(CHAVE, JSON.stringify(notas)); atualizar();
});
document.addEventListener("input", e => {
  const ta = e.target.closest("textarea"); if(!ta) return;
  const {caso,braco} = ta.dataset;
  notas[caso] ??= {}; notas[caso][braco] ??= {notas:{}};
  notas[caso][braco].comentario = ta.value;
  localStorage.setItem(CHAVE, JSON.stringify(notas));
});
document.getElementById("revelar").onclick = () => {
  document.querySelectorAll(".reveal").forEach(e => e.classList.remove("oculto"));
  const soma = {};
  for(const [,bracos] of Object.entries(notas))
    for(const [braco,d] of Object.entries(bracos)){
      soma[braco] ??= {t:0,n:0};
      for(const v of Object.values(d.notas||{})){ soma[braco].t += v; soma[braco].n++; }
    }
  const nome = {claude:"Claude (produção)", gpt_a:"GPT-A (mesmo prompt)", gpt_b:"GPT-B (prompt limpo)"};
  alert("MÉDIA GERAL\\n\\n" + Object.entries(soma)
    .sort((a,b)=> b[1].t/b[1].n - a[1].t/a[1].n)
    .map(([k,v]) => nome[k] + ": " + (v.t/v.n).toFixed(2) + " / 5").join("\\n"));
};
function baixar(nome, txt, tipo){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], {type:tipo})); a.download = nome; a.click();
}
document.getElementById("json").onclick = () => baixar("notas-ab.json", JSON.stringify({notas, metricas: DADOS}, null, 2), "application/json");
document.getElementById("csv").onclick = () => {
  const cab = ["caso","canal","braco",...CRITERIOS.map(c=>c[0]),"media","palavras","perguntas","latencia_ms","tokens_in","tokens_out","comentario"];
  const linhas = [cab.join(",")];
  for(const d of DADOS) for(const braco of d.ordem){
    const n = notas[d.id]?.[braco]?.notas || {};
    const vals = CRITERIOS.map(c => n[c[0]] ?? "");
    const nums = vals.filter(v => v !== "");
    const m = d.metricas[braco];
    linhas.push([d.id,d.canal,braco,...vals,
      nums.length ? (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2) : "",
      m.palavras,m.perguntas,m.latencia_ms,m.tokens_in,m.tokens_out,
      '"'+(notas[d.id]?.[braco]?.comentario||"").replace(/"/g,'""')+'"'].join(","));
  }
  baixar("notas-ab.csv", linhas.join("\\n"), "text/csv");
};
document.getElementById("limpar").onclick = () => {
  if(!confirm("Apagar todas as notas?")) return;
  notas = {}; localStorage.removeItem(CHAVE);
  document.querySelectorAll(".bt button.on").forEach(b=>b.classList.remove("on"));
  document.querySelectorAll("textarea").forEach(t=>t.value="");
  document.querySelectorAll(".reveal").forEach(e=>e.classList.add("oculto"));
  atualizar();
};
pintar(); atualizar();
</script></body></html>`;
}
