/**
 * A/B multi-turno da mini-investigacao.
 *
 * A = regra desligada (producao anterior); B = excecao ativa. Familia e
 * historico sinteticos; Supabase somente GET para documentos/BPs/catalogo;
 * provider real; zero WhatsApp e zero persistencia externa.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";

const raiz = process.cwd();
const web = resolve(raiz, "apps/web");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(pathToFileURL(resolve(web, "src", `${specifier.slice(2)}.ts`)).href, context);
    }
    if (["next/headers", "next/cache", "server-only"].includes(specifier)) {
      return {
        url: "data:text/javascript,export const cookies=()=>{throw Error('sem request')};export const headers=cookies;export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    }
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes("/apps/web/src/")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error("Variaveis do Supabase ausentes");
const origin = new URL(U).origin;
const fetchReal = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? input?.method ?? "GET").toUpperCase();
  const banco = url.origin === origin;
  const modelo = url.origin === "https://api.openai.com" && method === "POST";
  if (banco && method !== "GET") throw new Error(`Escrita externa bloqueada: ${method} ${url.pathname}`);
  if (!banco && !modelo) throw new Error(`I/O fora da bancada: ${method} ${url.origin}${url.pathname}`);
  return fetchReal(input, { ...init, signal: init.signal ?? AbortSignal.timeout(90_000) });
};

const mod = (p) => import(pathToFileURL(resolve(web, "src", p)).href);
const [
  { montarMundo },
  { responderExperimental },
  { decidirTurno },
  { carregarCatalogoSkills },
  { gerarConversacional, MODELO_CONVERSA },
] = await Promise.all([
  mod("lib/ayla/__harness/cenario.ts"),
  mod("lib/ayla/experimental.ts"),
  mod("lib/conducao/decisao-do-turno.ts"),
  mod("lib/ayla/catalogo-skills.ts"),
  mod("lib/ia/provider.ts"),
]);

const remoto = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const catalogo = await carregarCatalogoSkills(remoto);
if (catalogo.estado !== "ok") throw new Error(`Catalogo indisponivel: ${catalogo.motivo}`);

const casos = [
  {
    id: "alimentacao",
    mensagem: "Ja tentei oferecer aos poucos, sem pressao e mudar a apresentacao, mas nao funcionou. Antes de tentar mais uma coisa, quero entender o que pesa na alimentacao do Leo.",
    perfil: { nutricional: "Aceita bem / preferidos: arroz; banana" },
    respostaA: "Ele cheira, afasta o prato e chora se insistimos.",
    respostaB:
      "Com alimento novo ele primeiro cheira, afasta o prato e chora se insistimos. Pastosos e cheiros fortes incomodam; seco e crocante ele tolera melhor.",
  },
  {
    id: "regulacao",
    mensagem: "Ja tentei falar baixo, dar espaco e antecipar, mas nada ajuda sempre quando o Leo explode. Quero entender o que muda o que devo fazer.",
    perfil: {},
    respostaA: "Geralmente acontece depois de uma mudanca sem aviso ou quando esta cansado.",
    respostaB:
      "Geralmente vem depois de uma mudanca sem aviso ou quando esta cansado. Falar muito e tocar pioram; lugar quieto e eu ficar perto em silencio ajudam. No auge ele nao fala, so me puxa pela mao.",
  },
  {
    id: "atividade",
    mensagem: "Ja tentei deixar a atividade curta, dar escolhas e usar o que o Leo gosta, mas nao funcionou. Nao sei onde trava.",
    perfil: { essencial: "Interesses: trens e mapas" },
    respostaA: "Ele entende e comeca se eu fizer o primeiro passo, mas abandona depois de uns tres minutos.",
    respostaB:
      "Ele entende quando eu mostro. Nao comeca sozinho, mas comeca se eu fizer o primeiro passo. Depois de uns tres minutos abandona quando ha muita coisa na mesa.",
  },
  {
    id: "comunicacao",
    mensagem: "Ja tentei oferecer duas escolhas e modelar uma palavra, mas nao funcionou. O perfil ainda nao tem informacao suficiente sobre como o Leo se comunica.",
    perfil: {},
    respostaA: "Ele usa algumas palavras soltas, aponta ou me leva pela mao.",
    respostaB:
      "Ele usa algumas palavras soltas. Quando nao consegue, aponta ou me leva pela mao. Entende pedidos simples melhor quando eu mostro junto.",
  },
];

const resultado = {
  data: new Date().toISOString(),
  ambiente: "familias sinteticas; provider real; Supabase somente leitura; sem WhatsApp; sem persistencia",
  criterio:
    "aprovar somente se as perguntas agrupadas produzirem orientacao significativamente melhor, sem repetir Perfil nem abrir nova bateria",
  casos: [],
};

const inserirFala = (mundo, row) => mundo.db.semear("ayla_messages", [{
  id: `${row.direcao}-${Date.now()}-${Math.random()}`,
  family_account_id: mundo.familyId,
  membro_atipico_id: mundo.membros.Leo,
  texto: row.texto,
  direcao: row.direcao,
  metadata: row.metadata ?? {},
  created_at: row.created_at,
}]);

for (const caso of casos) {
  const ramos = {};
  for (const ramo of ["A", "B"]) {
    process.env.AYLA_MINI_INVESTIGACAO = ramo === "A" ? "off" : "on";
    const mundo = montarMundo({
      nomeMae: "Ana",
      criancas: [{
        nome: "Leo",
        nascimento: "2020-01-01",
        genero: "masculino",
        sabe: caso.perfil.essencial ? { essencial: caso.perfil.essencial } : {},
        extras: Object.fromEntries(Object.entries(caso.perfil).filter(([k]) => k !== "essencial")),
      }],
    });
    const memoria = mundo.db.cliente();
    const db = {
      from(tabela) {
        return ["ayla_documentos", "boas_praticas"].includes(tabela)
          ? remoto.from(tabela)
          : memoria.from(tabela);
      },
    };

    const gerarTurno = async (mensagem) => {
      const decisao = await decidirTurno({
        texto: mensagem,
        blocoEstado: "<estado>Familia sintetica; Leo tem 6 anos.</estado>",
        catalogoSkills: catalogo.skills,
        catalogoDisponivel: true,
      });
      const falhas = [];
      const resposta = await responderExperimental(db, {
        familyId: mundo.familyId,
        mensagem,
        origem: "simulador",
        turnosSimulados: [],
        turnoClassificado: decisao,
        onFalha: (motivo, detalhe) => falhas.push({ motivo, detalhe }),
      });
      if (!resposta) throw new Error(`${caso.id}/${ramo}: ${JSON.stringify(falhas)}`);
      return { resposta, decisao };
    };

    inserirFala(mundo, { direcao: "inbound", texto: caso.mensagem, created_at: "2026-09-24T12:00:00.000Z" });
    const t1 = await gerarTurno(caso.mensagem);
    const miniConfirmada =
      t1.resposta.miniInvestigacao?.acao === "PERGUNTAR" &&
      t1.resposta.camposInvestigados?.length === t1.resposta.miniInvestigacao.campos.length;
    inserirFala(mundo, {
      direcao: "outbound",
      texto: t1.resposta.texto,
      metadata: miniConfirmada
        ? {
            mini_investigacao_tema: t1.resposta.miniInvestigacao.tema,
            mini_investigacao_campos: t1.resposta.camposInvestigados,
          }
        : {},
      created_at: "2026-09-24T12:01:00.000Z",
    });
    const respostaDaFamilia = ramo === "A" ? caso.respostaA : caso.respostaB;
    inserirFala(mundo, { direcao: "inbound", texto: respostaDaFamilia, created_at: "2026-09-24T12:02:00.000Z" });
    const t2 = await gerarTurno(respostaDaFamilia);
    ramos[ramo] = {
      t1: t1.resposta.texto,
      t2: t2.resposta.texto,
      mini_t1: t1.resposta.miniInvestigacao,
      campos_declarados_t1: t1.resposta.camposInvestigados,
      mini_t2: t2.resposta.miniInvestigacao,
      chars: [t1.resposta.texto.length, t2.resposta.texto.length],
      perguntas: [
        (t1.resposta.texto.match(/\?/g) ?? []).length,
        (t2.resposta.texto.match(/\?/g) ?? []).length,
      ],
    };
  }

  const juizo = await gerarConversacional({
    provider: "openai",
    model: MODELO_CONVERSA.openai,
    system: `Voce audita duas conducoes da Ayla para uma familia de crianca neurodivergente. Compare semanticamente, sem premiar quantidade de texto nem perguntas mais bonitas. B so passa se as respostas agrupadas produzirem uma orientacao de segundo turno SIGNIFICATIVAMENTE melhor. Avalie: turnos ate ajuda util; repeticao do que o Perfil ja sabia; especificidade; acao concreta; frase pronta; tamanho; naturalidade; sensacao de interrogatorio; personalizacao; e se houve nova bateria. Responda com: VENCEDOR: A|B|EMPATE; B_SIGNIFICATIVAMENTE_MELHOR: SIM|NAO; e justificativa objetiva por dimensao.`,
    messages: [{
      role: "user",
      content: `TEMA: ${caso.id}\nPERFIL DISPONIVEL ANTES DE T1: ${JSON.stringify(caso.perfil)}\nPEDIDO QUE ABRIU T1: ${caso.mensagem}\n\nA-T1:\n${ramos.A.t1}\n\nRESPOSTA DA FAMILIA AO QUE A PERGUNTOU:\n${caso.respostaA}\n\nA-T2:\n${ramos.A.t2}\n\nB-T1:\n${ramos.B.t1}\n\nRESPOSTA DA FAMILIA AO GRUPO QUE B PERGUNTOU:\n${caso.respostaB}\n\nB-T2:\n${ramos.B.t2}`,
    }],
    maxTokens: 1200,
    cacheSystem: true,
  });
  resultado.casos.push({ ...caso, ramos, juizo: juizo.texto.trim() });
  console.log(JSON.stringify({ id: caso.id, A: ramos.A, B: ramos.B, juizo: juizo.texto.trim() }));
}

const arquivo = resolve(raiz, "docs/auditorias/mini-investigacao-ab-2026-09-24.json");
mkdirSync(dirname(arquivo), { recursive: true });
writeFileSync(arquivo, `${JSON.stringify(resultado, null, 2)}\n`);
console.log(`Resultado: ${arquivo}`);
