/** Smoke local de dois produtores web com família sintética. Sem escrita ou envio. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { createClient } from '@supabase/supabase-js';

const web = resolve(process.cwd(), 'apps/web');
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
const [{ assemblePrompt }, { recuperarBoasPraticas }, { gerarConversacional, MODELO_CONVERSA }, { APROFUNDAMENTOS }] = await Promise.all([
  load('lib/ia/prompt.ts'), load('lib/conhecimento/recuperar.ts'), load('lib/ia/provider.ts'), load('lib/ayla/aprofundamento.ts'),
]);
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const adolescente = process.argv.includes('adolescente');
const fala = adolescente
  ? 'Quero um jogo para fazer com Bia, de 14 anos. Ela gosta de música, fala com facilidade e rejeita atividades infantis.'
  : 'Quero uma brincadeira para fazer com a Manu durante a ida ao mercado. Sons altos incomodam; ela se comunica por gestos e já brincamos de restaurante de dinossauros.';
const bps = await recuperarBoasPraticas({ supabase, skills: adolescente ? ['socializacao'] : ['sensorial', 'comunicacao'], idade: adolescente ? 14 : 6, limite: 2, relato: fala });
const ctx = {
  cuidador: { nome: 'Karina', relacao: 'mãe', genero: 'feminino' },
  membroFoco: adolescente
    ? { id: 'sintetico', nome: 'Bia', idade: 14, perfil: 'gosta de música; fala fluentemente; não gosta de atividades infantis', genero: 'feminino', diagnosticoRegistrado: null, secoes: { como_e: 'Gosta de música e conversa sobre artistas. Prefere atividades com escolha própria.' } }
    : { id: 'sintetico', nome: 'Manu', idade: 6, perfil: 'comunicação por gestos; gosta de dinossauros; sensível a sons altos', genero: 'feminino', diagnosticoRegistrado: null, secoes: { como_e: 'Gosta de dinossauros. Comunica-se por gestos. Já brincou de restaurante de dinossauros.' } },
  membros: [{ nome: adolescente ? 'Bia' : 'Manu', idade: adolescente ? 14 : 6, genero: 'feminino', perfil: adolescente ? 'gosta de música' : 'comunicação por gestos' }],
  familia: {}, diariosRecentes: [], ultimoCheckin: null, perfilConsultavel: null,
  base2: [], boasPraticas: bps, historico: [],
};
const { data: tipo, error } = await supabase.from('output_types')
  .select('key,label,prompt_template').eq('key', 'brincadeiras').eq('ativo', true).maybeSingle();
if (error || !tipo) throw Error(`Tipo brincadeiras indisponível: ${error?.message ?? 'sem linha'}`);
console.log(JSON.stringify({ templateAtivo: tipo.prompt_template }));
if (process.argv[2] === 'template') process.exit(0);
for (const modo of [{ kind: 'conversa' }, { kind: 'output_type', outputType: tipo }]) {
  if (process.argv[2] && !['aprofundamento', modo.kind].includes(process.argv[2])) continue;
  if (process.argv[2] === 'aprofundamento' && modo.kind !== 'output_type') continue;
  const ramo = process.argv[2] === 'aprofundamento';
  const modoEfetivo = ramo ? { kind: 'output_type', outputType: { ...tipo, prompt_template: APROFUNDAMENTOS.aprofundar_brincar.receita } } : modo;
  const pedido = ramo ? `CONTINUAÇÃO DA MESMA CONVERSA. A família contou: ${fala}\nA Ayla já ajudou a ajustar o ambiente. Agora a família escolheu: Brincar / passear. Entregue valor novo, sem repetir manejo.` : fala;
  const { system, messages } = assemblePrompt({ skills: [], ctx, userInput: pedido, modo: modoEfetivo });
  const r = await gerarConversacional({
    provider: 'openai', model: MODELO_CONVERSA.openai,
    system: system.map((s) => s.text).join('\n\n'), messages,
    maxTokens: 1200, cacheSystem: true, esforcoRaciocinio: 'low',
  });
  console.log(JSON.stringify({ modo: ramo ? 'aprofundamento' : modo.kind, texto: r.texto, ms: r.ms, bpInjetadas: bps.length }));
}
