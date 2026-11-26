import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { bancoControlado } from './banco-controlado.mjs';
const require = createRequire('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1117-1425-0_26.1117.1425.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/runtime.cjs');
const { chromium } = require('playwright');
const root = path.resolve('outputs/plano-v51');
await mkdir(path.join(root,'prints'),{recursive:true});
const resultado = { ambito:'Somente fixture fictícia, mesmo componente React, browser sem acesso externo. Não é smoke Next autenticado nem produção.', cenarios:[], erros:[], externosBloqueados:0 };
for (const k of Object.keys(process.env)) if (/SECRET|TOKEN|API_KEY|SUPABASE|STRIPE|DATABASE|POSTGRES/i.test(k)) delete process.env[k];
const banco=bancoControlado(),familyId='a1111111-1111-4111-8111-111111111111';
const membros=[{id:'b1111111-1111-4111-8111-111111111111',nome:'Manu',cadastro:[]},{id:'b2222222-2222-4222-8222-222222222222',nome:'Theo',cadastro:[]}];
let server;
server = await createServer({configFile:false,envFile:false,root:path.join(root,'browser'),resolve:{alias:{'@':path.resolve('apps/web/src')}},oxc:{jsx:{runtime:'automatic'}},plugins:[{name:'banco-simulado-qa',configureServer(s){s.middlewares.use('/qa',async(req,res)=>{
 try{
  const repositorio=await s.ssrLoadModule(path.resolve('apps/web/src/lib/plano-v51/repositorio.ts'));
  const fonte=await s.ssrLoadModule(path.resolve('apps/web/src/lib/plano-v51/demonstracao.ts'));
  let raw='';for await(const c of req){raw+=c;if(raw.length>200000)throw Error('Limite de teste');}
  const p=raw?JSON.parse(raw):{};let r;
  if(req.url==='/estado')r={familyId,membros,planos:await repositorio.listarPlanosV51(banco.db,familyId)};
  else if(req.url==='/iniciar'){
   const membro=membros.find(m=>m.id===p.membroId);if(!membro)throw Error('Membro inválido');
   r=await repositorio.inserirPlanoV51(banco.db,{familyId,membro,requisicaoId:p.requisicaoId,titulo:p.titulo,relato:p.relato,conteudo:fonte.conteudoDemonstrativo(p.relato),agora:new Date().toISOString()});
  }else if(req.url==='/eventos')r=await repositorio.gravarEventosPlano(banco.db,familyId,p,new Date().toISOString());
  else throw Error('Porta de teste inexistente');
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(r));
 }catch(e){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({erro:e.message}));}
})}}],server:{host:'127.0.0.1',port:4181,strictPort:true,fs:{allow:[process.cwd()]}}});
await server.listen();
const browser = await chromium.launch({headless:true,channel:'chrome'});
const check = (v,m) => {if (!v) throw new Error(m)};
try {
for (const [nome,width,height] of [['desktop',1440,1000],['celular',390,844],['celular-320',320,720],['persistencia-simulada',1440,1000]]) {
  const persistente=nome==='persistencia-simulada';
  const context = await browser.newContext({viewport:{width,height},locale:'pt-BR'});
  await context.route('**/*', route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    resultado.externosBloqueados++; return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e => resultado.erros.push({cenario:nome,mensagem:e.message}));
  const clicar = t => page.getByRole('button',{name:t,exact:true}).click();
  async function dimensoes(etapa) {
    const medidas = await page.evaluate(() => ({
      largura:document.documentElement.clientWidth,conteudo:document.documentElement.scrollWidth,
      pequenos:[...document.querySelectorAll('.pv51 button')].filter(e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden').map(e=>({texto:e.textContent,largura:e.getBoundingClientRect().width,altura:e.getBoundingClientRect().height})).filter(e=>e.largura<43.9||e.altura<43.9)
    }));
    check(medidas.conteudo<=medidas.largura, `${nome}/${etapa}: overflow ${JSON.stringify(medidas)}`);
    check(!medidas.pequenos.length, `${nome}/${etapa}: toque pequeno ${JSON.stringify(medidas.pequenos)}`);
  }
  await page.goto(`http://127.0.0.1:4181/${persistente?'persistente.html':''}`);
  await page.getByText('Escolha a criança para começar.',{exact:false}).waitFor();
  check(await page.locator('.pv-kids button[aria-pressed=true]').count()===0,'criança escolhida automaticamente');
  await page.getByRole('button',{name:/Manu$/}).click();
  await page.getByLabel('Conte do seu jeito',{exact:true}).fill('Na hora da lição, ela senta mas não começa. Quero encontrar um começo possível.');
  await clicar('Enviar relato');
  await page.getByLabel('Qual assunto vamos cuidar neste plano?').fill('Hora da lição');
  await clicar('Criar plano de teste');
  await page.getByRole('heading',{name:'O que já sabemos',exact:true}).waitFor();
  await dimensoes('entender');
  await clicar('Continuar');
  await clicar('Começar'); await clicar('Ainda não experimentei um apoio'); await clicar('Continuar');
  await clicar('Cansada'); await clicar('Pela metade'); await clicar('Continuar');
  await page.getByRole('heading',{name:'Olhares sobre Manu',exact:true}).waitFor();
  check(await page.getByRole('heading',{name:'Na prática',exact:true}).isVisible(),'conteúdo completo não é padrão');
  await dimensoes('descobrir');
  await page.screenshot({path:path.join(root,'prints',`${nome}-descobrir.png`),fullPage:true});
  await clicar('Continuar'); await clicar('Continuar');
  await page.getByLabel('Em que momentos fica um pouco mais fácil?').fill('Quando começo junto.');
  await clicar('Continuar'); await clicar('Conferi, podemos seguir'); await clicar('Continuar');
  await page.getByRole('button',{name:'Começar por este',exact:true}).first().click();
  await clicar('Continuar'); await clicar('Continuar');
  await page.getByLabel('Quando',{exact:true}).fill('Depois do lanche');
  await page.getByLabel('Com que frequência',{exact:true}).fill('Na próxima oportunidade');
  await page.getByLabel('Quem participa',{exact:true}).fill('Eu');
  await dimensoes('combinado');
  await page.screenshot({path:path.join(root,'prints',`${nome}-combinado.png`),fullPage:true});
  await clicar('Continuar');
  await page.getByRole('heading',{name:'Lembretes desligados',exact:true}).waitFor();
  await clicar('Confirmar o combinado');
  await page.getByText('Dia 1',{exact:true}).waitFor();
  await page.getByText('Ainda não há tentativas.',{exact:true}).waitFor();
  check(await page.locator('.pv-confirmed').count()===0,'conquista inicial indevida');
  if (width<900) {
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    const sticky = await page.locator('.pv-mobile-stage').boundingBox();
    check(sticky && Math.abs(sticky.y)<2,'nome e etapa não permaneceram no topo');
    await page.locator('.pv-mobile-stage').getByRole('button',{name:'Ayla',exact:true}).click();
    await page.getByRole('dialog',{name:'Ayla',exact:true}).waitFor();
    await page.keyboard.press('Escape');
    check(await page.getByRole('dialog').count()===0,'gaveta não fechou com Escape');
    await page.evaluate(()=>window.scrollTo(0,0));
  }
  await dimensoes('experimentar');
  await page.screenshot({path:path.join(root,'prints',`${nome}-experimentar-dia1.png`),fullPage:true});
  await clicar('Contar como foi');
  check(await page.getByLabel('Relato da tentativa').inputValue()==='','formulário veio preenchido');
  check(await page.locator('.pv-chips button[aria-pressed=true]').count()===0,'tentativa pré-selecionada');
  await clicar('Experimentei');
  await page.getByLabel('Relato da tentativa').fill('Mostrei a primeira parte e ela começou com ajuda.');
  await clicar('Ajudou em parte'); await clicar(persistente?'Salvar relato':'Registrar nesta sessão');
  await page.getByText('Resultado observado',{exact:true}).waitFor();
  check(await page.locator('.pv-confirmed').count()===0,'resultado virou conquista sem confirmação');
  check(await page.getByRole('button',{name:'Confirmar conquista',exact:true}).isDisabled(),'conquista habilitada sem relato');
  await page.getByLabel('O que melhorou?',{exact:true}).fill('Começou a primeira parte com ajuda.');
  check(await page.getByRole('button',{name:'Confirmar conquista',exact:true}).isDisabled(),'conquista habilitada sem confirmação');
  await page.getByLabel('Confirmo que essa melhoria aconteceu.').check();
  await clicar('Confirmar conquista');
  await page.locator('.pv-confirmed').waitFor();
  await clicar('Ver a evolução');
  await page.getByRole('heading',{name:'Conquistas confirmadas',exact:true}).waitFor();
  if(persistente){
    await page.reload();
    await page.getByRole('button',{name:/Manu$/}).click();
    await clicar('Hora da lição · Evoluir');
    await page.locator('blockquote').filter({hasText:'Começou a primeira parte com ajuda.'}).waitFor();
    check(banco.rows[0]?.secoes[0]?.plano.registros[0]?.conquista?.melhoria==='Começou a primeira parte com ajuda.','melhoria não persistiu no repositório');
    check(banco.rows.length===1,'duplicação de plano após recarregar');
  }
  await page.getByRole('button',{name:/Theo$/}).click();
  await page.getByText('Ainda não há plano para Theo nesta sessão.',{exact:true}).waitFor();
  check(await page.getByText('Começou a primeira parte com ajuda.',{exact:true}).count()===0,'conquista vazou para irmão');
  await page.getByRole('button',{name:/Manu$/}).click();
  await clicar('Hora da lição · Evoluir');
  await page.getByRole('heading',{name:'Conquistas confirmadas',exact:true}).waitFor();
  await dimensoes('evoluir');
  resultado.cenarios.push({nome,width,height,veredito:'PASSOU',caminho:'entrada sem membro → seleção → relato → convite → etapas → combinado → dia1 vazio → formulário vazio → resultado → melhoria+confirmação → conquista → troca de irmão → retomada',retomadaAposReload:persistente,bancoReal:false,producao:false});
  await context.close();
}
check(!resultado.erros.length,`erros de browser: ${JSON.stringify(resultado.erros)}`);
} catch(e) { resultado.falha=e.stack; process.exitCode=1; }
finally { await browser.close(); await server.close(); await writeFile(path.join(root,'QA-BROWSER.json'),JSON.stringify(resultado,null,2)); console.log(JSON.stringify(resultado,null,2)); }
