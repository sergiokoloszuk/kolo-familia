/**
 * ARENA DE VALOR — 6 BRAÇOS, MODELO REAL NO LAÇO. 14/09/2026.
 *
 *   A  Ayla atual                     (Core + Perfil/contexto + Gate B)
 *   B  A + PÓS INTEGRAL
 *   C  A + BOAS PRÁTICAS
 *   D  A + PÓS + BOAS PRÁTICAS
 *   E  A + DNA DOS ESPECIALISTAS
 *   F  A + PÓS + BOAS PRÁTICAS + DNA
 *
 * ⚠️ UMA VARIÁVEL POR BRAÇO. O `system` sai da MESMA função, na MESMA ordem de
 * produção, com o MESMO Core (lido do banco), o MESMO contexto
 * (`montarContextoBase`), o MESMO Gate B (`escolherLacunaDecisiva`), o MESMO
 * formato, modelo e `maxTokens`. O que muda é só qual bloco entra.
 *
 * ⚠️ VALIDAÇÃO DO HARNESS ANTES DO PLACAR — a missão exige, e com razão: a
 * bancada anterior mentiu duas vezes em silêncio (um `lacunasDe` que devolvia
 * vazio e um `b.acao` que não existia). Aqui, `--validar` roda as seis
 * asserções estruturais ANTES de qualquer geração e aborta se uma falhar.
 * Nenhum número sai de um harness não conferido.
 *
 * NÃO ESCREVE NADA: sem WhatsApp, sem gravação, sem alteração de estado. As
 * únicas idas ao banco são SELECT (Core, Boas Práticas).
 *
 *   cd apps/web && npx tsx ../../scripts/bancada/arena-valor/arena.mts --validar
 *   cd apps/web && npx tsx ../../scripts/bancada/arena-valor/arena.mts --rodadas 3
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CASOS } from "./corpus.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
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
const { BLOCO_DNA } = await import("../../../apps/web/src/lib/pos/dna-especialistas");
const { FORMATO_WHATSAPP } = await import("../../../apps/web/src/lib/ayla/responder");
const formas = await import("../../../apps/web/src/lib/conducao/formas");
const { recuperarBoasPraticas, blocoBoasPraticas } = await import(
  "../../../apps/web/src/lib/conhecimento/recuperar"
);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const { data: coreRow } = await sb
  .from("ayla_documentos")
  .select("conteudo, versao")
  .eq("chave", "core")
  .eq("status", "ativo")
  .order("versao", { ascending: false })
  .limit(1)
  .maybeSingle();
if (!coreRow?.conteudo) {
  console.error("Core ativo não encontrado.");
  process.exit(1);
}
const CORE = coreRow.conteudo as string;

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

const idadeMeses = (n: string) => {
  const d = new Date(n);
  const h = new Date("2026-09-14T12:00:00Z");
  return (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
};

export type Braco = "A" | "B" | "C" | "D" | "E" | "F";
const BRACOS: Braco[] = ["A", "B", "C", "D", "E", "F"];
const TEM_POS = (b: Braco) => b === "B" || b === "D" || b === "F";
const TEM_BP = (b: Braco) => b === "C" || b === "D" || b === "F";
const TEM_DNA = (b: Braco) => b === "E" || b === "F";

type Caso = (typeof CASOS)[number];

function montar(caso: Caso, braco: Braco, repertorio: string, mensagem: string, historico: string[]) {
  const linha = linhaPerfil(caso.crianca.perfil);
  const perfil = perfilConsultavelDaLinha(linha, "arena");
  const temas = caso.temas;

  const decisao = escolherLacunaDecisiva({
    perfil,
    temas,
    relato: mensagem,
    jaRespondido: new Set<string>(),
  });

  const ctx = montarContextoBase({
    nomeResponsavel: "Barbara",
    membro: {
      nome: caso.crianca.nome,
      data_nascimento: caso.crianca.nascimento,
      diagnosticos_formais: caso.crianca.diagnosticos?.length ? caso.crianca.diagnosticos : null,
      genero: caso.crianca.genero,
    },
    perfilVivo: linha as never,
    skills: temas,
  });

  // ⚠️ O HISTÓRICO É IDÊNTICO EM TODOS OS BRAÇOS — é o que permite o caso
  // multiturno (TIPO 4) medir perseveração de segurança sem que a diferença
  // venha de o braço ter visto outra conversa.
  const conversa = historico.length
    ? `<conversa_recente>\n${historico.join("\n")}\n</conversa_recente>`
    : "";

  const bloco = [ctx.bloco, decisao ? blocoDaLacuna(decisao) : "", conversa].filter(Boolean).join("\n\n");

  const pos = TEM_POS(braco)
    ? recuperarDaPos({
        relato: mensagem,
        temas,
        idadeMeses: idadeMeses(caso.crianca.nascimento),
        camposConhecidos: Object.entries(caso.crianca.perfil).flatMap(([d, cs]) =>
          Object.keys(cs).map((k) => `${d}.${k}`),
        ),
        // Na arena o portão fica ABERTO nos braços com Pós: o que se mede aqui
        // é o valor do conteúdo, não a decisão de consultar — essa já foi
        // medida em `pos-integral/sinal.mts` (18/18).
        necessidade: "combinacao",
      })
    : null;

  const entrega = formas.pedeEntregaEstruturada({ intencao: null });
  const formato = [
    FORMATO_WHATSAPP,
    formas.notaDeProporcao("orientacao" as never),
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

  // ⚠️ A ORDEM. Core (como pensar) → contexto (sobre quem) → pós (como
  // raciocinar sobre ESTE caso) → DNA (como transformar em entrega) →
  // repertório (material) → envelope → formato. O DNA fica depois da pós e
  // antes do repertório porque ele é a ponte entre raciocinar e entregar.
  const system = [
    CORE,
    bloco,
    pos ? blocoDaPos(pos) : "",
    TEM_DNA(braco) ? BLOCO_DNA : "",
    TEM_BP(braco) ? repertorio : "",
    instrucaoDoEnvelope(),
    formato,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, decisao, pos };
}

async function repertorioDe(caso: Caso, mensagem: string): Promise<string> {
  try {
    const bps = await recuperarBoasPraticas({
      supabase: sb as never,
      skills: caso.temas,
      relato: mensagem,
      idade: Math.floor(idadeMeses(caso.crianca.nascimento) / 12),
      limite: 2,
    });
    return blocoBoasPraticas(bps);
  } catch {
    return "";
  }
}

// ═══════════════════════════ VALIDAÇÃO DO HARNESS ═══════════════════════════
/**
 * ⚠️ SEIS ASSERÇÕES ANTES DE QUALQUER NÚMERO.
 *
 * A bancada anterior desta mesma frente mentiu duas vezes sem dar erro: um
 * `PerfilConsultavel` de mentira que devolvia zero lacunas (e fazia o Gate B
 * calar em 18/18), e a leitura de um campo `acao` que não existe (o certo é
 * `decisao`). Nos dois casos o relatório saiu bonito. Harness errado não
 * devolve erro — devolve número tranquilizador.
 */
