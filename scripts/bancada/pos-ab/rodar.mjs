import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
const AQUI=dirname(fileURLToPath(import.meta.url));
const RAIZ=resolve(AQUI,'../../..'), SRC=resolve(RAIZ,'apps/web/src');
const sha=s=>createHash('sha256').update(s).digest('hex');
const salvar=(nome,obj)=>writeFileSync(resolve(AQUI,nome),JSON.stringify(obj,null,2)+'\n');
for(const l of readFileSync(resolve(RAIZ,'apps/web/.env.local'),'utf8').split('\n')){
 const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');
}
const sr=process.env.SUPABASE_SERVICE_ROLE_KEY, sb=process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_KEY;
process.env.AYLA_EXPERIMENTAL_TODAS='true';
const rede=globalThis.fetch;
async function lerTabela(query){
 const r=await rede(`${sb}/rest/v1/${query}`,{headers:{apikey:sr,Authorization:`Bearer ${sr}`}});
 if(!r.ok)throw Error(`Leitura de referência falhou: HTTP ${r.status}`);
 return r.json();
}
// Únicas leituras externas ao modelo: documentos e BPs, sem dados de famílias.
const docs=await lerTabela('ayla_documentos?select=versao,status,conteudo&chave=eq.core&status=eq.ativo');
if(docs.length!==1||docs[0].versao!==10)throw Error('Core ativo não é v10 único');
const core=docs[0];
const bps=await lerTabela('boas_praticas?select=*&status=eq.ativo&limit=1000');
salvar('referencias.json',{quando:new Date().toISOString(),core,bps});
registerHooks({resolve(e,c,n){
 if(e.startsWith('@/'))return n(pathToFileURL(resolve(SRC,e.slice(2)+'.ts')).href,c);
 if(e.startsWith('.')&&!/\.[a-z]+$/.test(e)){try{return n(e+'.ts',c);}catch{}}
 if(['next/headers','next/cache','server-only'].includes(e))return {url:pathToFileURL(resolve(AQUI,'../core-v9-vs-v2/stub-next.mjs')).href,shortCircuit:true};
 return n(e,c);
}});
const mod=p=>import(pathToFileURL(resolve(SRC,p)).href);
const {responderExperimental}=await mod('lib/ayla/experimental.ts');
const {montarMundo}=await mod('lib/ayla/__harness/cenario.ts');
const {selecionar}=await mod('lib/bia/pontuacao.ts');
const {montarBlocoBia}=await mod('lib/bia/bloco.ts');
const {detectarConflitos}=await mod('lib/bia/conflitos.ts');
const corpus=JSON.parse(readFileSync(resolve(RAIZ,'data/bia/corpus-pos-2026-09.json'),'utf8')).map(c=>({...c,id:c.hash}));
const mario={nome:'Mario',nascimento:'2008-01-01',genero:'masculino',sabe:{como_e:{interesses:['Carrinho','Desenhar','Agua']}},extras:{
 comunicacao:'Conversa bem, estamos treinando ter autonomia e ligar para resolver coisas, agendar cabeleireiro. Apresenta resistência em aprender habilidades sociais (falar com atendentes, pedir informações). Antecipa falha em interações com estranhos (porteiro, jardineiro, merendeira) e não tenta; crença limitante.',
 socializacao:'Custa / cansa · Interage com pares: Raramente · Ansioso ao tentar fazer novos amigos, especialmente meninas; precisa de estratégias para lidar com ansiedade social. Dificuldade em ir a lugares desconhecidos e falar com atendentes; sente vergonha.',
 emocional:'Crises intensas · Gatilhos: ida para a escola; situações fora do seu controle (ex.: time perdendo) · trava e fica agressivo antes de sair; durante crises não consegue falar.'
}};
const manu={nome:'Manu',nascimento:'2020-01-01',genero:'feminino',sabe:{como_e:{interesses:['Cozinha','Dinossauro','Cinema','contos e princesas']}},extras:{
 comunicacao:'Fala palavras soltas · Mostra pouco o que quer · Dificuldade em responder a comandos verbais mesmo com proximidade e toque.',
 foco:'Foca no que gosta · dificuldade em ligar pontos e fazer associações entre conceitos · dificuldade com aprendizado visual/abstrato (ex.: mapas)',
 preferencias:{evitar:['Contato com areia e água na praia']}
}};
const casos=[
 {id:'mario-social',perfil:mario,idade:18,skill:'socializacao',msg:'Meu filho não consegue brincar com outras crianças'},
 {id:'mario-limite',perfil:mario,idade:18,skill:'emocional',msg:'Toda vez que eu falo não ele começa a gritar. detesta ser frustrado',objetivo:'Quero que ele aprenda a aceitar o limite, não receber sempre outra opção.'},
 {id:'manu-mapa',perfil:manu,idade:6,skill:'aprendizado',msg:'Minha filha não aprende o mapa do Brasil. Ela não quer aprender'}
];
let atual;
const saida={quando:new Date().toISOString(),commit:'4fefcbb',coreHash:sha(core.conteudo),n:6,ingestao:{total:corpus.length},resultados:[],alarmes:[]};
globalThis.fetch=async(input,init)=>{
 const url=String(input);
 if(url!=='https://api.openai.com/v1/chat/completions')throw Error('Rede fora do endpoint autorizado na bancada');
 if(saida.alarmes.length)throw Error('Bancada parada por alarme');
 const body=JSON.parse(init.body), system=body.messages.find(m=>m.role==='system');
 if(!system||!atual)throw Error('Chamada sem contexto de bancada');
 const base=system.content;
 const bp=base.match(/<repertorio_kolo>[\s\S]*?<\/repertorio_kolo>/)?.[0]??'';
 const conflitos=detectarConflitos({textosBia:atual.bloco.usados.map(r=>r.chunk.texto_original),textosBoasPraticas:[bp]});
 if(conflitos.length){saida.alarmes.push({caso:atual.caso,braco:atual.braco,tipo:'conflito',conflitos});salvar('resultados.json',saida);throw Error('ALARME conflito BIA/BP');}
 if(atual.braco==='B')system.content=base+'\n\n'+atual.bloco.texto;
 atual.chamadas.push({modelo:body.model,baseHash:sha(base),baseSystem:base,system:system.content,messages:body.messages,bpChars:bp.length});
 const t=Date.now();
 const r=await rede(input,{...init,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 const j=await r.clone().json();
 atual.chamadas.at(-1).uso=j.usage; atual.chamadas.at(-1).ms=Date.now()-t;
 if(!r.ok)throw Error(`Modelo HTTP ${r.status}`);
 const texto=j.choices?.[0]?.message?.content??'';
 const alarmes=[];
 if(texto.length>900)alarmes.push('resposta >900 caracteres');
 if(/\bbiblioteca\b|\bestudos\b|a literatura|segundo (?:a|o) |base da pós/i.test(texto))alarmes.push('menção de fonte');
 // Coincidências longas ficam registradas para não confundir palavras comuns com cópia.
 const normal=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 for(const u of atual.bloco.usados){const w=normal(u.chunk.texto_original).split(' ');for(let i=0;i<=w.length-12;i++){const trecho=w.slice(i,i+12).join(' ');if(normal(texto).includes(trecho)){alarmes.push('cópia literal: '+trecho);break;}}}
 for(const tipo of alarmes)saida.alarmes.push({caso:atual.caso,braco:atual.braco,tipo,texto});
 return r;
};
for(const caso of casos){
 const hist=caso.objetivo?[{papel:'user',texto:caso.objetivo}]:[];
 const ctx={idadeAnos:caso.idade,perfil:'TEA',dominio:caso.skill,dificuldade:caso.msg,textoDaConversa:hist.map(t=>t.texto).join('\n'),objetivo:caso.objetivo??null};
 const selecionados=selecionar(corpus,ctx,{limite:12,maxPorTipo:4});
 const bloco=montarBlocoBia(selecionados);
 if(!bloco.texto)throw Error('Bloco B vazio: não há contraste');
 for(let i=1;i<=6;i++)for(const braco of (i%2?['A','B']:['B','A'])){
  if(saida.alarmes.length)break;
  const mundo=montarMundo({nomeMae:'Ana',criancas:[caso.perfil]});
  mundo.db.linhas('membros_atipicos')[0].perfil='TEA';
  mundo.db.semear('boas_praticas',structuredClone(bps));
  atual={caso:caso.id,braco,execucao:i,ctx,bloco,selecionados,chamadas:[]};
  let falha;
  const t=Date.now();
  const r=await responderExperimental(mundo.db,{familyId:mundo.familyId,mensagem:caso.msg,rascunhoCore:{conteudo:core.conteudo,versao:10},origem:'simulador',turnosSimulados:hist,turnoClassificado:{intencao:'orientacao',tema:caso.skill,aceite:null,skills:[caso.skill]},onFalha:(m)=>{falha=m;}});
  saida.resultados.push({...atual,texto:r?.texto??null,metrica:r?.metrica??null,falha:falha??null,ms:Date.now()-t});
  const tokens=saida.resultados.filter(x=>x.braco===braco).map(x=>x.metrica?.tokensEntrada).filter(Number.isFinite).sort((a,b)=>a-b);
  const med=tokens.length%2?tokens[(tokens.length-1)/2]:(tokens[tokens.length/2-1]+tokens[tokens.length/2])/2;
  if(med>12000)saida.alarmes.push({tipo:'mediana tokensEntrada >12000',braco,mediana:med});
  if(!r)saida.alarmes.push({tipo:'execução sem resposta',caso:caso.id,braco,falha});
  salvar('resultados.json',saida);
  console.log(`${caso.id} ${braco} #${i}: ${r?.texto?.length??0} chars; ${r?.metrica?.tokensEntrada??0} tokens; alarmes=${saida.alarmes.length}`);
 }
 if(saida.alarmes.length)break;
}
console.log(`Final: ${saida.resultados.length}/36 execuções; ${saida.alarmes.length} alarmes.`);
