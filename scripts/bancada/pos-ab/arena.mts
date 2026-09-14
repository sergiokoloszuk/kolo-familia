/**
 * ARENA A/B — A AYLA COM E SEM A PÓS, COM O MODELO REAL NO LAÇO. 14/09/2026.
 *
 * ⚠️ UMA ÚNICA VARIÁVEL. O `system` dos dois braços é montado pela MESMA
 * função, na MESMA ordem, com o MESMO Core (lido do banco), o MESMO contexto
 * (montado pelo `montarContextoBase` de produção), o MESMO bloco do Gate B
 * (decidido por `escolherLacunaDecisiva`), o MESMO formato, o MESMO modelo e o
 * MESMO `maxTokens`. A diferença é uma string a mais: `<neurodesenvolvimento>`.
 *
 * ⚠️ ONDE O BLOCO ENTRA, E POR QUÊ. Depois do contexto e ANTES do repertório. A
 * ordem que o `system` de produção defende é Core (como pensar) → contexto
 * (sobre quem) → repertório (material de consulta). A pós é raciocínio sobre
 * ESTE caso: ela não é material, e não pode ficar entre a conversa e a razão
 * dela. Colocá-la antes do contexto a faria competir com quem é a criança.
 *
 * ⚠️ O QUE ESTA ARENA **NÃO** REPLICA, e está dito para não ser confundido com
 * prova: `<conversa_recente>`, `<trajetoria>`, eventos, perfil da família e o
 * bloco da jornada do Trial. Os casos são de UM turno e essas peças não variam
 * entre os braços — mas quem ler o resultado precisa saber que a bancada mede o
 * turno isolado, não a conversa inteira.
 *
 * NÃO ESCREVE NADA: sem WhatsApp, sem gravação, sem alteração de estado. As
 * únicas idas ao banco são SELECT (Core e Boas Práticas).
 *
 *   cd apps/web && npx tsx ../../scripts/bancada/pos-ab/arena.mts [--rodadas 3]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CASOS } from "./casos.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));

// env antes de qualquer import que leia process.env na carga
for (const linha of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { createClient } = await import("@supabase/supabase-js");
const { gerarConversacional, MODELO_CONVERSA } = await import("../../../apps/web/src/lib/ia/provider");
const { montarContextoBase } = await import("../../../apps/web/src/lib/ayla/experimental-contexto");
const { perfilConsultavelDaLinha } = await import("../../../apps/web/src/lib/kolo-vivo/consultar");
const { serializarSubcampos, subcamposDe } = await import("../../../apps/web/src/lib/kolo-vivo/subcampos");
const { DOMINIOS } = await import("../../../apps/web/src/app/(app)/kolo-vivo/dominios");
const { escolherLacunaDecisiva, blocoDaLacuna, instrucaoDoEnvelope, esquemaDaResposta, lerEnvelope } =
  await import("../../../apps/web/src/lib/ayla/lacuna-decisiva");
const { recuperarDaPos, blocoDaPos } = await import("../../../apps/web/src/lib/pos/recuperar");
const { FORMATO_WHATSAPP } = await import("../../../apps/web/src/lib/ayla/responder");
const formas = await import("../../../apps/web/src/lib/conducao/formas");
const { recuperarBoasPraticas, blocoBoasPraticas } = await import(
  "../../../apps/web/src/lib/conhecimento/recuperar"
);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// ── O Core REAL, lido do banco. O mesmo que produção serve.
const { data: coreRow } = await sb
  .from("ayla_documentos")
  .select("conteudo, versao")
  .eq("chave", "core")
  .eq("status", "ativo")
  .order("versao", { ascending: false })
  .limit(1)
  .maybeSingle();
if (!coreRow?.conteudo) {
  console.error("Core ativo não encontrado em ayla_documentos.");
  process.exit(1);
}
const CORE = coreRow.conteudo as string;
console.log(`Core v${coreRow.versao} · ${CORE.length} chars`);

// ── fixture do Perfil, montada com o SERIALIZADOR REAL
function linhaPerfil(perfil: Record<string, Record<string, string>>): Record<string, unknown> {
  const linha: Record<string, unknown> = { categorias_extras: {} };
  for (const [dom, valores] of Object.entries(perfil)) {
    const campos = subcamposDe(dom);
    if (!campos) continue;
    const texto = serializarSubcampos(campos, valores);
    if (!texto) continue;
    const def = DOMINIOS.find((d: { key: string }) => d.key === dom);
    if (def?.storage === "toplevel") linha[dom] = { texto };
    else (linha.categorias_extras as Record<string, unknown>)[dom] = { texto };
  }
  return linha;
}

const idadeMeses = (nascimento: string): number => {
  const d = new Date(nascimento);
  const hoje = new Date("2026-09-14T12:00:00Z");
  return (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth());
};

/** Temas do turno — declarados pelo caso, como o classificador os entregaria. */
const TEMAS_DO_GRUPO: Record<string, string[]> = {
  comunicacao: ["comunicacao"],
  crise: ["emocional"],
  sensorial: ["sensorial"],
  foco: ["foco"],
  socializacao: ["socializacao"],
  entrega: ["socializacao"],
  fronteira: [],
};