function validarHarness(): void {
  const falhas: string[] = [];
  const caso = CASOS.find((c) => c.id === "T10-ja-sei")!;
  const rep = "## Boas Práticas\n- exemplo de repertório";
  const sys: Record<Braco, string> = {} as never;
  for (const b of BRACOS) sys[b] = montar(caso, b, rep, caso.relato!, []).system;

  // 1. o Perfil chega ao prompt — o texto literal do banco tem de estar lá
  if (!sys.A.includes("hipótese silábica")) falhas.push("1. o Perfil NÃO chegou ao system");
  // 2. o Gate B produziu candidatos de verdade (o erro de ontem)
  const linha = linhaPerfil(caso.crianca.perfil);
  const d = escolherLacunaDecisiva({
    perfil: perfilConsultavelDaLinha(linha, "v"),
    temas: caso.temas,
    relato: caso.relato!,
    jaRespondido: new Set(),
  });
  if (!d || typeof d.decisao !== "string") falhas.push("2. Gate B não devolveu `decisao`");
  if ((d.candidatasChaves ?? []).length === 0) falhas.push("2b. Gate B sem candidatas — perfil de mentira?");
  // 3. cada camada entra SÓ no braço certo
  if (sys.A.includes("<neurodesenvolvimento>")) falhas.push("3. A tem Pós");
  if (!sys.B.includes("<neurodesenvolvimento>")) falhas.push("3. B não tem Pós");
  if (sys.B.includes("Boas Práticas")) falhas.push("3. B tem BP");
  if (!sys.C.includes("Boas Práticas")) falhas.push("3. C não tem BP");
  if (sys.C.includes("<neurodesenvolvimento>")) falhas.push("3. C tem Pós");
  if (!sys.E.includes("Como raciocinar antes de responder")) falhas.push("3. E não tem DNA");
  if (sys.A.includes("Como raciocinar antes de responder")) falhas.push("3. A tem DNA");
  if (!(sys.F.includes("<neurodesenvolvimento>") && sys.F.includes("Boas Práticas") && sys.F.includes("Como raciocinar")))
    falhas.push("3. F não tem as três camadas");
  // 4. o Core é o mesmo em todos
  const semExtras = (s: string) => s.slice(0, CORE.length);
  if (BRACOS.some((b) => semExtras(sys[b]) !== CORE)) falhas.push("4. Core difere entre braços");
  // 5. A é PREFIXO estrito dos outros até o fim do contexto — nada foi removido
  const ctxFim = sys.A.indexOf(instrucaoDoEnvelope().slice(0, 40));
  if (ctxFim < 0) falhas.push("5. envelope não encontrado em A");
  else if (BRACOS.some((b) => !sys[b].startsWith(sys.A.slice(0, ctxFim))))
    falhas.push("5. algum braço NÃO contém o contexto de A — a variável não é única");
  // 6. os tamanhos crescem na ordem esperada
  if (!(sys.A.length < sys.B.length && sys.A.length < sys.E.length && sys.F.length > sys.D.length))
    falhas.push("6. tamanhos não crescem com as camadas");

  console.log("\n=== VALIDAÇÃO DO HARNESS ===");
  for (const b of BRACOS) console.log(`  ${b}: ${sys[b].length} chars`);
  console.log(`  Gate B: decisao=${d.decisao} candidatas=${(d.candidatasChaves ?? []).length}`);
  if (falhas.length) {
    console.error("\n❌ HARNESS INVÁLIDO — nenhum número será gerado:");
    for (const f of falhas) console.error("   " + f);
    process.exit(1);
  }
  console.log("✅ harness válido — 6 asserções passaram\n");
}

