
/**
 * BANCADA DE FIDELIDADE — braço A apenas.
 *
 * Pergunta única: a Ayla em producao hoje conversa como o Prompt Mestre da
 * agencia determina? Nada e alterado; nenhuma escrita e possivel (a chave de
 * service-role e apagada do ambiente antes de qualquer import do app).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..'), SRC = resolve(RAIZ, 'apps/web/src');
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const salvar = (n, o) => writeFileSync(resolve(AQUI, n), JSON.stringify(o, null, 2) + '\n');
for (const l of readFileSync(resolve(RAIZ, 'apps/web/.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY, SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rede = globalThis.fetch;
const ler = async q => {
  const r = await rede(`${SB}/rest/v1/${q}`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
  if (!r.ok) throw Error(`leitura falhou HTTP ${r.status}`);
  return r.json();
};
const docs = await ler('ayla_documentos?select=versao,conteudo&chave=eq.core&status=eq.ativo');
if (docs.length !== 1 || docs[0].versao !== 10) throw Error('Core ativo nao e v10 unico');
let core = docs[0];
// ⚠️ CANDIDATO OPCIONAL. Sem `CORE_ARQUIVO`, roda o ativo do banco — que é o
// comportamento original e continua sendo o padrão. Com ele, o conteúdo vem do
// arquivo e o banco NÃO é tocado: a asserção acima já provou que o ativo é o
// v10, e é contra ele que o candidato se compara.
if (process.env.CORE_ARQUIVO) {
  const conteudo = readFileSync(resolve(RAIZ, process.env.CORE_ARQUIVO), 'utf8');
  core = { versao: Number(process.env.CORE_VERSAO ?? 11), conteudo };
  console.log(`CANDIDATO: ${process.env.CORE_ARQUIVO} (v${core.versao}, ${conteudo.length} ch)`);
}
const bps = await ler('boas_praticas?select=*&status=eq.ativo&limit=1000');
const skills = await ler('specialist_prompt_templates?select=name,routing_keywords&ativo=eq.true');
console.log(`Core v${core.versao} (${core.conteudo.length} ch, sha ${sha(core.conteudo)}) - ${bps.length} BPs - ${skills.length} skills`);

// A partir daqui, nenhuma escrita e possivel.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
process.env.AYLA_EXPERIMENTAL_TODAS = 'true';

registerHooks({ resolve(e, c, n) {
  if (e.startsWith('@/')) return n(pathToFileURL(resolve(SRC, e.slice(2) + '.ts')).href, c);
  if (e.startsWith('.') && !/\.[a-z]+$/.test(e)) { try { return n(e + '.ts', c); } catch {} }
  if (['next/headers', 'next/cache', 'server-only'].includes(e))
    return { url: pathToFileURL(resolve(RAIZ, 'scripts/bancada/core-v9-vs-v2/stub-next.mjs')).href, shortCircuit: true };
  return n(e, c);
}});
const mod = p => import(pathToFileURL(resolve(SRC, p)).href);
const { responderExperimental } = await mod('lib/ayla/experimental.ts');
const { montarMundo } = await mod('lib/ayla/__harness/cenario.ts');
const { classificarIntencao } = await mod('lib/ayla/intent.ts');
const { naturezaDoTurno } = await mod('lib/conducao/fronteiras-forma.ts');

const PERMITIDOS = ['https://api.openai.com/v1/chat/completions', 'https://api.anthropic.com/v1/messages'];
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!PERMITIDOS.some(p => url.startsWith(p))) throw Error('rede fora do endpoint autorizado: ' + url);
  return rede(input, { ...init, signal: AbortSignal.timeout(90000) });
};

// Crianca sintetica alinhada aos exemplos do PDF (Pedro).
const PEDRO = { nome: 'Pedro', nascimento: '2020-06-01', genero: 'masculino',
  sabe: { como_e: { texto: 'Gosta de rotina previsivel.', interesses: ['Carros', 'Dinossauro'] } },
  extras: { rotina: 'A saida de casa de manha e o momento mais dificil.' } };

const CENARIOS = [
  { id: '1-escola', skill: 'escola', turnos: ['Meu filho chora toda vez que eu deixo ele na escola.', 'Como?', 'Pode me passar.'] },
  { id: '2-dentista', skill: 'emocional', turnos: ['Meu filho tem medo do dentista.', 'Me mostra.'] },
  { id: '3-urgencia', skill: 'emocional', turnos: ['Ele cortou o pe e esta sangrando muito. Acho que foi em vidro.'] },
  { id: '4-vago', skill: 'emocional', turnos: ['Ele fica muito agitado.'] },
  { id: '5-desabafo', skill: 'meu_bem_estar', turnos: ['Hoje eu nao aguento mais. Chorei escondida no banheiro. Parece que nada que eu faco funciona e eu to exausta.'] },
  { id: '6-continuidade', skill: 'rotina', turnos: ['Ele nao quer ficar na mesa na hora do jantar.', 'Fiz o que voce falou, mas ele levantou do mesmo jeito.', 'Nao e o barulho da TV, nao - a gente ja janta com tudo desligado.'] },
];

const N = Number(process.env.EXECUCOES ?? 6);
const saida = { quando: new Date().toISOString(), commit: '4fefcbb', coreVersao: core.versao,
  coreSha: sha(core.conteudo), execucoes: N, resultados: [] };

for (const c of CENARIOS) {
  for (let i = 1; i <= N; i++) {
    const mundo = montarMundo({ nomeMae: 'Ana', criancas: [PEDRO] });
    mundo.db.linhas('membros_atipicos')[0].perfil = 'TEA';
    mundo.db.semear('boas_praticas', structuredClone(bps));
    const hist = [];
    for (let t = 0; t < c.turnos.length; t++) {
      const msg = c.turnos[t];
      let tc = null;
      try {
        tc = await classificarIntencao({ texto: msg, catalogoSkills: skills,
          ultimaMae: hist.filter(h => h.quem === 'mae').at(-1)?.texto ?? null,
          ultimaAyla: hist.filter(h => h.quem === 'ayla').at(-1)?.texto ?? null });
      } catch (e) { tc = { intencao: 'outro', tema: c.skill, aceite: null, skills: [c.skill] }; }
      const jaHouve = hist.some(h => h.quem === 'ayla' && (h.texto || '').length > 120);
      const natureza = naturezaDoTurno(msg, jaHouve);
      const t0 = Date.now();
      const r = await responderExperimental(mundo.db, { familyId: mundo.familyId, mensagem: msg,
        rascunhoCore: { conteudo: core.conteudo, versao: core.versao }, origem: 'simulador',
        turnosSimulados: hist.map(h => ({ quem: h.quem, texto: h.texto })), turnoClassificado: tc });
      const texto = r?.texto ?? '';
      hist.push({ quem: 'mae', texto: msg });
      hist.push({ quem: 'ayla', texto });
      saida.resultados.push({ cenario: c.id, execucao: i, turno: t + 1, mensagem: msg,
        natureza, skills: tc?.skills ?? [], intencao: tc?.intencao ?? null,
        texto, chars: texto.length, metrica: r?.metrica ?? null, ms: Date.now() - t0 });
      salvar('resultados-A.json', saida);
    }
    console.log(`${c.id} #${i}: ${c.turnos.length} turnos`);
  }
}
console.log(`FIM: ${saida.resultados.length} turnos gerados.`);