type Braco = "A" | "B" | "A_bp" | "B_bp";

function montarSystem(caso: (typeof CASOS)[number], braco: Braco, repertorio: string) {
  const linha = linhaPerfil(caso.crianca.perfil);
  const perfil = perfilConsultavelDaLinha(linha, "bancada");
  const temas =
    caso.grupo === "entrega" && caso.id === "G5-passo-a-passo" ? ["rotina"] : TEMAS_DO_GRUPO[caso.grupo] ?? [];

  // ── Gate B: IDÊNTICO nos dois braços. Ele continua dono do campo.
  const decisao = escolherLacunaDecisiva({
    perfil,
    temas,
    relato: caso.relato,
    jaRespondido: new Set<string>(),
  });

  const ctx = montarContextoBase({
    nomeResponsavel: "Karina",
    membro: {
      nome: caso.crianca.nome,
      data_nascimento: caso.crianca.nascimento,
      diagnosticos_formais: null,
      genero: caso.crianca.genero,
    },
    perfilVivo: linha as never,
    skills: temas,
  });

  const bloco = [ctx.bloco, decisao ? blocoDaLacuna(decisao) : ""].filter(Boolean).join("\n\n");

  // ── A PÓS. Só no braço B. Portão pelo sinal que o caso declara.
  const necessidade =
    caso.fonte === "pos" ? "pos_neurodesenvolvimento" : caso.fonte === "combinacao" ? "combinacao" : caso.fonte;
  const pos =
    braco === "B" || braco === "B_bp"
      ? recuperarDaPos({
          relato: caso.relato,
          temas,
          idadeMeses: idadeMeses(caso.crianca.nascimento),
          camposConhecidos: Object.entries(caso.crianca.perfil).flatMap(([d, cs]) =>
            Object.keys(cs).map((k) => `${d}.${k}`),
          ),
          necessidade: necessidade as never,
        })
      : null;
  const blocoPos = pos ? blocoDaPos(pos) : "";

  const entrega = formas.pedeEntregaEstruturada({ intencao: null });
  const natureza = caso.grupo === "fronteira" ? "desabafo" : "orientacao";
  const formato = [
    FORMATO_WHATSAPP,
    formas.notaDeProporcao(natureza as never),
    ...(entrega
      ? [
          formas.formasDeEntrega({ canal: "whatsapp", tema: null }),
          formas.INTERESSE_COMO_VEICULO,
          formas.A_CRIANCA_ANTES_DO_ROTULO,
        ]
      : []),
    formas.IDIOMA_DA_CONVERSA,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ⚠️ A ORDEM É A DE PRODUÇÃO. `blocoPos` entra entre contexto e repertório.
  const system = [CORE, bloco, blocoPos, repertorio, instrucaoDoEnvelope(), formato]
    .filter(Boolean)
    .join("\n\n");

  return { system, decisao, pos, blocoPos };
}

// ── repertório real (Boas Práticas), só para os braços *_bp
async function repertorioDe(caso: (typeof CASOS)[number]): Promise<string> {
  const temas = TEMAS_DO_GRUPO[caso.grupo] ?? [];
  if (!temas.length) return "";
  try {
    const bps = await recuperarBoasPraticas({
      supabase: sb as never,
      skills: temas,
      relato: caso.relato,
      idade: Math.floor(idadeMeses(caso.crianca.nascimento) / 12),
      limite: 2,
    });
    return blocoBoasPraticas(bps);
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────── execução
const argRodadas = Number(process.argv[process.argv.indexOf("--rodadas") + 1]);
const RODADAS_COMUM = Number.isFinite(argRodadas) && argRodadas > 0 ? argRodadas : 3;
const RODADAS_CRITICO = RODADAS_COMUM + 2;

type Saida = {
  caso: string;
  grupo: string;
  fonte: string;
  critico: boolean;
  mario: boolean;
  entregaObrigatoria: boolean;
  relato: string;
  oQueImporta: string;
  reprovaSe: string;
  braco: Braco;
  rodada: number;
  fala: string;
  campo: string | null;
  campoGateB: string | null;
  unidadesPos: string[];
  charsPos: number;
  tokensIn: number;
  tokensOut: number;
  ms: number;
  charsSystem: number;
};

const saidas: Saida[] = [];
const bracosDe = (c: (typeof CASOS)[number]): Braco[] =>
  c.grupo === "entrega" || c.fonte === "combinacao" ? ["A", "B", "A_bp", "B_bp"] : ["A", "B"];

let feitas = 0;
const total = (process.env.SO_CASO ? CASOS.filter((c) => c.id === process.env.SO_CASO) : CASOS).reduce(
  (s, c) => s + bracosDe(c).length * (c.critico ? RODADAS_CRITICO : RODADAS_COMUM),
  0,
);
console.log(`${CASOS.length} casos · ${total} gerações · rodadas ${RODADAS_COMUM}/${RODADAS_CRITICO}\n`);

const SO = process.env.SO_CASO ? CASOS.filter((c) => c.id === process.env.SO_CASO) : CASOS;
for (const caso of SO) {
  const rodadas = caso.critico ? RODADAS_CRITICO : RODADAS_COMUM;
  const repertorio = await repertorioDe(caso);
  for (const braco of bracosDe(caso)) {
    const usaBp = braco.endsWith("_bp");
    const { system, decisao, pos, blocoPos } = montarSystem(caso, braco, usaBp ? repertorio : "");
    for (let r = 1; r <= rodadas; r++) {
      const t0 = Date.now();
      let fala = "";
      let campo: string | null = null;
      let tokensIn = 0;
      let tokensOut = 0;
      try {
        const out = await gerarConversacional({
          provider: "openai",
          model: MODELO_CONVERSA.openai,
          system,
          messages: [{ role: "user", content: caso.relato }],
          maxTokens: 1200,
          cacheSystem: true,
          formatoJson: esquemaDaResposta(),
        });
        const env = lerEnvelope(out.texto);
        fala = env.fala ?? "";
        campo = env.campo;
        tokensIn = out.tokensIn ?? 0;
        tokensOut = out.tokensOut ?? 0;
      } catch (e) {
        fala = `(ERRO: ${e instanceof Error ? e.message.slice(0, 80) : "?"})`;
      }
      saidas.push({
        caso: caso.id,
        grupo: caso.grupo,
        fonte: caso.fonte,
        critico: Boolean(caso.critico),
        mario: Boolean(caso.mario),
        entregaObrigatoria: Boolean(caso.entregaObrigatoria),
        relato: caso.relato,
        oQueImporta: caso.oQueImporta,
        reprovaSe: caso.reprovaSe,
        braco,
        rodada: r,
        fala,
        campo,
        campoGateB: decisao?.escolhida ? `${decisao.escolhida.dominio}.${decisao.escolhida.campo}` : null,
        unidadesPos: pos?.selecionadas.map((s: { unidade: { id: string } }) => s.unidade.id) ?? [],
        charsPos: blocoPos.length,
        tokensIn,
        tokensOut,
        ms: Date.now() - t0,
        charsSystem: system.length,
      });
      feitas++;
      if (feitas % 10 === 0) process.stdout.write(`${feitas}/${total} `);
    }
  }
}

mkdirSync(resolve(AQUI, "resultados"), { recursive: true });
const arq = resolve(AQUI, "resultados", "geracoes.json");
writeFileSync(arq, JSON.stringify(saidas, null, 2), "utf8");
console.log(`\n\n${saidas.length} gerações → ${arq}`);

const erros = saidas.filter((s) => s.fala.startsWith("(ERRO"));
if (erros.length) console.log(`⚠️ ${erros.length} erros de geração`);
const ms = saidas.map((s) => s.ms).sort((a, b) => a - b);
const tin = saidas.reduce((a, s) => a + s.tokensIn, 0);
const tout = saidas.reduce((a, s) => a + s.tokensOut, 0);
console.log(`latência mediana ${ms[Math.floor(ms.length / 2)]}ms · tokens in ${tin} out ${tout}`);
