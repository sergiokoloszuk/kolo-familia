// Caminhos reais; banco e identidade exclusivamente fictícios. Não é replay de produção.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {registerHooks,createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const R=process.cwd(),SRC=path.join(R,'apps/web/src'),A=path.dirname(fileURLToPath(import.meta.url));
const OUT=path.join(R,'outputs/comunicacao-minima-20261126');fs.mkdirSync(OUT,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const baseSha='8a18707de242ca877842bf102b7dba08e47d1eaa';
const versao=process.argv[2],canal=process.argv[3],so=process.argv[4];
if(!['antes','depois'].includes(versao)||!['web','whatsapp'].includes(canal))throw Error('Use antes|depois web|whatsapp [REFxx]');
const arquivos=['lib/conhecimento/recuperar.ts','lib/conhecimento/rastro.ts','lib/conducao/diretrizes.ts','lib/ia/prompt.ts','lib/ayla/experimental.ts','lib/ayla/experimental-prompt.ts'];
const manifest=Object.fromEntries(arquivos.map(p=>[p,hash(versao==='antes'?execFileSync('git',['show',`${baseSha}:apps/web/src/${p}`],{cwd:R}):fs.readFileSync(path.join(SRC,p)))]));
const originalFetch=globalThis.fetch;let atual=null;
// Não carrega .env do aplicativo. Reutiliza somente autenticação do provider em memória.
for(const k of Object.keys(process.env))if(/SUPABASE|STRIPE|DATABASE|POSTGRES|ZAPI|CRON_SECRET|^AYLA_|^ANTHROPIC_MODEL|^OPENAI_MODEL/.test(k))delete process.env[k];
const config=process.env.KOLO_QA_PROVIDER_ENV??'C:/Códigos SAAS/KOLO Família/Kolo Família/apps/web/.env.local';
for(const l of fs.readFileSync(config,'utf8').split(/\r?\n/)){const m=l.match(/^(OPENAI_API_KEY|ANTHROPIC_API_KEY)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');}
const stub=pathToFileURL(path.join(A,'stub-servidor.mjs')).href;
const deps=createRequire(path.join(R,'package.json'));
let resolvendoDependencia=false;
registerHooks({resolve(e,c,n){
 if(resolvendoDependencia)return n(e,c);
 if(e==='@/lib/supabase/server'||['next/headers','next/cache','server-only'].includes(e))return{url:stub,shortCircuit:true};
 if(e.startsWith('@/'))return n(pathToFileURL(path.join(SRC,e.slice(2)+'.ts')).href,c);
 if(e.startsWith('.')&&!/\.[a-z]+$/.test(e)){try{return n(e+'.ts',c)}catch{}}
 if(!e.startsWith('.')&&!e.startsWith('node:')&&!e.startsWith('file:')){resolvendoDependencia=true;try{return{url:pathToFileURL(deps.resolve(e)).href,shortCircuit:true};}finally{resolvendoDependencia=false;}}
 return n(e,c);
},load(u,c,n){
 if(u===pathToFileURL(path.join(SRC,'lib/supabase/server.ts')).href)return{format:'module',source:fs.readFileSync(path.join(A,'stub-servidor.mjs'),'utf8'),shortCircuit:true};
 if(versao==='antes')for(const p of arquivos)if(u===pathToFileURL(path.join(SRC,p)).href)return{format:'module-typescript',source:execFileSync('git',['show',`${baseSha}:apps/web/src/${p}`],{cwd:R,encoding:'utf8'}),shortCircuit:true};
 return n(u,c);
}});
globalThis.fetch=async(url,init)=>{
 const host=new URL(typeof url==='string'?url:url.url??String(url)).hostname;
 if(!['api.openai.com','api.anthropic.com'].includes(host))throw Error('Rede proibida no laboratório: '+host);
 const b=JSON.parse(init?.body??'{}');const all=[b.system,...(b.messages??[]).map(m=>m.content)].map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n');
 const bloco=all.match(/<repertorio_kolo>[\s\S]*?<\/repertorio_kolo>/)?.[0]??'';
 const call={host,modelo:b.model,duracaoMs:0,hashPedido:hash(all),charsPedido:all.length,tokensEstimados:Math.ceil(all.length/4),blocoProjetado:bloco,inputTokens:null,outputTokens:null};atual?.chamadas.push(call);
 const t=performance.now();const r=await originalFetch(url,init);call.http=r.status;
 const p=r.clone().text().then(txt=>{call.duracaoMs=performance.now()-t;try{if(txt.startsWith('event:')){const a=[...txt.matchAll(/^data: (\{.*\})$/gm)].map(m=>{try{return JSON.parse(m[1])}catch{return{}}});call.inputTokens=a.find(x=>x.type==='message_start')?.message?.usage?.input_tokens??null;call.outputTokens=a.find(x=>x.type==='message_delta')?.usage?.output_tokens??null;}else{const j=JSON.parse(txt);call.inputTokens=j.usage?.prompt_tokens??j.usage?.input_tokens??null;call.outputTokens=j.usage?.completion_tokens??j.usage?.output_tokens??null;}}catch{}});atual?.pendentes.push(p);return r;
};
const mod=p=>import(pathToFileURL(path.join(SRC,p)).href);
const {montarMundo}=await mod('lib/ayla/__harness/cenario.ts');
const {novoId}=await mod('lib/ayla/__harness/banco-memoria.ts');
const {POST}=await mod('app/api/conversar/stream/route.ts');
const {responderExperimental}=await mod('lib/ayla/experimental.ts');
const {classificarIntencao}=await mod('lib/ayla/intent.ts');
// O seed é FIXTURE controlada, não fallback do produto nem export do runtime.
function seed(){
 const s=fs.readFileSync(path.join(R,'supabase/migrations/0003_seed.sql'),'utf8').split('insert into public.specialist_prompt_templates')[1].split('on conflict')[0];
 const t=s.slice(s.indexOf('values')+6),rows=[];let nivel=0,q=false,ini=-1;
 for(let i=0;i<t.length;i++){const c=t[i];if(c==="'"){if(q&&t[i+1]==="'"){i++;continue}q=!q;}else if(!q){if(c==='('){if(nivel++===0)ini=i+1}else if(c===')'&&--nivel===0)rows.push(t.slice(ini,i));}}
 const keys=['name','display_name','objective','tone','scope','limits','kolo_vivo_fields','knowledge_tags','routing_keywords','routing_priority','fallback_questions','ativo'];
 return rows.map(row=>{const vals=[];let ini=0,q=false;for(let i=0;i<row.length;i++){if(row[i]==="'"){if(q&&row[i+1]==="'"){i++;continue}q=!q;}else if(row[i]===','&&!q){vals.push(row.slice(ini,i));ini=i+1;}}vals.push(row.slice(ini));const out={id:novoId('skill')};vals.forEach((v,i)=>{v=v.trim().replace(/::jsonb$/,'').trim();let x;if(v.startsWith("'")){x=v.slice(1,-1).replace(/''/g,"'");if(['kolo_vivo_fields','knowledge_tags','routing_keywords','fallback_questions'].includes(keys[i]))x=JSON.parse(x);}else x=v==='true'?true:v==='false'?false:Number(v);out[keys[i]]=x;});return out;});
}
const skills=seed();
const base=json(process.env.KOLO_QA_CORPUS??path.join(R,'data/import/pacote-ayla-v01/BASELINE-BPS.json'));
const catalogo=json(process.env.KOLO_QA_CATALOGO??path.join(R,'data/import/pacote-ayla-v01/CATALOGO-SNAPSHOT.json'));
const patchFile=path.join(R,'data/curadoria/comunicacao-minima-20261126.json');
const patches=versao==='depois'?json(patchFile):[];
const rows=base.map(b=>({...b,...patches.find(p=>p.id===b.id)?.alteracoes}));
const casos=json(path.join(A,'casos.json'));
const result={baseSha,versao,canal,manifest,casosSha:hash(JSON.stringify(casos)),corpusBaseSha:hash(JSON.stringify(base)),corpusCandidatoSha:hash(JSON.stringify(rows)),catalogoSha:hash(JSON.stringify(catalogo)),skillsFixtureSha:hash(JSON.stringify(skills.map(({id,...s})=>s))),core:'fallback do código; banco de documentos vazio intencionalmente',limitacoes:['Web: seed versionado de 7 skills, não configuração atual das 13 skills','WhatsApp: gerador oficial + classificador; sem webhook e sem envio externo','BPs: snapshot local histórico; não prova acervo atual','1 amostra por caso/canal/versão; variação do modelo não isolada'],resultados:[]};
for(const caso of casos.filter(c=>!so||c.id===so)){
 atual={chamadas:[],pendentes:[],selecionadas:[],consultas:0};let texto=null,erro=null,metrica=null;
 const mundo=montarMundo({telefone:'+5500000000000',nomeMae:'Ana',criancas:[{nome:caso.crianca,nascimento:caso.nascimento,genero:['Nina','Lia','Manu'].includes(caso.crianca)?'feminino':'masculino'}]});
 const db=mundo.db;db.tabelas.set('boas_praticas',structuredClone(rows));db.semear('specialist_prompt_templates',skills);
 db.auth={getUser:async()=>({data:{user:{id:'usuario-ficticio'}}})};db.rpc=async nome=>{if(nome!=='current_family_account_id')throw Error('RPC proibida');return{data:mundo.familyId,error:null}};
 const from=db.from.bind(db);db.from=t=>{atual.consultas++;const q=from(t);if(t==='boas_praticas'){const ini=q.in.bind(q);q.in=(k,v)=>{if(k==='id')atual.selecionadas.push(...v);return ini(k,v)};q.or=str=>{const clausulas=[...str.matchAll(/(skills_relacionadas|tags)\.cs\.(\["[^"\\]*"\])/g)].map(m=>[m[1],JSON.parse(m[2])[0]]);if(!clausulas.length)throw Error('OR não reconhecido');return ini('id',rows.filter(r=>clausulas.some(([k,v])=>(r[k]??[]).includes(v))).map(r=>r.id))};}return q;};
 globalThis.__COMUNICACAO_DB=db;const membroId=Object.values(mundo.membros)[0];const t=performance.now();
 try{
  if(canal==='web'){
   const conversaId=novoId('conversa');db.semear('conversas',[{id:conversaId,family_account_id:mundo.familyId,membro_atipico_id:membroId,titulo:'Referência fictícia'}]);
   db.semear('mensagens_skill',[...caso.historico.map((h,i)=>({conversa_id:conversaId,papel:h.quem==='mae'?'user':'assistant',conteudo:h.texto,created_at:new Date(Date.now()-20000+i*1000).toISOString()})),{conversa_id:conversaId,papel:'user',conteudo:caso.relato,created_at:new Date().toISOString()}]);
   const r=await POST(new Request('http://localhost/api/conversar/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversaId})}));texto=await r.text();if(r.status!==200)throw Error('Web HTTP '+r.status);
  }else{
   const turno=await classificarIntencao({texto:caso.relato,supabase:db,familyId:mundo.familyId,catalogoSkills:catalogo,ultimaMae:caso.historico.at(-2)?.texto,ultimaAyla:caso.historico.at(-1)?.texto});let motivo=null;
   const r=await responderExperimental(db,{familyId:mundo.familyId,mensagem:caso.relato,origem:'simulador',turnosSimulados:caso.historico,turnoClassificado:{...turno,skillsAvaliadas:true},membroPreferidoId:membroId,onFalha:m=>{motivo=m}});texto=r?.texto??null;metrica=r?.metrica??null;if(!texto)throw Error('Oficial vazio: '+motivo);
  }
 }catch(e){erro=String(e.message).replace(/sk-[A-Za-z0-9_-]+/g,'[omitido]');}
 await Promise.allSettled(atual.pendentes);
 const selecionadas=[...new Set(atual.selecionadas)];
 const rastros=db.escritas.filter(e=>e.tabela==='eventos_app').map(e=>e.linha).filter(e=>e.kind==='conhecimento_consultado').map(e=>e.payload);
 result.resultados.push({id:caso.id,contextoFicticio:caso,respostaCompleta:texto,erro,duracaoMs:performance.now()-t,selecionadas,rastros,chamadas:atual.chamadas,consultasConstruidas:atual.consultas,metrica,escritasRemotas:0,producao:false});
 fs.writeFileSync(path.join(OUT,`${versao}-${canal}${so?'-'+so:''}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({versao,canal,id:caso.id,ok:!!texto&&!erro,refs:selecionadas,erro}));
}
