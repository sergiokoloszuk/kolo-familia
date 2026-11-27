import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const R=process.cwd(),O=path.join(R,'outputs/comunicacao-minima-20261126');
const ler=f=>JSON.parse(fs.readFileSync(path.join(O,f),'utf8'));
const h=b=>createHash('sha256').update(b).digest('hex');
const corpus=JSON.parse(fs.readFileSync(process.env.KOLO_QA_CORPUS??'data/import/pacote-ayla-v01/BASELINE-BPS.json','utf8'));
const patch=JSON.parse(fs.readFileSync('data/curadoria/comunicacao-minima-20261126.json','utf8'));
const bps=corpus.map(b=>({...b,...patch.find(p=>p.id===b.id)?.alteracoes}));
const notas={
 'web-REF01':{antes:[4,2,3,3,3],depois:[4,2,3,3,3],veredito:'PASSOU COM RESSALVAS',motivo:'Explica a repetição e oferece um exemplo; ainda generaliza o significado comunicativo antes de verificar a função.'},
 'web-REF02':{antes:[4,3,2,3,3],depois:[4,2,2,3,3],veredito:'FALHOU',motivo:'A conclusão sobre processamento auditivo a partir de reação a um som não sustenta excluir dificuldade de audição. A pergunta não substitui avaliação.'},
 'web-REF03':{antes:[4,1,3,3,2],depois:[4,1,3,3,2],veredito:'FALHOU',motivo:'Afirma que o inglês tem contexto seguro, fluência e função comunicativa sem esses fatos terem sido relatados. A candidata preserva o problema.'},
 'web-REF04':{antes:[4,2,3,2,3],depois:[4,1,3,2,3],veredito:'FALHOU',motivo:'Reduz o treino, mas inventa necessidades e consolo. A comparação entre crianças que crescem mais não está sustentada; supõe desenho amado e disponibilidade para deitar juntas.'},
 'web-REF05':{antes:[4,1,3,3,3],depois:[4,1,3,3,3],veredito:'FALHOU',motivo:'Atribui gestos específicos ao Heitor sem relato e fala da chegada da fala como expectativa estabelecida. O antes prometia a chegada de modo ainda mais explícito.'},
 'web-REF06':{antes:[4,2,2,3,2],depois:[4,2,2,3,2],veredito:'FALHOU',motivo:'Muda o aviso, mas presume frustração e a capacidade de a adulta aguentar; escolhe manejo antes de entender a tentativa. Não ficou demonstrada adaptação suficiente à energia real.'},
 'whatsapp-REF01':{antes:[4,3,3,4,3],depois:[4,3,3,4,3],veredito:'PASSOU COM RESSALVAS',motivo:'Mantém função como possibilidade, modelos curtos e pergunta relevante; oferece várias possibilidades sem explicitar bem uma prioridade.'},
 'whatsapp-REF02':{antes:[4,3,3,4,3],depois:[4,3,3,4,3],veredito:'PASSOU COM RESSALVAS',motivo:'Evita intenção de ignorar e contato visual obrigatório; considera audição. A investigação da compreensão continua superficial.'},
 'whatsapp-REF03':{antes:[4,2,2,3,2],depois:[4,3,3,4,3],veredito:'PASSOU COM RESSALVAS',motivo:'A candidata oferece ponte para português e pergunta sobre compreensão. O antes prescreve transição de desenho cedo; ambos exigem investigar melhor o uso real das falas.'},
 'whatsapp-REF04':{antes:[4,3,3,3,3],depois:[4,3,3,3,3],veredito:'PASSOU COM RESSALVAS',motivo:'Retira o treino e permite desabafo; ainda supõe o momento do dia/noite na candidata e a adaptação não foi testada em vários turnos.'},
 'whatsapp-REF05':{antes:[4,3,3,4,3],depois:[4,2,3,3,3],veredito:'FALHOU',motivo:'Acolhe e reconhece comunicação além da fala, mas chama a estratégia de ponte até a fala, sugerindo um destino garantido; os gestos atuais ainda não são conhecidos.'},
 'whatsapp-REF06':{antes:[4,2,2,3,2],depois:[4,2,2,3,2],veredito:'FALHOU',motivo:'Propõe aproximação como prioridade, mas a fala “você queria continuar” atribui intenção; ajudar a levantar/retirar roupa precisa de cuidado com assentimento e contexto. Falta investigar a tentativa e coconstruir a viabilidade.'},
};
const avaliacao=[];const metricas=[];
let texto='# Conversas completas — comparação curta\n\n24 respostas realmente geradas, em 26/11/2026 (horário local), com pessoas e histórias fictícias. Uma resposta por caso/versão/canal; isto não substitui a auditoria posterior de conversas longas.\n\nBase: main `8a18707de242ca877842bf102b7dba08e47d1eaa`. Web: rota POST real com seed de 7 skills como fixture controlada, não catálogo de produção. WhatsApp: classificador e gerador oficial, com fallback do código em banco fictício. Sem webhook, Z-API ou acesso a famílias. O Core ativo do banco não foi usado nesta rodada.\n\nNotas são revisão qualitativa do próprio Codex (1 a 5), não pesquisa com famílias nem avaliação independente. Ordem: Traduzir / Conectar / Encantar / Provocar / Valorizar. Fidelidade, segurança e continuidade podem reprovar independentemente das notas.\n\nIDs enviados foram conferidos no texto projetado; “usados” semanticamente não é uma medida automática disponível.\n';
for(const canal of ['web','whatsapp']){
 const a=ler('antes-'+canal+'.json'),b=ler('depois-'+canal+'.json');
 for(let i=0;i<a.resultados.length;i++){
  const x=a.resultados[i],y=b.resultados[i],n=notas[canal+'-'+x.id];
  texto+=`\n## ${canal} · ${x.id} · ${x.contextoFicticio.tema}\n\nPerfil fictício: ${x.contextoFicticio.crianca}; nascimento técnico da fixture: ${x.contextoFicticio.nascimento}. Nenhum outro fato comportamental foi cadastrado.\n`;
  for(const f of x.contextoFicticio.historico)texto+=`\n**${f.quem==='mae'?'Mãe':'Ayla'} (histórico fictício fixo):** ${f.texto}\n`;
  texto+=`\n**Mãe:** ${x.contextoFicticio.relato}\n`;
  for(const [nome,z,rows] of [['Antes',x,corpus],['Depois',y,bps]]){
   const linhas=new Set(z.chamadas.flatMap(c=>(c.blocoProjetado??'').split('\n').filter(l=>/^\d+\. /.test(l)).map(l=>l.replace(/^\d+\. /,''))));
   const enviados=z.selecionadas.filter(id=>linhas.has(rows.find(r=>r.id===id)?.titulo));
   texto+=`\n### ${nome}\n\n**Ayla:**\n\n${z.respostaCompleta??'[sem resposta]'}\n\nRecuperados: ${z.selecionadas.join(', ')||'nenhum'}.\n\nEnviados ao modelo, conferidos na projeção: ${enviados.join(', ')||'nenhum'}.\n\nRastros nativos capturados: ${z.rastros.length}. ${canal==='whatsapp'&&nome==='Antes'?'A ausência do rastro nativo é o defeito auditado; os IDs desta bancada vêm da consulta e da projeção interceptadas.':''}\n\nNotas: ${n[nome==='Antes'?'antes':'depois'].join(' / ')}.\n`;
  }
  texto+=`\n**Veredito da candidata: ${n.veredito}.** ${n.motivo}\n`;
  avaliacao.push({canal,id:x.id,...n});
  const entrada=z=>z.chamadas.at(-1)?.tokensEstimados??0;
  const crescimento=100*(entrada(y)/entrada(x)-1);
  metricas.push({canal,id:x.id,antesMs:Math.round(x.duracaoMs),depoisMs:Math.round(y.duracaoMs),antesChamadas:x.chamadas.length,depoisChamadas:y.chamadas.length,antesTokensEstimadosGeracao:entrada(x),depoisTokensEstimadosGeracao:entrada(y),crescimentoPercentual:+crescimento.toFixed(2),acimaDe10PorCento:crescimento>10,recuperadasAntes:x.selecionadas,recuperadasDepois:y.selecionadas});
 }
}
fs.writeFileSync(path.join(O,'RESPOSTAS-COMPLETAS.md'),texto.replace(/[ \t]+$/gm,''));
fs.writeFileSync(path.join(O,'AVALIACAO.json'),JSON.stringify(avaliacao,null,2));
const tags=[...new Set(corpus.flatMap(b=>b.tags??[]))];
const pct=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.ceil(s.length*p)-1];};
const latencias=['web','whatsapp'].flatMap(canal=>['antes','depois'].map(versao=>{const ms=metricas.filter(x=>x.canal===canal).map(x=>x[versao+'Ms']);return{canal,versao,n:ms.length,p50:pct(ms,.5),p95:pct(ms,.95),tipo:'resposta completa local; não transporte nem produção; primeira útil não medida'};}));
fs.writeFileSync(path.join(O,'METRICAS.json'),JSON.stringify({estimador:'ceil(chars do pedido / 4), igual antes/depois. Input nativo da Anthropic exclui cache; não equivale a tokens totais.',tags:{distintas:tags.length,rejeitadasAntes:tags.filter(t=>! /^[a-z0-9_]{2,40}$/.test(t)).length,rejeitadasDepois:tags.filter(t=>! /^[\p{L}\p{N}_ ./-]{2,120}$/u.test(t)).length},latencias,cenarios:metricas},null,2));
const src=fs.readFileSync('apps/web/src/lib/conducao/diretrizes.ts','utf8');
const seis=src.match(/export const APOIO_AO_ADULTO = `([\s\S]*?)`;/)[1];
fs.writeFileSync(path.join(O,'PROPOSTA-CORE.md'),'# Proposta para o Core do banco — aguarda aprovação\n\nNão aplicada ao banco. As mesmas seis frases estão definidas uma vez em diretrizes.ts e reutilizadas no fallback de código.\n\n'+seis+'\n');
const arquivos=['apps/web/src/lib/conhecimento/recuperar.ts','apps/web/src/lib/conhecimento/rastro.ts','apps/web/src/lib/conducao/diretrizes.ts','apps/web/src/lib/ia/prompt.ts','apps/web/src/lib/ayla/experimental.ts','apps/web/src/lib/ayla/experimental-prompt.ts','data/curadoria/comunicacao-minima-20261126.json','scripts/bancada/comunicacao-minima/casos.json'];
fs.writeFileSync(path.join(O,'MANIFESTO.json'),JSON.stringify({base:'8a18707de242ca877842bf102b7dba08e47d1eaa',arquivos:arquivos.map(f=>({path:f,sha256:h(fs.readFileSync(f))})),observacao:'Os quatro JSONs de execução preservam também os hashes exatos carregados em cada rodada. Depois da geração, apenas comentários e testes foram conciliados; não houve nova alteração das instruções funcionais.',pacote78:'preservado e fora desta entrega',segredosOuDadosFamiliaresIncluidos:false},null,2));
console.log(JSON.stringify({respostas:24,avaliacoes:avaliacao.length,acimaDe10:metricas.filter(x=>x.acimaDe10PorCento).map(x=>({canal:x.canal,id:x.id,percent:x.crescimentoPercentual})),latencias}));
