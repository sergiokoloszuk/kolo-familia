/** A/B do produtor real com família sintética; só GET no banco e chamada ao modelo. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { createClient } from '@supabase/supabase-js';

const web = resolve(process.cwd(), 'apps/web');
if (process.argv[3]) process.env.OPENAI_MODEL_PRINCIPAL = process.argv[3];
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(pathToFileURL(resolve(web, 'src', `${specifier.slice(2)}.ts`)).href, context);
  if (['next/headers', 'next/cache', 'server-only'].includes(specifier))
    return { url: "data:text/javascript,export const cookies=()=>{throw Error('sem request')};export const headers=cookies;export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/web/src/'))
    return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error('Supabase não configurado');
const origin = new URL(url).origin;
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? input?.method ?? 'GET').toUpperCase();
  if (!((u.origin === origin && method === 'GET') ||
    (u.origin === 'https://api.openai.com' && u.pathname === '/v1/chat/completions' && method === 'POST')))
    throw Error(`I/O não permitida: ${method} ${u.origin}${u.pathname}`);
  return nativeFetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(60000) });
};
const load = (file) => import(pathToFileURL(resolve(web, 'src', file)).href);
const [{ montarMundo }, { decidirTurno }, { responderExperimental }, { carregarCatalogoSkills }] = await Promise.all([
  load('lib/ayla/__harness/cenario.ts'), load('lib/conducao/decisao-do-turno.ts'),
  load('lib/ayla/experimental.ts'), load('lib/ayla/catalogo-skills.ts'),
]);
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const catalogo = await carregarCatalogoSkills(supabase);
if (catalogo.estado !== 'ok') throw Error('Catálogo indisponível');

const manu = { nome: 'Manu', nascimento: '2020-01-01', genero: 'feminino', sabe: {
  como_e: 'Gosta de dinossauros e de cozinha. Comunica-se principalmente por gestos. Sons altos a incomodam.',
} };
const cases = [
  { id: 'mercado', fala: 'Quero uma ideia de brincadeira para ajudar a Manu a lidar com o barulho do mercado. Ela se comunica mais por gestos.', crianca: manu },
  { id: 'foco', fala: 'Pode me dar uma brincadeira para a Manu praticar foco? Ela costuma começar e logo largar.', crianca: manu },
  { id: 'livre', fala: 'Me dê uma brincadeira nova para fazer com a Manu hoje; já fizemos restaurante de dinossauros.', crianca: manu },
  { id: 'manejo', fala: 'Como posso ajudar a Manu quando o barulho do mercado fica difícil?', crianca: manu },
  { id: 'fala_emergente', fala: 'Pode sugerir brincadeiras para fazer com o Leo em casa? Ele está usando algumas palavrinhas.', crianca: {
    nome: 'Leo', nascimento: '2022-11-01', genero: 'masculino', sabe: { como_e: 'Gosta de carrinhos e água. Comunica-se com gestos e algumas palavras curtas; começa a juntar duas palavras quando está à vontade.' },
  } },
  { id: 'adolescente', fala: 'Quero uma brincadeira ou jogo para fazer com a Bia, que tem 14 anos. Ela gosta de música e não quer atividade infantil.', crianca: {
    nome: 'Bia', nascimento: '2012-03-01', genero: 'feminino', sabe: { como_e: 'Gosta de música e conversas sobre artistas. Fala fluentemente; prefere atividades com escolha própria e rejeita ser tratada como criança pequena.' },
  } },
];
for (const { id, fala, crianca } of cases) {
  if (process.argv[2] && process.argv[2] !== id) continue;
  const decisao = await decidirTurno({ texto: fala,
    blocoEstado: `<estado>Família sintética. ${crianca.nome}.</estado>`,
    catalogoSkills: catalogo.skills, catalogoDisponivel: true });
  if (decisao.origem !== 'gpt') throw Error(`Classificação falhou: ${id}`);
  const mundo = montarMundo({ nomeMae: 'Karina', criancas: [crianca] });
  const memoria = mundo.db.cliente();
  const db = { from(tabela) { return ['ayla_documentos', 'boas_praticas'].includes(tabela) ? supabase.from(tabela) : memoria.from(tabela); } };
  const falhas = [];
  const resposta = await responderExperimental(db, { familyId: mundo.familyId, mensagem: fala,
    origem: 'simulador', turnosSimulados: [{ quem: 'ayla', texto: 'Uma brincadeira que já fizemos foi o restaurante dos dinossauros.' }],
    turnoClassificado: decisao, onFalha: (motivo, detalhe) => falhas.push({ motivo, detalhe }) });
  if (!resposta) throw Error(`${id}: ${JSON.stringify(falhas)}`);
  console.log(JSON.stringify({ id, fala, skills: decisao.skills, texto: resposta.texto,
    bpInjetadas: resposta.metrica.bpInjetadas, ms: resposta.metrica.msTotal }));
}
