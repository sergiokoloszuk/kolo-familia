/**
 * Core v11 ativo × v12 candidata, pelo gerador oficial e com dados sintéticos.
 * Gera 20 respostas pareadas. Não escreve em banco nem envia WhatsApp.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const SRC = resolve(RAIZ, "apps/web/src");
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("faltam as variáveis do Supabase");
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const ler = async (rota) => {
  const r = await fetch(`${URL}/rest/v1/${rota}`, { headers });
  if (!r.ok) throw new Error(`leitura falhou: HTTP ${r.status}`);
  return r.json();
};

const [ativos, bps] = await Promise.all([
  ler("ayla_documentos?select=versao,conteudo&chave=eq.core&status=eq.ativo"),
  ler("boas_praticas?select=*&status=eq.ativo&limit=1000"),
]);
if (ativos.length !== 1) throw new Error(`esperava um Core ativo, achei ${ativos.length}`);
const atual = ativos[0];
const candidata = readFileSync(resolve(RAIZ, "docs/documentos-ayla/core-v12-CANDIDATO.md"), "utf8").trim();

// Depois das leituras, o processo perde toda capacidade de escrita externa.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
process.env.AYLA_EXPERIMENTAL_TODAS = "true";

registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/")) return next(pathToFileURL(resolve(SRC, `${esp.slice(2)}.ts`)).href, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try { return next(`${esp}.ts`, ctx); } catch { /* não era TypeScript */ }
    }
    if (["next/headers", "next/cache", "server-only"].includes(esp)) {
      return { url: pathToFileURL(resolve(RAIZ, "scripts/bancada/core-v9-vs-v2/stub-next.mjs")).href, shortCircuit: true };
    }
    return next(esp, ctx);
  },
});

const mod = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const [{ responderExperimental }, { montarMundo }, { paraWhatsApp }, { dividirEmBolhas }] = await Promise.all([
  mod("lib/ayla/experimental.ts"),
  mod("lib/ayla/__harness/cenario.ts"),
  mod("lib/ayla/apresentacao.ts"),
  mod("lib/ayla/bolhas.ts"),
]);

const PERFIL = {
  nome: "Manu", nascimento: "2020-04-10", genero: "feminino",
  sabe: {
    como_e: "Gosta de cozinha de brinquedo e histórias de animais.",
    comunicacao: "Fala frases curtas e também aponta quando não encontra a palavra.",
    corpo_rotina: "Aviso curto antes de mudar de atividade costuma ajudar.",
    escola: "Na escola participa melhor quando a professora começa junto.",
  },
  extras: {
    desafios_onboarding: ["comunicação", "transições", "escola"],
    preferencias: { temas: ["cozinha", "animais"] },
  },
};

const CASOS = [
  ["primeira_ajuda", "Quando tiro o tablet ela grita e não entra no banho.", "autonomia"],
  ["vago", "Ela grita muito.", "emocional"],
  ["atividade", "Me dá uma brincadeira para ela praticar pedir ajuda.", "comunicacao"],
  ["frase_pronta", "O que eu falo quando ela não quer entrar na escola?", "escola"],
  ["tres_momentos", "Na crise ela bate, depois chora e amanhã acontece de novo. O que faço?", "emocional"],
  ["casa_escola", "Em casa ela começa a lição, na escola só faz quando a professora fica perto.", "aprendizado"],
  ["apoio", "Ela começou sozinha, mas depois precisei ajudar até o fim.", "autonomia"],
  ["desabafo", "Estou exausta. Hoje não aguento mais tentar tanta coisa.", "emocional"],
  ["ficou_igual", "Ficou igual. Quero outra sugestão.", "autonomia"],
  ["pergunta_objetiva", "Que horário você sugere para o tablet antes do banho das 19h?", "autonomia"],
];
const HISTORICO_IGUAL = [
  { quem: "mae", texto: "Ela grita quando o tablet acaba." },
  { quem: "ayla", texto: "Avise cinco minutos antes e mostre um timer. Observe se ela aceita desligar com menos protesto." },
];
const BRACOS = [
  { id: "atual", core: { versao: atual.versao, conteudo: atual.conteudo } },
  { id: "candidata", core: { versao: 12, conteudo: candidata } },
];
const saida = {
  quando: new Date().toISOString(),
  atual: { versao: atual.versao, chars: atual.conteudo.length, sha: hash(atual.conteudo) },
  candidata: { versao: 12, chars: candidata.length, sha: hash(candidata) },
  bps: bps.length,
  resultados: [],
};

for (const [id, mensagem, tema] of CASOS) {
  for (const braco of BRACOS) {
    const mundo = montarMundo({ nomeMae: "Karina", criancas: [PERFIL] });
    mundo.db.semear("boas_praticas", structuredClone(bps));
    const t0 = Date.now();
    let resposta;
    let erro = null;
    try {
      resposta = await responderExperimental(mundo.db, {
        familyId: mundo.familyId,
        mensagem,
        rascunhoCore: braco.core,
        origem: "simulador",
        turnosSimulados: id === "ficou_igual" ? HISTORICO_IGUAL : [],
        turnoClassificado: { intencao: "outro", tema, aceite: null, skills: [] },
      });
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }
    const texto = paraWhatsApp(resposta?.texto ?? "");
    const bolhas = dividirEmBolhas(texto);
    const ms = Date.now() - t0;
    saida.resultados.push({
      caso: id, braco: braco.id, mensagem, ms, chars: texto.length, bolhas: bolhas.length,
      teaser: /se quiser|quer que eu|posso te (mostrar|passar|explicar)/i.test(texto),
      aberturaAutomatica: /^(entendi|oi[,! ]|karina[,! ])/i.test(texto.trim()),
      texto, erro,
    });
    console.log(`${id.padEnd(18)} ${braco.id.padEnd(9)} ${String(texto.length).padStart(4)} ch ${bolhas.length} bolha(s) ${ms} ms`);
  }
}

const pasta = resolve(tmpdir(), "kolo-qualidade-conversa");
mkdirSync(pasta, { recursive: true });
const arquivo = resolve(pasta, `core-v11-v12-${Date.now()}.json`);
writeFileSync(arquivo, JSON.stringify(saida, null, 2), "utf8");
console.log(`\nResultado: ${arquivo}`);