validarHarness();
if (process.argv.includes("--validar")) process.exit(0);

// ═══════════════════════════ EXECUÇÃO ═══════════════════════════
const ia = process.argv.indexOf("--rodadas");
const RODADAS = ia > 0 && Number(process.argv[ia + 1]) > 0 ? Number(process.argv[ia + 1]) : 3;

type Saida = {
  caso: string;
  tipo: string;
  critico: boolean;
  braco: Braco;
  rodada: number;
  turno: number;
  mensagem: string;
  esperado: string;
  reprova: string;
  fala: string;
  campoGateB: string | null;
  unidadesPos: string[];
  tokensIn: number;
  tokensOut: number;
  ms: number;
  charsSystem: number;
};

const saidas: Saida[] = [];
const total = CASOS.reduce(
  (s, c) => s + BRACOS.length * RODADAS * ((c as { multiturno?: string[] }).multiturno?.length ?? 1),
  0,
);
console.log(`Core v${coreRow.versao} · ${CASOS.length} casos · ${BRACOS.length} braços · ${RODADAS} rodadas`);
console.log(`${total} gerações\n`);

let feitas = 0;
for (const caso of CASOS) {
  const turnos = (caso as { multiturno?: string[] }).multiturno ?? [caso.relato!];
  for (const braco of BRACOS) {
    for (let r = 1; r <= RODADAS; r++) {
      // ⚠️ O HISTÓRICO SE ACUMULA DENTRO DA RODADA — é assim que o TIPO 4 mede
      // se o braço percebeu que o contexto avançou.
      const historico: string[] = [];
      for (let t = 0; t < turnos.length; t++) {
        const mensagem = turnos[t]!;
        const rep = TEM_BP(braco) ? await repertorioDe(caso, mensagem) : "";
        const { system, decisao, pos } = montar(caso, braco, rep, mensagem, historico);
        const t0 = Date.now();
        let fala = "";
        let tokensIn = 0;
        let tokensOut = 0;
        try {
          const out = await gerarConversacional({
            provider: "openai",
            model: MODELO_CONVERSA.openai,
            system,
            messages: [{ role: "user", content: mensagem }],
            maxTokens: 1200,
            cacheSystem: true,
            formatoJson: esquemaDaResposta(),
          });
          fala = lerEnvelope(out.texto).fala ?? "";
          tokensIn = out.tokensIn ?? 0;
          tokensOut = out.tokensOut ?? 0;
        } catch (e) {
          fala = `(ERRO: ${e instanceof Error ? e.message.slice(0, 70) : "?"})`;
        }
        historico.push(`Mãe: ${mensagem}`, `Ayla: ${fala.slice(0, 400)}`);
        saidas.push({
          caso: caso.id,
          tipo: caso.tipo,
          critico: Boolean((caso as { critico?: boolean }).critico),
          braco,
          rodada: r,
          turno: t + 1,
          mensagem,
          esperado: caso.esperado,
          reprova: caso.reprova ?? "",
          fala,
          campoGateB: decisao?.escolhida ? `${decisao.escolhida.dominio}.${decisao.escolhida.campo}` : null,
          unidadesPos: pos?.selecionadas.map((s: { unidade: { id: string } }) => s.unidade.id) ?? [],
          tokensIn,
          tokensOut,
          ms: Date.now() - t0,
          charsSystem: system.length,
        });
        feitas++;
        if (feitas % 12 === 0) process.stdout.write(`${feitas}/${total} `);
      }
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
console.log(`latência mediana ${ms[Math.floor(ms.length / 2)]}ms`);
for (const b of BRACOS) {
  const d = saidas.filter((s) => s.braco === b);
  const tin = d.reduce((a, s) => a + s.tokensIn, 0);
  const tout = d.reduce((a, s) => a + s.tokensOut, 0);
  const chars = Math.round(d.reduce((a, s) => a + s.fala.length, 0) / d.length);
  console.log(`  ${b}: in ${tin} · out ${tout} · resposta média ${chars} chars`);
}
